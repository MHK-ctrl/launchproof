import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { secureCookieOptions } from '@/lib/cookie-options';
import { getSupabasePublicConfig, isSupabaseConfigured } from '@/lib/env';
import { buildContentSecurityPolicy } from '@/lib/security-headers';

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isHttps =
    request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
  // The offline sample report is a fixed same-origin HTML artifact with an external script that
  // cannot carry a per-request nonce. It keeps `script-src 'self'` without `strict-dynamic`; all
  // other routes use the stronger nonce + strict-dynamic policy.
  const isStaticReport = request.nextUrl.pathname === '/sample-report.html';
  const contentSecurityPolicy = buildContentSecurityPolicy({
    nonce,
    isDev: process.env.NODE_ENV === 'development',
    supabaseUrl: isSupabaseConfigured() ? getSupabasePublicConfig().url : null,
    upgradeInsecureRequests: isHttps,
    strictDynamic: !isStaticReport,
  });

  // Next.js extracts the nonce from the request CSP header and applies it to its inline
  // framework scripts and styles during server rendering. Pages must be dynamically rendered;
  // app/layout.tsx calls connection() for that reason.
  const requestHeadersWithCsp = () => {
    const headers = new Headers(request.headers);
    headers.set('x-nonce', nonce);
    headers.set('Content-Security-Policy', contentSecurityPolicy);
    // Lets the dashboard layout redirect back to the requested page instead of always /dashboard.
    headers.set('x-launchproof-path', `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return headers;
  };

  let response = NextResponse.next({ request: { headers: requestHeadersWithCsp() } });

  if (isSupabaseConfigured()) {
    const { url, anonKey } = getSupabasePublicConfig();
    const supabase = createServerClient(url, anonKey, {
      cookieOptions: secureCookieOptions(request.nextUrl.origin),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request: { headers: requestHeadersWithCsp() } });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    try {
      // Refresh Supabase cookies before rendering. A transient auth refresh failure must not
      // take public pages offline; protected routes still enforce their own session checks.
      await supabase.auth.getUser();
    } catch {
      // Intentionally ignore: the response still carries the CSP and any cookies Supabase set.
    }
  }

  response.headers.set('Content-Security-Policy', contentSecurityPolicy);
  response.headers.set('x-nonce', nonce);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
