import type { LaunchProofConfig } from '../config/schema.js';
import { createCheck, createFinding } from '../checks.js';
import type { CheckResult, Evidence, Finding } from '../types.js';
import { isLoopbackHost, truncate } from '../util.js';
import { headerValue } from './client.js';
import type { HttpClient, HttpResponseRecord } from './client.js';

interface ExposureTarget {
  path: string;
  label: string;
  severity: 'critical' | 'high' | 'medium';
  description: string;
  validate: (response: HttpResponseRecord) => boolean;
}

const EXPOSURES: ExposureTarget[] = [
  {
    path: '/.env',
    label: 'Environment file',
    severity: 'critical',
    description:
      'An environment file is served over HTTP. It can contain database, payment, and signing credentials.',
    validate: (response) => {
      if (response.status !== 200) return false;
      const head = response.bodyText.slice(0, 600);
      if (/<html|<!doctype/i.test(head)) return false;
      return /(?:^|\n)\s*[A-Z][A-Z0-9_]{2,}\s*=\s*[^\s#]+/m.test(response.bodyText);
    },
  },
  {
    path: '/.git/config',
    label: 'Git configuration',
    severity: 'critical',
    description:
      'The .git directory is publicly served, exposing repository metadata and potentially full source history.',
    validate: (response) =>
      response.status === 200 &&
      /\[core\]|\[remote|repositoryformatversion/i.test(response.bodyText),
  },
  {
    path: '/.git/HEAD',
    label: 'Git HEAD reference',
    severity: 'high',
    description: 'The .git directory is publicly served.',
    validate: (response) => response.status === 200 && /^ref:\s+refs\//m.test(response.bodyText),
  },
  {
    path: '/backup.sql',
    label: 'Database backup',
    severity: 'critical',
    description: 'A database backup is publicly downloadable.',
    validate: (response) =>
      response.status === 200 &&
      /create\s+table|insert\s+into|pg_dump|mysqldump/i.test(response.bodyText),
  },
  {
    path: '/.DS_Store',
    label: 'macOS metadata file',
    severity: 'medium',
    description: 'A .DS_Store file is publicly served and can reveal file and directory names.',
    validate: (response) => response.status === 200 && response.bodyText.includes('Bud1'),
  },
  {
    path: '/package.json',
    label: 'package.json',
    severity: 'medium',
    description:
      'package.json is served publicly, revealing dependency versions that may be targeted.',
    validate: (response) => {
      if (response.status !== 200 || !/json/i.test(response.contentType)) return false;
      try {
        const parsed = JSON.parse(response.bodyText) as unknown;
        return Boolean(parsed && typeof parsed === 'object' && 'name' in parsed);
      } catch {
        return false;
      }
    },
  },
  {
    path: '/server-status',
    label: 'Server status page',
    severity: 'medium',
    description: 'A server status page is publicly reachable.',
    validate: (response) =>
      response.status === 200 && /Apache Server Status|Server Status/i.test(response.bodyText),
  },
  {
    path: '/api/debug',
    label: 'Debug endpoint',
    severity: 'high',
    description:
      'A debug endpoint responds publicly and may expose environment, configuration, or stack details.',
    validate: (response) => {
      if (response.status !== 200 || !/json/i.test(response.contentType)) return false;
      try {
        const parsed = JSON.parse(response.bodyText) as Record<string, unknown>;
        return ['env', 'debug', 'config', 'stack', 'environment'].some((key) => key in parsed);
      } catch {
        return false;
      }
    },
  },
];

function headerFinding(
  key: string,
  title: string,
  description: string,
  severity: Finding['severity'],
  remediation: string,
  impact: string,
): Finding {
  return createFinding({
    checkId: 'http.headers',
    title,
    description,
    severity,
    confidence: 'high',
    verification: 'observed',
    category: 'http',
    impact,
    remediation,
    key: `header:${key}`,
  });
}

export interface HttpCheckOptions {
  target: URL;
  config: LaunchProofConfig;
  client: HttpClient;
  roots?: string[];
}

export async function runHttpChecks(options: HttpCheckOptions): Promise<CheckResult[]> {
  const { target, config, client } = options;
  const started = Date.now();

  let root: HttpResponseRecord;
  try {
    root = await client.request(target.toString());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed';
    return [
      createCheck({
        id: 'http.reachability',
        title: 'Target reachability',
        category: 'http',
        status: 'error',
        summary: `The target could not be reached: ${message}`,
        error: message,
        details: 'No HTTP security conclusions can be drawn from an unreachable target.',
        durationMs: Date.now() - started,
      }),
    ];
  }

  const checks: CheckResult[] = [];
  const findings: Finding[] = [];
  const h = (name: string): string | null => headerValue(root, name);
  const csp = h('content-security-policy');
  const hsts = h('strict-transport-security');
  const xfo = h('x-frame-options');
  const isHttps = target.protocol === 'https:';

  if (!csp) {
    findings.push(
      headerFinding(
        'csp-missing',
        'Content-Security-Policy header is missing',
        'The response does not define a Content-Security-Policy, so the browser applies no restriction on script, style, frame, or connection sources.',
        'medium',
        "Add a restrictive Content-Security-Policy. Start with default-src 'self' and allow only the origins the application needs.",
        'Injected scripts have fewer obstacles and XSS impact is amplified.',
      ),
    );
  } else if (/\bunsafe-eval\b/.test(csp)) {
    findings.push(
      headerFinding(
        'csp-unsafe-eval',
        'Content-Security-Policy allows unsafe-eval',
        'The policy permits eval() and Function construction, weakening protection against script injection.',
        'low',
        'Remove unsafe-eval and refactor code that relies on dynamic string evaluation.',
        'A CSP bypass becomes more likely if an injection point exists.',
      ),
    );
  }
  if (!h('x-content-type-options')?.toLowerCase().includes('nosniff')) {
    findings.push(
      headerFinding(
        'nosniff',
        'X-Content-Type-Options is missing',
        'Browsers may MIME-sniff responses, which can turn an uploaded text file into executable script.',
        'low',
        'Set X-Content-Type-Options: nosniff on every response.',
        'Content sniffing can enable script execution from user-uploaded content.',
      ),
    );
  }
  if (!xfo && !(csp && /frame-ancestors/.test(csp))) {
    findings.push(
      headerFinding(
        'framing',
        'Clickjacking protection is missing',
        'Neither X-Frame-Options nor CSP frame-ancestors restricts embedding of this page.',
        'medium',
        'Set X-Frame-Options: DENY (or SAMEORIGIN) and a CSP frame-ancestors directive.',
        'The application can be embedded in an attacker-controlled page and used for clickjacking.',
      ),
    );
  }
  if (!h('referrer-policy')) {
    findings.push(
      headerFinding(
        'referrer',
        'Referrer-Policy is missing',
        'No referrer policy is set, so full URLs may leak to third parties and across origins.',
        'low',
        'Set Referrer-Policy: strict-origin-when-cross-origin or no-referrer.',
        'Tokens or identifiers in URLs can leak through the Referer header.',
      ),
    );
  }
  if (!h('permissions-policy')) {
    findings.push(
      headerFinding(
        'permissions',
        'Permissions-Policy is missing',
        'The response does not restrict access to browser features such as camera, microphone, and geolocation.',
        'low',
        'Add a Permissions-Policy that disables features the app does not use.',
        'Embedded or compromised content has broader browser capabilities than necessary.',
      ),
    );
  }
  if (isHttps && !hsts) {
    findings.push(
      headerFinding(
        'hsts',
        'Strict-Transport-Security is missing',
        'HTTPS responses do not instruct browsers to enforce HTTPS on future visits.',
        'medium',
        'Add Strict-Transport-Security: max-age=31536000; includeSubDomains once all subdomains support HTTPS.',
        'Users remain exposed to protocol downgrade and cookie interception on hostile networks.',
      ),
    );
  }
  const poweredBy = h('x-powered-by');
  if (poweredBy) {
    findings.push(
      headerFinding(
        'powered-by',
        'X-Powered-By discloses the stack',
        `The response advertises "${poweredBy}", giving attackers a precise technology fingerprint.`,
        'low',
        'Disable the X-Powered-By header in the framework or reverse proxy.',
        'Technology-specific exploits become easier to select.',
      ),
    );
  }
  const server = h('server');
  if (server && /\d+\.\d+/.test(server)) {
    findings.push(
      headerFinding(
        'server-version',
        'Server header discloses a version',
        `The Server header exposes a version ("${server}").`,
        'low',
        'Configure the server or proxy to omit version details from the Server header.',
        'Known vulnerabilities for the exact version become easier to exploit.',
      ),
    );
  }

  checks.push(
    createCheck({
      id: 'http.headers',
      title: 'HTTP security headers',
      category: 'http',
      status: findings.some((f) => f.severity === 'high' || f.severity === 'critical')
        ? 'fail'
        : findings.length > 0
          ? 'warn'
          : 'pass',
      summary:
        findings.length === 0
          ? 'All reviewed security headers are present.'
          : `${findings.length} security header(s) missing or weak.`,
      findings,
      evidence: [
        { kind: 'http', label: 'Status', value: `${root.status} ${root.statusText}`.trim() },
        { kind: 'header', label: 'Content-Security-Policy', value: csp ?? 'absent' },
        { kind: 'header', label: 'Strict-Transport-Security', value: hsts ?? 'absent' },
      ],
      durationMs: Date.now() - started,
    }),
  );

  checks.push(checkCookies(root));
  checks.push(await checkCors(target, client));
  checks.push(checkTransport(target, root, isHttps));
  checks.push(await checkExposure(target, client, config));
  checks.push(await checkErrorHandling(target, client, root));
  return checks;
}

function checkCookies(root: HttpResponseRecord): CheckResult {
  const started = Date.now();
  const findings: Finding[] = [];
  const isHttps = root.finalUrl.startsWith('https:');
  for (const cookie of root.setCookies.slice(0, 20)) {
    const [pair, ...attributes] = cookie.split(';');
    const name = pair?.split('=')[0]?.trim() ?? 'cookie';
    const lower = attributes.map((attribute) => attribute.trim().toLowerCase());
    if (!lower.some((attribute) => attribute.startsWith('httponly'))) {
      findings.push(
        createFinding({
          checkId: 'http.cookies',
          title: `Cookie "${name}" is missing HttpOnly`,
          description: 'A response cookie is readable from JavaScript.',
          severity: 'medium',
          confidence: 'high',
          verification: 'observed',
          category: 'http',
          impact: 'Any XSS on the site can steal this cookie and hijack the session.',
          remediation: 'Set HttpOnly on session and authentication cookies.',
          evidence: [{ kind: 'text', label: 'Cookie name', value: name }],
          key: `cookie:httponly:${name}`,
        }),
      );
    }
    if (isHttps && !lower.some((attribute) => attribute.startsWith('secure'))) {
      findings.push(
        createFinding({
          checkId: 'http.cookies',
          title: `Cookie "${name}" is missing Secure`,
          description: 'An HTTPS response sets a cookie without the Secure attribute.',
          severity: 'medium',
          confidence: 'high',
          verification: 'observed',
          category: 'http',
          impact: 'The cookie can be sent over plaintext HTTP and intercepted.',
          remediation: 'Add the Secure attribute to all cookies on HTTPS sites.',
          evidence: [{ kind: 'text', label: 'Cookie name', value: name }],
          key: `cookie:secure:${name}`,
        }),
      );
    }
    if (!lower.some((attribute) => attribute.startsWith('samesite'))) {
      findings.push(
        createFinding({
          checkId: 'http.cookies',
          title: `Cookie "${name}" has no SameSite policy`,
          description:
            'The cookie does not declare SameSite, leaving cross-site sending behavior to browser defaults.',
          severity: 'low',
          confidence: 'high',
          verification: 'observed',
          category: 'http',
          impact: 'Cross-site request forgery protection is weaker and browser-dependent.',
          remediation:
            'Set SameSite=Lax or Strict unless the cookie is required for a cross-site flow.',
          evidence: [{ kind: 'text', label: 'Cookie name', value: name }],
          key: `cookie:samesite:${name}`,
        }),
      );
    }
  }
  return createCheck({
    id: 'http.cookies',
    title: 'Cookie security attributes',
    category: 'http',
    status: findings.some((f) => f.severity === 'high')
      ? 'fail'
      : findings.length > 0
        ? 'warn'
        : 'pass',
    summary:
      root.setCookies.length === 0
        ? 'The root response set no cookies.'
        : findings.length === 0
          ? `Reviewed ${root.setCookies.length} cookie(s); attributes look appropriate.`
          : `${findings.length} cookie attribute issue(s) found.`,
    findings,
    evidence: [{ kind: 'metric', label: 'Cookies set', value: String(root.setCookies.length) }],
    durationMs: Date.now() - started,
  });
}

async function checkCors(target: URL, client: HttpClient): Promise<CheckResult> {
  const started = Date.now();
  const origin = 'https://launchproof.invalid';
  let response: HttpResponseRecord;
  try {
    response = await client.request(target.toString(), {
      headers: { origin, 'access-control-request-method': 'GET' },
    });
  } catch (error) {
    return createCheck({
      id: 'http.cors',
      title: 'CORS policy',
      category: 'http',
      status: 'not-verified',
      summary: 'CORS behavior could not be tested.',
      error: error instanceof Error ? error.message : 'Request failed',
      durationMs: Date.now() - started,
    });
  }
  const acao = response.headers['access-control-allow-origin'];
  const acac = response.headers['access-control-allow-credentials'];
  const findings: Finding[] = [];
  if (acao === '*' && acac?.toLowerCase() === 'true') {
    findings.push(
      createFinding({
        checkId: 'http.cors',
        title: 'Wildcard CORS with credentials',
        description: 'The server allows any origin together with credentials.',
        severity: 'high',
        confidence: 'high',
        verification: 'observed',
        category: 'http',
        impact:
          'Any website can make authenticated cross-origin requests and read the responses where browsers permit it.',
        remediation:
          'Replace the wildcard with an allowlist of trusted origins and never combine credentials with "*".',
        evidence: [
          { kind: 'header', label: 'Access-Control-Allow-Origin', value: acao },
          { kind: 'header', label: 'Access-Control-Allow-Credentials', value: acac },
        ],
        key: 'cors:wildcard-credentials',
      }),
    );
  } else if (acao === '*') {
    findings.push(
      createFinding({
        checkId: 'http.cors',
        title: 'CORS allows any origin',
        description: 'The server returns Access-Control-Allow-Origin: * for a random origin.',
        severity: 'medium',
        confidence: 'high',
        verification: 'observed',
        category: 'http',
        impact:
          'Public data can be read from any website. The risk grows if the API later adds credentials.',
        remediation: 'Return an allowlist-matched origin instead of "*"',
        evidence: [{ kind: 'header', label: 'Access-Control-Allow-Origin', value: acao }],
        key: 'cors:wildcard',
      }),
    );
  } else if (acao === origin) {
    findings.push(
      createFinding({
        checkId: 'http.cors',
        title: 'CORS reflects arbitrary origins',
        description:
          'The server reflected a random Origin header without validating it against an allowlist.',
        severity: acac?.toLowerCase() === 'true' ? 'high' : 'low',
        confidence: 'high',
        verification: 'observed',
        category: 'http',
        impact:
          acac?.toLowerCase() === 'true'
            ? 'Any website can read authenticated responses from this API.'
            : 'Any website can read public responses from this API.',
        remediation:
          'Validate the Origin header against an explicit allowlist before reflecting it.',
        evidence: [
          { kind: 'header', label: 'Access-Control-Allow-Origin', value: acao },
          { kind: 'header', label: 'Access-Control-Allow-Credentials', value: acac ?? 'absent' },
        ],
        key: 'cors:reflected',
      }),
    );
  }
  return createCheck({
    id: 'http.cors',
    title: 'CORS policy',
    category: 'http',
    status: findings.some((f) => f.severity === 'high')
      ? 'fail'
      : findings.length > 0
        ? 'warn'
        : 'pass',
    summary:
      findings.length === 0
        ? 'A random origin was not granted cross-origin access.'
        : `${findings.length} permissive CORS behavior(s) observed.`,
    findings,
    evidence: [{ kind: 'header', label: 'Tested Origin', value: origin }],
    durationMs: Date.now() - started,
  });
}

function checkTransport(target: URL, root: HttpResponseRecord, isHttps: boolean): CheckResult {
  const local = isLoopbackHost(target.hostname);
  const encrypted = isHttps || root.finalUrl.startsWith('https:');
  const findings: Finding[] = [];
  if (!encrypted && !local) {
    findings.push(
      createFinding({
        checkId: 'http.transport',
        title: 'Site is served over plaintext HTTP',
        description: 'The target did not use HTTPS and did not redirect to an HTTPS origin.',
        severity: 'medium',
        confidence: 'high',
        verification: 'observed',
        category: 'http',
        impact: 'Traffic, cookies, and credentials can be intercepted or modified on the network.',
        remediation: 'Serve all traffic over HTTPS and redirect HTTP requests permanently.',
        evidence: [{ kind: 'http', label: 'Final URL', value: root.finalUrl }],
        key: 'transport:plaintext',
      }),
    );
  }
  return createCheck({
    id: 'http.transport',
    title: 'Transport encryption',
    category: 'http',
    status: findings.length > 0 ? 'warn' : 'pass',
    summary: encrypted
      ? 'The target uses HTTPS. Certificate validity and protocol versions were not independently assessed.'
      : local
        ? 'Loopback target uses HTTP; transport encryption is not applicable to local development.'
        : 'The target is served over HTTP.',
    findings,
    evidence: [{ kind: 'http', label: 'Final URL', value: root.finalUrl }],
    details: isHttps
      ? 'LaunchProof does not validate certificate chains in this version; use an external TLS scanner for certificate and protocol coverage.'
      : undefined,
    durationMs: 0,
  });
}

async function checkExposure(
  target: URL,
  client: HttpClient,
  config: LaunchProofConfig,
): Promise<CheckResult> {
  const started = Date.now();
  if (!config.http.checkSensitivePaths) {
    return createCheck({
      id: 'http.exposure',
      title: 'Sensitive path exposure',
      category: 'http',
      status: 'skipped',
      summary: 'Sensitive path probing is disabled in configuration.',
      durationMs: 0,
    });
  }
  const findings: Finding[] = [];
  const probed: string[] = [];
  const targets = [...EXPOSURES];
  for (const extra of config.http.extraPaths) {
    targets.push({
      path: extra,
      label: 'Custom sensitive path',
      severity: 'medium',
      description: 'A configured sensitive path is publicly reachable.',
      validate: (response) =>
        response.status === 200 && !/<html/i.test(response.bodyText.slice(0, 200)),
    });
  }
  for (const candidate of targets.slice(0, 10)) {
    probed.push(candidate.path);
    const url = new URL(candidate.path, target.origin);
    try {
      const response = await client.request(url.toString());
      if (!candidate.validate(response)) {
        continue;
      }
      const evidence: Evidence[] = [
        { kind: 'http', label: 'Status', value: String(response.status) },
        { kind: 'http', label: 'Content-Type', value: response.contentType || 'unknown' },
        {
          kind: 'text',
          label: 'Validation',
          value: `Content matched the expected signature for ${candidate.label}.`,
        },
      ];
      findings.push(
        createFinding({
          checkId: 'http.exposure',
          title: `${candidate.label} is publicly accessible`,
          description: candidate.description,
          severity: candidate.severity,
          confidence: 'high',
          verification: 'observed',
          category: 'http',
          impact:
            candidate.severity === 'critical'
              ? 'Direct access to credentials or source can lead to full compromise.'
              : 'Internal information is exposed to unauthenticated visitors.',
          remediation:
            'Block the path at the edge or web server, remove the file from the deployed artifact, and confirm with an unauthenticated request.',
          evidence,
          location: { url: `${target.origin}${candidate.path}` },
          references: ['https://cwe.mitre.org/data/definitions/538.html'],
          key: `exposure:${candidate.path}`,
        }),
      );
    } catch {
      // A blocked or failed request is not evidence of exposure.
    }
  }
  return createCheck({
    id: 'http.exposure',
    title: 'Sensitive path exposure',
    category: 'http',
    status: findings.some((f) => f.severity === 'high' || f.severity === 'critical')
      ? 'fail'
      : findings.length > 0
        ? 'warn'
        : 'pass',
    summary:
      findings.length === 0
        ? `No sensitive paths responded with matching content across ${probed.length} probes.`
        : `${findings.length} sensitive path(s) are publicly reachable.`,
    findings,
    evidence: [{ kind: 'text', label: 'Paths probed', value: probed.join(', ') }],
    details:
      'Only a small, fixed list of common paths is probed. A clean result does not prove that no sensitive file is exposed.',
    durationMs: Date.now() - started,
  });
}

async function checkErrorHandling(
  target: URL,
  client: HttpClient,
  root: HttpResponseRecord,
): Promise<CheckResult> {
  const started = Date.now();
  const findings: Finding[] = [];
  if (root.status >= 500) {
    findings.push(
      createFinding({
        checkId: 'http.errors',
        title: `Root page returned HTTP ${root.status}`,
        description: 'The primary page responds with a server error.',
        severity: 'high',
        confidence: 'high',
        verification: 'observed',
        category: 'http',
        impact:
          'Users cannot reach the application, and the error may indicate an unstable deployment.',
        remediation:
          'Inspect server logs and fix the failing dependency or configuration before release.',
        evidence: [{ kind: 'http', label: 'Status', value: `${root.status} ${root.statusText}` }],
        key: 'errors:root-5xx',
      }),
    );
  }
  const marker = `/launchproof-not-found-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const response = await client.request(new URL(marker, target.origin).toString());
    const stackMarkers =
      /at\s+[\w$.]+\s+\(?[^)\n]*:\d+:\d+\)?|node_modules[\\/]|Traceback \(most recent call last\)|SQLSTATE|SequelizeDatabaseError|PrismaClientKnownRequestError|stack trace/i;
    if (stackMarkers.test(response.bodyText)) {
      findings.push(
        createFinding({
          checkId: 'http.errors',
          title: 'Error responses disclose internal details',
          description:
            'A request to a random path returned content containing stack-trace or internal error markers.',
          severity: 'medium',
          confidence: 'medium',
          verification: 'observed',
          category: 'http',
          impact:
            'File paths, framework versions, and internal logic help attackers target exploits.',
          remediation:
            'Disable debug error pages in production and return a generic error response with a correlation ID.',
          evidence: [
            { kind: 'http', label: 'Probe', value: marker },
            { kind: 'http', label: 'Status', value: String(response.status) },
            {
              kind: 'text',
              label: 'Validation',
              value: 'Body contained stack-trace or internal error markers.',
            },
          ],
          key: 'errors:stack-trace',
        }),
      );
    }
  } catch {
    // No conclusion from a failed probe.
  }
  return createCheck({
    id: 'http.errors',
    title: 'Error handling and information disclosure',
    category: 'http',
    status: findings.some((f) => f.severity === 'high')
      ? 'fail'
      : findings.length > 0
        ? 'warn'
        : 'pass',
    summary:
      findings.length === 0
        ? 'No server error or stack-trace leakage was observed in the reviewed responses.'
        : `${findings.length} error-handling issue(s) observed.`,
    findings,
    durationMs: Date.now() - started,
  });
}

export function describeTarget(target: URL): string {
  return `${target.origin}${target.pathname === '/' ? '' : target.pathname}`;
}

export function truncateBody(body: string, max = 300): string {
  return truncate(body, max);
}
