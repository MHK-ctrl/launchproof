import type { LaunchProofConfig } from './config/schema.js';
import { isLoopbackHost, isMetadataHost, isPrivateHost } from './util.js';

export interface ScopeDecision {
  allowed: boolean;
  local: boolean;
  host: string;
  reason: string;
}

interface ScopeEntry {
  host: string;
  port: string | null;
  wildcard: boolean;
  any: boolean;
}

function parseScopeEntry(input: string): ScopeEntry | null {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed === '*') {
    return { host: '*', port: null, wildcard: false, any: true };
  }
  const wildcard = trimmed.startsWith('*.');
  const withoutWildcard = wildcard ? trimmed.slice(2) : trimmed;
  if (withoutWildcard.length === 0) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = withoutWildcard.includes('://')
      ? new URL(withoutWildcard)
      : new URL(`http://${withoutWildcard.split('/')[0] ?? withoutWildcard}`);
  } catch {
    return null;
  }
  if (!parsed.hostname) {
    return null;
  }
  const port = parsed.port.length > 0 ? parsed.port : null;
  return {
    host: parsed.hostname.toLowerCase(),
    port,
    wildcard,
    any: false,
  };
}

function effectivePort(url: URL): string {
  if (url.port.length > 0) {
    return url.port;
  }
  return url.protocol === 'https:' ? '443' : '80';
}

function matchesEntry(entry: ScopeEntry, host: string, port: string): boolean {
  if (entry.any) {
    return true;
  }
  if (entry.port !== null && entry.port !== port) {
    return false;
  }
  if (entry.wildcard) {
    return host.endsWith(`.${entry.host}`) && host !== entry.host;
  }
  return host === entry.host;
}

/**
 * Local loopback targets are allowed by default because they are the normal development
 * workflow. Every non-loopback target requires `authorization.authorized: true` AND a
 * matching host in `authorization.scope`. Metadata endpoints are always refused.
 * DNS resolution is intentionally not performed; authorization is host-pattern based.
 */
export function checkTargetScope(url: URL, config: LaunchProofConfig): ScopeDecision {
  const host = url.hostname.toLowerCase();
  const port = effectivePort(url);
  const local = isLoopbackHost(host);

  if (isMetadataHost(host)) {
    return {
      allowed: false,
      local,
      host,
      reason: 'Cloud metadata endpoints are always blocked.',
    };
  }

  const entries = config.authorization.scope
    .map(parseScopeEntry)
    .filter((entry): entry is ScopeEntry => entry !== null);

  if (local && config.authorization.allowLocal) {
    return {
      allowed: true,
      local: true,
      host,
      reason: 'Loopback target accepted as a local development endpoint.',
    };
  }

  if (isPrivateHost(host) && !config.authorization.allowPrivateNetwork) {
    return {
      allowed: false,
      local,
      host,
      reason:
        'Private-network target blocked. Set authorization.allowPrivateNetwork to true only for systems you own.',
    };
  }

  if (!config.authorization.authorized) {
    return {
      allowed: false,
      local,
      host,
      reason:
        'Remote testing requires explicit authorization. Set authorization.authorized to true after confirming you are allowed to test this system.',
    };
  }

  if (entries.length === 0) {
    return {
      allowed: false,
      local,
      host,
      reason:
        'No authorization scope configured. Add the target host to authorization.scope (for example "staging.example.com").',
    };
  }

  const matched = entries.some((entry) => matchesEntry(entry, host, port));
  if (!matched) {
    return {
      allowed: false,
      local,
      host,
      reason: `Target ${host}${port === '80' || port === '443' ? '' : `:${port}`} is outside authorization.scope.`,
    };
  }

  return {
    allowed: true,
    local,
    host,
    reason: 'Target matches configured authorization scope.',
  };
}

export function scopeFailureMessage(decision: ScopeDecision, target: string): string {
  return [
    `Refusing to test ${target}.`,
    decision.reason,
    'LaunchProof only tests systems you own or are explicitly authorized to assess.',
  ].join('\n');
}

export function filterSameScopeRedirect(
  fromUrl: URL,
  toUrl: URL,
  config: LaunchProofConfig,
): boolean {
  if (toUrl.protocol !== 'http:' && toUrl.protocol !== 'https:') {
    return false;
  }
  // Always re-check the destination, including same-host redirects. A host-only shortcut would
  // allow an authorized host:port to redirect to another port on that host.
  void fromUrl;
  return checkTargetScope(toUrl, config).allowed;
}
