import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';

import type { Severity } from './types.js';

const REDACTED = '****REDACTED****';

const REDACTION_RULES: Array<[RegExp, string]> = [
  [/(authorization\s*:\s*(?:bearer|basic|token)\s+)[^\s"',;}]+/gi, '$1****REDACTED****'],
  [/\b(Bearer\s+)[A-Za-z0-9._~+/-]{12,}=*/g, '$1****REDACTED****'],
  [
    /((?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|passwd|service[_-]?role[_-]?key)\s*[:=]\s*["']?)[^"'\s,}]{8,}/gi,
    '$1****REDACTED****',
  ],
  [/\bAKIA[0-9A-Z]{16}\b/g, '****REDACTED****'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '****REDACTED****'],
  [/\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{10,}\b/g, '****REDACTED****'],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '****REDACTED****'],
  [/\bgithub_pat_[A-Za-z0-9_]{22,}\b/g, '****REDACTED****'],
  [/\bnpm_[A-Za-z0-9]{36}\b/g, '****REDACTED****'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, '****REDACTED****'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/g, '****REDACTED****'],
  [/\bSG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g, '****REDACTED****'],
];

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function shortHash(value: string, length = 10): string {
  return sha256(value).slice(0, length).toUpperCase();
}

export function findingId(checkId: string, key: string): string {
  return `FND-${shortHash(`${checkId}\u0000${key}`, 8)}`;
}

export function createScanId(now = new Date()): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, '')
    .replace('T', '-');
  return `LP-${stamp}-${randomBytes(2).toString('hex').toUpperCase()}`;
}

export function truncate(value: string, max = 500, suffix = '…'): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, Math.max(0, max - suffix.length))}${suffix}`;
}

export function maskSecret(): string {
  return REDACTED;
}

/** Removes terminal control sequences before text is written to a terminal or report. */
export function stripControlChars(value: string): string {
  return (
    value
      // Control characters are the target of this sanitizer.
      // eslint-disable-next-line no-control-regex
      .replace(/\u001B\][^\u0007]*(?:\u0007|\u001B\\)/g, '')
      // eslint-disable-next-line no-control-regex
      .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, '')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
  );
}

/** Applies conservative credential redaction to free text before it reaches a report or log. */
export function redactText(value: string): string {
  let output = value;
  for (const [pattern, replacement] of REDACTION_RULES) {
    output = output.replace(pattern, replacement);
  }
  return stripControlChars(output);
}

export function redactUrl(input: string): string {
  try {
    const url = new URL(input);
    url.username = '';
    url.password = '';
    const sensitive = /(?:token|key|secret|password|passwd|auth|sig|signature|session)/i;
    for (const key of [...url.searchParams.keys()]) {
      if (sensitive.test(key)) {
        url.searchParams.set(key, REDACTED);
      }
    }
    return url.toString();
  } catch {
    return redactText(input);
  }
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function shannonEntropy(value: string): number {
  if (value.length === 0) {
    return 0;
  }
  const counts = new Map<string, number>();
  for (const char of value) {
    counts.set(char, (counts.get(char) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / value.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

const PLACEHOLDER_PATTERNS = [
  /example/i,
  /sample/i,
  /dummy/i,
  /placeholder/i,
  /changeme/i,
  /change[-_]me/i,
  /your[-_]?(?:key|token|secret|password|api)/i,
  /replace[-_]?me/i,
  /not[-_]?real/i,
  /^fake/i,
  /redacted/i,
  /x{4,}/i,
  /<[^>]+>/,
  /\$\{[^}]+\}/,
  /\{\{[^}]+\}\}/,
  /process\.env\./,
  /os\.environ/,
  /^0+$/,
  /^[a*]+$/i,
];

const PLACEHOLDER_VALUES = new Set([
  'password',
  'password123',
  'secret',
  'test',
  'test123',
  'token',
  'apikey',
  'api_key',
  'undefined',
  'null',
  'true',
  'false',
]);

/** Heuristic guard against reporting documentation placeholders as leaked credentials. */
export function looksLikePlaceholder(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 8) {
    return true;
  }
  if (PLACEHOLDER_VALUES.has(trimmed.toLowerCase())) {
    return true;
  }
  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return true;
  }
  const unique = new Set(trimmed).size;
  return unique <= 3;
}

export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host === '[::1]' ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
  );
}

export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  if (host === 'metadata.google.internal' || host === 'metadata' || host === '169.254.169.254') {
    return true;
  }
  if (host === '::1' || host === 'localhost' || host.endsWith('.localhost')) {
    return true;
  }
  if (host.endsWith('.local') || host.endsWith('.internal')) {
    return true;
  }
  if (host.includes(':')) {
    return host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80');
  }
  const parts = host.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }
  const [a, b] = parts as [number, number, number, number];
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

export function isMetadataHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'metadata.google.internal' || host === '169.254.169.254';
}

/**
 * Parses user-supplied targets, adding a default scheme only when it is unambiguous.
 * Credentials embedded in the URL are rejected so they can never be logged or stored.
 */
export function parseTargetUrl(input: string): URL {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error('Target URL is empty.');
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error(`Invalid target URL: ${trimmed}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported protocol "${url.protocol}". Only http and https are allowed.`);
  }
  if (url.username || url.password) {
    throw new Error('Target URLs must not contain embedded credentials.');
  }
  url.hash = '';
  return url;
}

export function isLikelyUrl(value: string): boolean {
  try {
    const url = parseTargetUrl(value);
    return Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)} ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)} s`;
  }
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

export function severityAtLeast(severity: Severity, threshold: Severity): boolean {
  const ranks: Record<Severity, number> = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    info: 1,
  };
  return ranks[severity] >= ranks[threshold];
}

export function lineAndColumnAt(text: string, index: number): { line: number; column: number } {
  const safeIndex = Math.max(0, Math.min(index, text.length));
  const before = text.slice(0, safeIndex);
  const line = before.split('\n').length;
  const lastBreak = before.lastIndexOf('\n');
  const column = safeIndex - lastBreak;
  return { line, column };
}

export function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}

export function relativePosix(root: string, absolutePath: string): string {
  return toPosix(path.relative(root, absolutePath));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function compareSeverityDesc(a: Severity, b: Severity): number {
  return (SEVERITY_ORDER[a] ?? 0) - (SEVERITY_ORDER[b] ?? 0) || 0;
}

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};
