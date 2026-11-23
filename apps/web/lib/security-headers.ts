/**
 * Security header policy shared by the Next.js config and the request proxy.
 *
 * The CSP is generated per request because Next.js inline framework scripts require a nonce.
 * Keep this module free of Node-only APIs so it can be imported from the proxy runtime.
 */

export interface ContentSecurityPolicyOptions {
  nonce: string;
  isDev?: boolean;
  supabaseUrl?: string | null;
  upgradeInsecureRequests?: boolean;
  /** Disable only for a static same-origin artifact whose script cannot carry a nonce. */
  strictDynamic?: boolean;
}

function supabaseOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function buildContentSecurityPolicy({
  nonce,
  isDev = false,
  supabaseUrl = null,
  upgradeInsecureRequests = false,
  strictDynamic = true,
}: ContentSecurityPolicyOptions): string {
  const scriptSources = ["'self'", `'nonce-${nonce}'`];
  if (strictDynamic) scriptSources.push("'strict-dynamic'");
  if (isDev) scriptSources.push("'unsafe-eval'");

  // Supabase Auth is called directly from the browser. Allow only the configured project
  // origin; do not use a wildcard or allow arbitrary third-party API origins.
  const connectSources = ["'self'"];
  const supabase = supabaseOrigin(supabaseUrl);
  if (supabase) connectSources.push(supabase);

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    `style-src 'self' 'nonce-${nonce}'`,
    // GitHub avatars are the only remote images rendered by the dashboard.
    "img-src 'self' data: blob: https://avatars.githubusercontent.com",
    "font-src 'self'",
    `connect-src ${connectSources.join(' ')}`,
    "media-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
  ];
  if (upgradeInsecureRequests) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

export const SECURITY_HEADERS: Array<{ key: string; value: string }> = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

export const PRIVATE_CACHE_HEADERS: Array<{ key: string; value: string }> = [
  { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
];
