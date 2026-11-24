/**
 * Return the path to send back to the login page after authentication. `apps/web/proxy.ts`
 * copies the requested path into a request header so the dashboard layout can redirect to the
 * page the visitor actually asked for. Anything that is not a same-origin absolute path falls
 * back to the dashboard; `requireUser`/`safeNextPath` validate it again before redirecting.
 */
export function requestPathFromHeaders(
  get: (name: string) => string | null | undefined,
  fallback = '/dashboard',
): string {
  const value = get('x-launchproof-path');
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallback;
  }
  if (/[\r\n]/.test(value)) return fallback;
  return value;
}
