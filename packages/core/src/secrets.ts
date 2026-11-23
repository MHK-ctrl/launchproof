import path from 'node:path';

import type { LaunchProofConfig } from './config/schema.js';
import { createCheck, createFinding } from './checks.js';
import type { DiscoveryResult } from './discovery.js';
import type { CheckResult, Finding } from './types.js';
import { isScannableTextFile } from './text-cache.js';
import type { GitHistoryEntry } from './git.js';
import {
  lineAndColumnAt,
  looksLikePlaceholder,
  maskSecret,
  shannonEntropy,
  truncate,
} from './util.js';

interface SecretRule {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium';
  regex: RegExp;
  description: string;
}

const SECRET_RULES: SecretRule[] = [
  {
    id: 'aws-access-key',
    title: 'AWS access key ID detected',
    severity: 'critical',
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    description: 'A string matching the AWS access key ID format was found in project files.',
  },
  {
    id: 'private-key',
    title: 'Private key material detected',
    severity: 'critical',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g,
    description: 'A PEM private key block was found in project files.',
  },
  {
    id: 'github-token',
    title: 'GitHub token detected',
    severity: 'critical',
    regex: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/g,
    description: 'A string matching a GitHub personal access or app token was found.',
  },
  {
    id: 'stripe-live-key',
    title: 'Stripe live secret key detected',
    severity: 'critical',
    regex: /\b(?:sk|rk)_live_[0-9A-Za-z]{20,}\b/g,
    description: 'A Stripe live secret key was found in project files.',
  },
  {
    id: 'openai-key',
    title: 'AI provider API key detected',
    severity: 'high',
    regex: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{24,}\b/g,
    description: 'A string matching an OpenAI or Anthropic style API key was found.',
  },
  {
    id: 'slack-token',
    title: 'Slack token detected',
    severity: 'high',
    regex: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g,
    description: 'A string matching a Slack access token was found.',
  },
  {
    id: 'google-api-key',
    title: 'Google API key detected',
    severity: 'high',
    regex: /\bAIza[0-9A-Za-z_-]{35}\b/g,
    description: 'A string matching a Google API key was found.',
  },
  {
    id: 'npm-token',
    title: 'npm token detected',
    severity: 'critical',
    regex: /\bnpm_[A-Za-z0-9]{36}\b/g,
    description: 'A string matching an npm access token was found.',
  },
  {
    id: 'sendgrid-key',
    title: 'SendGrid API key detected',
    severity: 'critical',
    regex: /\bSG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g,
    description: 'A string matching a SendGrid API key was found.',
  },
];

