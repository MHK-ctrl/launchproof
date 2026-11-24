import { NextResponse } from 'next/server';

import { appBaseUrl } from '@/lib/env';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Cookie',
  'X-Content-Type-Options': 'nosniff',
};

export function jsonResponse(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

export function apiError(
  status: number,
  code: string,
  message: string,
  extraHeaders: Record<string, string> = {},
): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: { ...PRIVATE_HEADERS, ...extraHeaders } },
  );
}

export function noStoreRedirect(url: URL | string, status = 303): NextResponse {
  return NextResponse.redirect(url, { status, headers: PRIVATE_HEADERS });
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const allowed = new Set([new URL(request.url).origin, appBaseUrl()]);
    return allowed.has(new URL(origin).origin);
  } catch {
    return false;
  }
}

export async function readJsonBody(
  request: Request,
  maxBytes = 2_000_000,
): Promise<{ ok: true; value: unknown } | { ok: false; response: NextResponse }> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) {
    return {
      ok: false,
      response: apiError(415, 'unsupported_media_type', 'Expected application/json.'),
    };
  }
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > maxBytes) {
    return {
      ok: false,
      response: apiError(413, 'payload_too_large', 'Request body is too large.'),
    };
  }
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { ok: false, response: apiError(400, 'invalid_body', 'Could not read request body.') };
  }
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
    return {
      ok: false,
      response: apiError(413, 'payload_too_large', 'Request body is too large.'),
    };
  }
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return {
      ok: false,
      response: apiError(400, 'invalid_json', 'Request body is not valid JSON.'),
    };
  }
}
