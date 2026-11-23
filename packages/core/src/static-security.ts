import type { LaunchProofConfig } from './config/schema.js';
import { createCheck, createFinding } from './checks.js';
import type { DiscoveryResult } from './discovery.js';
import type { CheckResult, Confidence, Finding, Severity } from './types.js';
import { isCodeFile } from './text-cache.js';
import { lineAndColumnAt, truncate } from './util.js';

interface StaticRule {
  id: string;
  title: string;
  severity: Severity;
  confidence: Confidence;
  category: 'security' | 'configuration';
  description: string;
  impact: string;
  remediation: string;
  pattern: RegExp;
  include?: RegExp;
  /** Skip a match when the whole line also matches this expression. */
  lineExclude?: RegExp;
  references?: string[];
  maxPerFile?: number;
}

const CODE_INCLUDE = /\.(?:ts|tsx|js|jsx|mjs|cjs|vue|svelte|py|rb|go|php|java|kt|cs)$/i;
const CONFIG_INCLUDE =
  /(?:next\.config\.(?:js|mjs|cjs|ts)|vercel\.json|netlify\.toml|launchproof\.config\.(?:json|ya?ml))$/i;

const RULES: StaticRule[] = [
  {
    id: 'eval',
    title: 'Dynamic code execution with eval()',
    severity: 'high',
    confidence: 'medium',
    category: 'security',
    description:
      'eval() executes strings as code. Untrusted input reaching eval() is remote code execution.',
    impact:
      "An attacker who influences the evaluated string can execute arbitrary code with the application's privileges.",
    remediation: 'Remove eval(). Use explicit parsers, lookup tables, or JSON.parse for data.',
    // Require a non-empty argument and skip identifiers such as Playwright's $$eval.
    pattern: /(?<![\w$.])eval\s*\(\s*[^)\s]/g,
    include: CODE_INCLUDE,
    references: ['https://cwe.mitre.org/data/definitions/95.html'],
  },
  {
    id: 'new-function',
    title: 'Dynamic code execution with new Function()',
    severity: 'high',
    confidence: 'medium',
    category: 'security',
    description:
      'The Function constructor compiles strings into executable code and bypasses many static controls.',
    impact: 'Untrusted input can become arbitrary code execution or a CSP bypass.',
    remediation:
      'Replace dynamic function construction with explicit logic or a safe expression evaluator.',
    pattern: /\bnew\s+Function\s*\(\s*[^)\s]/g,
    include: CODE_INCLUDE,
    references: ['https://cwe.mitre.org/data/definitions/95.html'],
  },
  {
    id: 'dangerous-html',
    title: 'Raw HTML rendering via dangerouslySetInnerHTML',
    severity: 'medium',
    confidence: 'medium',
    category: 'security',
    description:
      'dangerouslySetInnerHTML bypasses React escaping. If the value is user-controlled or markdown-derived, it can become stored XSS.',
    impact: "Script execution in victims' browsers, session theft, and account takeover.",
    remediation:
      'Render text normally. If HTML is required, sanitize with a maintained allowlist sanitizer and add a restrictive CSP.',
    pattern: /dangerouslySetInnerHTML\s*[:=]/g,
    include: CODE_INCLUDE,
    references: ['https://cwe.mitre.org/data/definitions/79.html'],
  },
  {
    id: 'innerhtml',
    title: 'Unescaped innerHTML assignment',
    severity: 'medium',
    confidence: 'medium',
    category: 'security',
    description:
      'Assigning non-literal content to innerHTML inserts it as HTML. User-controlled values can execute scripts.',
    impact: 'Cross-site scripting in the affected page.',
    remediation: 'Use textContent for text, or sanitize HTML before insertion.',
    pattern: /\.innerHTML\s*=\s*(?!['"`])/g,
    include: CODE_INCLUDE,
    references: ['https://cwe.mitre.org/data/definitions/79.html'],
  },
  {
    id: 'shell-interpolation',
    title: 'Shell command built with string interpolation',
    severity: 'high',
    confidence: 'medium',
    category: 'security',
    description:
      'A child-process call receives an interpolated string. If any segment is user-controlled, it becomes command injection.',
    impact: 'Arbitrary command execution on the host running the application.',
    remediation:
      'Use execFile/spawn with an argument array and no shell. Validate arguments against an allowlist.',
    pattern: /\b(?:exec|execSync|spawn|spawnSync)\s*\(\s*`[^`]*\$\{/g,
    include: CODE_INCLUDE,
    references: ['https://cwe.mitre.org/data/definitions/78.html'],
  },
  {
    id: 'sql-interpolation',
    title: 'SQL query built with interpolation',
    severity: 'high',
    confidence: 'medium',
    category: 'security',
    description:
      'A database call receives an interpolated or concatenated string. This is the classic shape of SQL injection.',
    impact: 'Data exfiltration, authentication bypass, and data modification.',
    remediation:
      'Use parameterized queries or a query builder that binds parameters separately from SQL text.',
    pattern: /\b(?:query|execute|raw|sql)\s*\(\s*(?:`[^`]*\$\{|['"][^'"]*['"]\s*\+)/gi,
    include: CODE_INCLUDE,
    references: ['https://cwe.mitre.org/data/definitions/89.html'],
  },
  {
    id: 'cors-wildcard',
    title: 'Permissive CORS origin wildcard',
    severity: 'medium',
    confidence: 'medium',
    category: 'security',
    description:
      'A wildcard Access-Control-Allow-Origin header or cors() origin setting allows any website to read responses.',
    impact:
      'Authenticated data can be read cross-origin when combined with weak credential handling.',
    remediation: 'Allow only explicit, trusted origins and validate the Origin header server-side.',
    pattern: /(?:Access-Control-Allow-Origin['"]?\s*[:,]\s*['"]\*['"]|origin\s*:\s*['"]\*['"])/g,
    include: /\.(?:ts|tsx|js|jsx|mjs|cjs|py|rb|go|php|java|conf|json|ya?ml)$/i,
    references: ['https://cwe.mitre.org/data/definitions/942.html'],
  },
  {
    id: 'tls-disabled',
    title: 'TLS certificate verification disabled',
    severity: 'high',
    confidence: 'high',
    category: 'security',
    description:
      'TLS verification is explicitly disabled, allowing man-in-the-middle interception of traffic.',
    impact: 'Credentials and data can be intercepted by anyone on the network path.',
    remediation:
      'Remove the override. Trust the correct CA locally instead of disabling verification.',
    pattern: /(?:rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*[:=]\s*['"]?0)/g,
    include: /\.(?:ts|tsx|js|jsx|mjs|cjs|env|sh|ya?ml|json)$/i,
    references: ['https://cwe.mitre.org/data/definitions/295.html'],
  },
  {
    id: 'service-role-client',
    title: 'Service-role key environment variable referenced in a client component',
    severity: 'critical',
    confidence: 'high',
    category: 'security',
    description:
      'A client component references a service-role or admin key environment variable. Client code is bundled for the browser and cannot keep this secret.',
    impact:
      'Full database access from the client, including reads and writes the user should never perform.',
    remediation:
      'Keep service-role keys server-only. Use the anon key with RLS in browser code and a server route for privileged operations.',
    pattern:
      /(?:process\.env\.|import\.meta\.env\.)[A-Za-z0-9_]*(?:SERVICE_ROLE|SUPABASE_SERVICE|ADMIN_SECRET|MASTER_KEY)[A-Za-z0-9_]*/g,
    include: /\.(?:ts|tsx|js|jsx|mjs|cjs)$/i,
    references: ['https://supabase.com/docs/guides/api/api-keys'],
  },
  {
    id: 'env-logging',
    title: 'Environment object written to logs',
    severity: 'medium',
    confidence: 'medium',
    category: 'security',
    description:
      'A console call logs process.env. This can copy credentials into logs and error trackers.',
    impact: 'Secrets persist in log storage and third-party monitoring systems.',
    remediation: 'Log explicit, non-sensitive fields and redact structured logs centrally.',
    pattern: /console\.(?:log|info|debug|error)\(\s*process\.env/g,
    include: CODE_INCLUDE,
    references: ['https://cwe.mitre.org/data/definitions/532.html'],
  },
  {
    id: 'unsafe-browser-provider',
    title: 'AI provider client allowed to run in the browser',
    severity: 'high',
    confidence: 'high',
    category: 'security',
    description: 'dangerouslyAllowBrowser exposes the provider API key to every visitor.',
    impact: "API keys can be extracted and abused at the owner's expense.",
    remediation: 'Call the provider from a server route and keep the key server-side.',
    pattern: /dangerouslyAllowBrowser\s*:\s*true/g,
    include: CODE_INCLUDE,
  },
  {
    id: 'build-errors-ignored',
    title: 'Type or lint errors ignored during production build',
    severity: 'medium',
    confidence: 'high',
    category: 'configuration',
    description:
      'The build is configured to ignore type or lint failures, so deployment can proceed with broken code.',
    impact:
      'Production can ship with unresolved type errors and unsafe patterns that CI would have caught.',
    remediation:
      'Remove ignoreBuildErrors/ignoreDuringBuilds and fix the underlying errors before deployment.',
    pattern: /(?:ignoreBuildErrors|ignoreDuringBuilds)\s*:\s*true/g,
    include: CONFIG_INCLUDE,
  },
  {
    id: 'debug-production',
    title: 'Debug flag enabled in configuration',
    severity: 'low',
    confidence: 'low',
    category: 'configuration',
    description:
      'A debug flag is enabled in a committed configuration file. Verify it is not active in production.',
    impact: 'Debug output can expose stack traces, queries, or internal state.',
    remediation: 'Default debug to false and enable it only through local environment variables.',
    pattern: /\bdebug\s*[:=]\s*true/g,
    include: /(?:\.(?:json|ya?ml|toml|ini|conf)|\.env\.(?:example|sample|template))$/i,
    lineExclude: /(?:DEBUG\s*[:=]\s*false)/,
  },
];

export interface StaticSecurityOptions {
  /** Restrict scanning to security or configuration rules. */
  categories?: Array<'security' | 'configuration'>;
}

export async function runStaticSecurityChecks(
  discovery: DiscoveryResult,
  config: LaunchProofConfig,
  options: StaticSecurityOptions = {},
): Promise<CheckResult[]> {
  const started = Date.now();
  const findings: Finding[] = [];
  const rules = RULES.filter(
    (rule) => !options.categories || options.categories.includes(rule.category),
  );
  const files = discovery.files.filter(
    (file) =>
      (isCodeFile(file) || /\.(?:json|ya?ml|toml|conf|env)$/i.test(file.path)) &&
      file.size <= config.scan.maxFileBytes,
  );
  let matchedFiles = 0;
  let capped = false;

  for (const file of files) {
    if (findings.length >= 60) {
      capped = true;
      break;
    }
    const applicable = rules.filter((rule) => !rule.include || rule.include.test(file.path));
    if (applicable.length === 0) {
      continue;
    }
    const text = await discovery.cache.text(file);
    if (!text) {
      continue;
    }
    let fileMatched = false;
    const isClientComponent = /^\s*['"]use client['"]/m.test(text);
    for (const rule of applicable) {
      if (rule.id === 'service-role-client' && !isClientComponent) {
        continue;
      }
      rule.pattern.lastIndex = 0;
      let fileRuleMatches = 0;
      for (const match of text.matchAll(rule.pattern)) {
        if (findings.length >= 60) {
          capped = true;
          break;
        }
        if (fileRuleMatches >= (rule.maxPerFile ?? 4)) {
          break;
        }
        const index = match.index ?? 0;
        const location = lineAndColumnAt(text, index);
        const line = text.split('\n')[location.line - 1] ?? '';
        if (rule.lineExclude?.test(line)) {
          continue;
        }
        fileRuleMatches += 1;
        fileMatched = true;
        findings.push(
          createFinding({
            checkId: 'security.static',
            title: rule.title,
            description: `${rule.description} This is a heuristic pattern match on source code, not proof of exploitability.`,
            severity: rule.severity,
            confidence: rule.confidence,
            verification: 'pattern',
            category: rule.category,
            impact: rule.impact,
            remediation: rule.remediation,
            evidence: [
              {
                kind: 'text',
                label: 'Matched line',
                value: truncate(line.trim(), 220),
              },
            ],
            location: { file: file.path, line: location.line, column: location.column },
            references: rule.references,
            key: `${rule.id}:${file.path}:${location.line}`,
          }),
        );
      }
    }
    if (fileMatched) {
      matchedFiles += 1;
    }
  }

  const securityFindings = findings.filter((finding) => finding.category === 'security');
  const configurationFindings = findings.filter((finding) => finding.category === 'configuration');

  const checks: CheckResult[] = [
    createCheck({
      id: 'security.static',
      title: 'Static security review',
      category: 'security',
      status: capped ? 'warn' : securityFindings.length > 0 ? 'fail' : 'pass',
      summary:
        securityFindings.length === 0
          ? `No risky source patterns matched across ${files.length} text files. This is not a proof of security.`
          : `${securityFindings.length} risky source pattern(s) matched in ${matchedFiles} file(s). Findings require manual confirmation.`,
      findings: securityFindings,
      evidence: [
        { kind: 'metric', label: 'Rules evaluated', value: String(rules.length) },
        { kind: 'metric', label: 'Files inspected', value: String(files.length) },
      ],
      details: capped
        ? 'Finding output was capped at 60. Additional matches may exist.'
        : 'Static rules are heuristics for human review; they do not execute or prove exploitability.',
      durationMs: Date.now() - started,
    }),
  ];

  if (configurationFindings.length > 0 || !options.categories) {
    checks.push(
      createCheck({
        id: 'configuration.build-safety',
        title: 'Build and configuration safety',
        category: 'configuration',
        status: configurationFindings.length > 0 ? 'warn' : 'pass',
        summary:
          configurationFindings.length === 0
            ? 'No unsafe build or debug configuration flags detected.'
            : `${configurationFindings.length} configuration flag(s) deserve review before release.`,
        findings: configurationFindings,
        durationMs: 0,
      }),
    );
  }

  return checks;
}

export function staticRuleCount(): number {
  return RULES.length;
}