const GENERIC_ASSIGNMENT =
  /\b(api[_-]?key|apikey|secret|client[_-]?secret|access[_-]?token|auth[_-]?token|refresh[_-]?token|password|passwd|private[_-]?key|service[_-]?role(?:[_-]?key)?)\b\s*[:=]\s*(['"`])([^'"`\n]{12,300})\2/gi;

const PUBLIC_ENV_NAMES =
  /(?:NEXT_PUBLIC_|PUBLIC_|VITE_|EXPO_PUBLIC_|REACT_APP_|NUXT_PUBLIC_|ANON_KEY|PUBLISHABLE_KEY)/i;

const EXAMPLE_PATH = /(?:^|\/)(?:examples?|fixtures?|tests?|docs?|samples?|__tests__)(?:\/|$)/i;

interface SecretMatch {
  ruleId: string;
  title: string;
  severity: 'critical' | 'high' | 'medium';
  description: string;
  index: number;
  maskedValue: string;
  publicValue: boolean;
}

function decodeJwtRole(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  try {
    const payload = parts[1] ?? '';
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded) as unknown;
    if (parsed && typeof parsed === 'object' && 'role' in parsed) {
      const role = (parsed as { role?: unknown }).role;
      return typeof role === 'string' ? role : null;
    }
  } catch {
    return null;
  }
  return null;
}

function findJwtMatches(text: string): SecretMatch[] {
  const matches: SecretMatch[] = [];
  for (const match of text.matchAll(
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  )) {
    const token = match[0];
    const role = decodeJwtRole(token);
    if (role === 'service_role') {
      matches.push({
        ruleId: 'supabase-service-role',
        title: 'Supabase service-role JWT detected',
        severity: 'critical',
        description:
          'A JWT with the service_role claim was found. It bypasses row-level security and must never reach client code or a repository.',
        index: match.index ?? 0,
        maskedValue: maskSecret(),
        publicValue: false,
      });
    }
  }
  return matches;
}

function scanTextForSecrets(text: string): SecretMatch[] {
  const matches: SecretMatch[] = [];
  for (const rule of SECRET_RULES) {
    rule.regex.lastIndex = 0;
    for (const match of text.matchAll(rule.regex)) {
      matches.push({
        ruleId: rule.id,
        title: rule.title,
        severity: rule.severity,
        description: rule.description,
        index: match.index ?? 0,
        maskedValue: maskSecret(),
        publicValue: false,
      });
    }
  }
  matches.push(...findJwtMatches(text));

  GENERIC_ASSIGNMENT.lastIndex = 0;
  for (const match of text.matchAll(GENERIC_ASSIGNMENT)) {
    const keyName = match[1] ?? '';
    const value = match[3] ?? '';
    if (!looksLikePlaceholder(value) && shannonEntropy(value) >= 3.5 && value.length >= 16) {
      if (PUBLIC_ENV_NAMES.test(keyName) || PUBLIC_ENV_NAMES.test(value)) {
        continue;
      }
      matches.push({
        ruleId: 'generic-credential',
        title: `Possible hardcoded credential: ${keyName}`,
        severity: 'medium',
        description: `A high-entropy value was assigned to "${keyName}". Pattern matching can produce false positives; confirm before rotating.`,
        index: match.index ?? 0,
        maskedValue: maskSecret(),
        publicValue: false,
      });
    }
  }

  return matches.sort((a, b) => a.index - b.index);
}

export interface SecretsScanOptions {
  includeHistory?: boolean;
  historyEntries?: GitHistoryEntry[];
  trackedFiles?: Set<string> | null;
}

export async function runSecretsChecks(
  discovery: DiscoveryResult,
  config: LaunchProofConfig,
  options: SecretsScanOptions = {},
): Promise<CheckResult[]> {
  const started = Date.now();
  const findings: Finding[] = [];
  const files = discovery.files.filter(
    (file) => isScannableTextFile(file) && file.size <= config.scan.maxFileBytes,
  );
  let filesWithSecrets = 0;
  let truncated = false;

  for (const file of files) {
    if (findings.length >= 50) {
      truncated = true;
      break;
    }
    if (/(?:^|\/)\.env\.(?:example|sample|template)$/i.test(file.path)) {
      continue;
    }
    const text = await discovery.cache.text(file);
    if (!text) {
      continue;
    }
    const matches = scanTextForSecrets(text);
    if (matches.length === 0) {
      continue;
    }
    filesWithSecrets += 1;
    const seen = new Set<string>();
    for (const match of matches) {
      const location = lineAndColumnAt(text, match.index);
      const key = `${match.ruleId}:${location.line}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const inExample = EXAMPLE_PATH.test(file.path);
      const severity = inExample && match.severity !== 'critical' ? 'low' : match.severity;
      const lineContent = text.split('\n')[location.line - 1] ?? '';
      findings.push(
        createFinding({
          checkId: 'secrets.hardcoded',
          title: match.title,
          description: `${match.description} Pattern matching is indicative; a real credential must be confirmed and then rotated.`,
          severity,
          confidence: match.ruleId === 'generic-credential' ? 'low' : 'high',
          verification: 'pattern',
          category: 'secrets',
          impact:
            'Leaked credentials can allow unauthorized access to production data, billing, or infrastructure. Removing a file does not invalidate a credential that was exposed.',
          remediation:
            'Revoke and rotate the credential at the provider, remove it from source, load it from a secret manager or environment variable, and purge it from git history if it was committed.',
          evidence: [
            {
              kind: 'text',
              label: 'Matched line (value masked)',
              value: redactSecretLine(lineContent, match.maskedValue),
              redacted: true,
            },
            { kind: 'text', label: 'Rule', value: match.ruleId },
          ],
          location: { file: file.path, line: location.line, column: location.column },
          references: ['https://cwe.mitre.org/data/definitions/798.html'],
          key: `${file.path}:${location.line}:${match.ruleId}`,
        }),
      );
      if (findings.length >= 50) {
        truncated = true;
        break;
      }
    }
  }

  const summary =
    filesWithSecrets === 0
      ? `No credential patterns detected across ${files.length} scannable files.`
      : `${filesWithSecrets} file(s) contain credential-like patterns; values are masked in this report.`;
  const check = createCheck({
    id: 'secrets.hardcoded',
    title: 'Hardcoded secrets and credentials',
    category: 'secrets',
    status: truncated ? 'warn' : findings.length > 0 ? 'fail' : 'pass',
    summary: truncated ? `${summary} Results were capped at 50 findings.` : summary,
    findings,
    evidence: [
      { kind: 'metric', label: 'Files scanned', value: String(files.length) },
      { kind: 'metric', label: 'Files with matches', value: String(filesWithSecrets) },
    ],
    details: truncated
      ? 'The scan stopped after 50 credential findings; additional matches may exist.'
      : undefined,
    durationMs: Date.now() - started,
  });

  return [check, await runEnvHygieneCheck(discovery, options)];
}

function redactSecretLine(line: string, replacement: string): string {
  const trimmed = truncate(line.trim(), 220);
  if (trimmed.length === 0) {
    return replacement;
  }
  if (/[:=]/.test(trimmed)) {
    const index = trimmed.search(/[:=]/);
    return `${trimmed.slice(0, index + 1)} ${replacement}`;
  }
  return replacement;
}

async function runEnvHygieneCheck(
  discovery: DiscoveryResult,
  options: SecretsScanOptions,
): Promise<CheckResult> {
  const started = Date.now();
  const findings: Finding[] = [];
  const envFiles = discovery.files.filter((file) =>
    /(?:^|\/)\.env(?:\.(?:local|development|production|staging|test))?$/.test(file.path),
  );
  const tracked = options.trackedFiles ?? discovery.trackedFiles;

  for (const file of envFiles) {
    const trackedFile = tracked?.has(file.path) ?? false;
    findings.push(
      createFinding({
        checkId: 'secrets.env-hygiene',
        title: trackedFile
          ? 'Environment file is tracked by git'
          : 'Environment file is present in the working tree',
        description: trackedFile
          ? `${file.path} is tracked by git. Environment files commonly contain credentials and should not be committed.`
          : `${file.path} is not currently tracked, but must be ignored to prevent accidental commits. Values were not analyzed.`,
        severity: trackedFile ? 'critical' : 'medium',
        confidence: 'high',
        verification: 'observed',
        category: 'secrets',
        impact:
          'A committed environment file exposes every credential it contains to anyone with repository access, including forks and historical clones.',
        remediation:
          'Add .env* to .gitignore, remove the file from the index with "git rm --cached", rotate exposed values, and share safe defaults through .env.example.',
        evidence: [{ kind: 'file', label: 'Environment file', value: file.path }],
        location: { file: file.path },
        key: `env:${file.path}:${trackedFile ? 'tracked' : 'untracked'}`,
      }),
    );
  }

  const gitignore = discovery.files.find((file) => file.path === '.gitignore');
  const gitignoreText = gitignore ? await discovery.cache.text(gitignore) : null;
  if (envFiles.length > 0) {
    const coversEnv =
      gitignoreText !== null && /^\s*(?:\*\*\/)?\.env(?:\.\*|\*|\/?\s*$)/m.test(gitignoreText);
    if (!coversEnv) {
      findings.push(
        createFinding({
          checkId: 'secrets.env-hygiene',
          title: 'Environment files are not covered by .gitignore',
          description:
            'A .env file exists, but .gitignore does not contain a rule that ignores .env files.',
          severity: 'high',
          confidence: 'high',
          verification: 'observed',
          category: 'secrets',
          impact: 'An ordinary "git add ." could commit live credentials.',
          remediation: 'Add ".env" and ".env.*" (with "!.env.example") to .gitignore.',
          evidence: [
            {
              kind: 'file',
              label: 'Existing env files',
              value: envFiles.map((f) => f.path).join(', '),
            },
          ],
          location: { file: '.gitignore' },
          key: 'env:gitignore-missing',
        }),
      );
    }
  }

  const history = options.includeHistory ? (options.historyEntries ?? []) : [];
  for (const entry of history.slice(0, 5)) {
    findings.push(
      createFinding({
        checkId: 'secrets.env-hygiene',
        title: 'Sensitive file was added in git history',
        description: `${entry.file} appears in the history of commit ${entry.commit.slice(0, 10)}. This is a filename-level check; contents were not analyzed.`,
        severity: 'high',
        confidence: 'medium',
        verification: 'observed',
        category: 'secrets',
        impact:
          'Sensitive files in history remain retrievable even after deletion from the current tree.',
        remediation:
          'Rotate any credentials the file may have contained and rewrite history with a tool such as git-filter-repo if the repository was shared.',
        evidence: [
          { kind: 'text', label: 'File', value: entry.file },
          { kind: 'text', label: 'Commit', value: entry.commit },
          ...(entry.date ? [{ kind: 'text' as const, label: 'Authored', value: entry.date }] : []),
        ],
        location: { file: entry.file },
        key: `history:${entry.file}:${entry.commit}`,
      }),
    );
  }

  return createCheck({
    id: 'secrets.env-hygiene',
    title: 'Environment file and git hygiene',
    category: 'secrets',
    status: findings.some(
      (finding) => finding.severity === 'critical' || finding.severity === 'high',
    )
      ? 'fail'
      : findings.length > 0
        ? 'warn'
        : 'pass',
    summary:
      findings.length === 0
        ? 'Environment files are ignored and no sensitive filenames were found in reachable history.'
        : `${findings.length} environment or git hygiene issue(s) found.`,
    findings,
    evidence: [
      { kind: 'metric', label: 'Environment files on disk', value: String(envFiles.length) },
      {
        kind: 'metric',
        label: 'Git history inspected',
        value: options.includeHistory ? 'yes' : 'no',
      },
    ],
    details: options.includeHistory
      ? 'History checks are filename-based and limited to the configured number of commits; historical file contents are not scanned.'
      : 'Git history scanning is disabled by default. Enable scan.gitHistory to check sensitive filenames in history.',
    durationMs: Date.now() - started,
  });
}

export function envFileBasename(filePath: string): string {
  return path.basename(filePath);
}
