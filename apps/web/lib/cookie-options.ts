/**
 * Supabase session cookies are client-managed (the browser SDK must read them to refresh the
 * session), so they cannot be HttpOnly without moving session handling to a server-only model.
 * They can still be marked Secure whenever the application is served over HTTPS. Local
 * development over http://127.0.0.1 keeps working because the flag is derived from the origin.
 */
export function secureCookieOptions(origin: string | null | undefined): { secure: boolean } {
  if (!origin) return { secure: false };
  try {
    return { secure: new URL(origin).protocol === 'https:' };
  } catch {
    return { secure: false };
  }
}
