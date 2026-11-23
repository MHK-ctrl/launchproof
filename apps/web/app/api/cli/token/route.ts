import { z } from 'zod';

import {
  apiError,
  clientAddress,
  isSameOrigin,
  jsonResponse,
  rateLimit,
  readJsonBody,
} from '@/lib/api';
import { getApiSession } from '@/lib/auth';
import { base64UrlSha256, randomToken, sha256 } from '@/lib/crypto';
import { appBaseUrl } from '@/lib/env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const startSchema = z
  .object({
    action: z.literal('start'),
    state: z.string().min(16).max(128),
    codeChallenge: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
    redirectPort: z.number().int().min(1024).max(65535),
  })
  .strict();

const exchangeSchema = z
  .object({
    action: z.literal('exchange'),
    code: z.string().regex(/^lp_code_[A-Za-z0-9_-]{20,}$/),
    state: z.string().min(16).max(128),
    verifier: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  const body = await readJsonBody(request, 10_000);
  if (!body.ok) return body.response;
  const action =
    body.value && typeof body.value === 'object' && 'action' in body.value
      ? (body.value as { action?: unknown }).action
      : null;

  if (action === 'start') {
    const session = await getApiSession();
    if (!session) return apiError(401, 'unauthorized', 'Sign in to authorize the CLI.');
    if (!isSameOrigin(request)) return apiError(403, 'forbidden', 'Request origin is not allowed.');
    const limit = rateLimit(`cli-start:${session.user.id}`, 10, 60_000);
    if (!limit.allowed)
      return apiError(429, 'rate_limited', 'Too many CLI authorization attempts.', {
        'Retry-After': String(limit.retryAfter),
      });
    const parsed = startSchema.safeParse(body.value);
    if (!parsed.success)
      return apiError(400, 'invalid_request', 'Invalid CLI authorization request.');

    const code = `lp_code_${randomToken(32)}`;
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('cli_auth_requests')
      .insert({
        user_id: session.user.id,
        state: parsed.data.state,
        code_hash: sha256(code),
        code_challenge: parsed.data.codeChallenge,
        redirect_port: parsed.data.redirectPort,
        expires_at: expiresAt,
      })
      .select('id')
      .single();
    if (error || !data)
      return apiError(500, 'cli_start_failed', 'CLI authorization could not be started.');

    const approveUrl = new URL('/cli/authorize', appBaseUrl());
    approveUrl.searchParams.set('request', data.id);
    approveUrl.searchParams.set('code', code);
    return jsonResponse({ requestId: data.id, code, expiresAt, approveUrl: approveUrl.toString() });
  }

  if (action === 'exchange') {
    const limit = rateLimit(`cli-exchange:${clientAddress(request)}`, 20, 60_000);
    if (!limit.allowed)
      return apiError(429, 'rate_limited', 'Too many CLI token exchanges.', {
        'Retry-After': String(limit.retryAfter),
      });
    const parsed = exchangeSchema.safeParse(body.value);
    if (!parsed.success) return apiError(400, 'invalid_request', 'Invalid CLI token exchange.');

    const admin = createSupabaseAdminClient();
    const { data: authRequest } = await admin
      .from('cli_auth_requests')
      .select('*')
      .eq('code_hash', sha256(parsed.data.code))
      .maybeSingle();
    const now = new Date().toISOString();
    if (
      !authRequest ||
      authRequest.consumed_at ||
      authRequest.expires_at <= now ||
      !authRequest.approved_at ||
      authRequest.state !== parsed.data.state ||
      base64UrlSha256(parsed.data.verifier) !== authRequest.code_challenge
    ) {
      return apiError(400, 'invalid_grant', 'CLI authorization is invalid or expired.');
    }

    // Claim the one-time request atomically before issuing a token. A check-then-update would let
    // two concurrent exchanges both mint a token from the same authorization code.
    const { data: claimed, error: claimError } = await admin
      .from('cli_auth_requests')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', authRequest.id)
      .is('consumed_at', null)
      .not('approved_at', 'is', null)
      .gt('expires_at', now)
      .select('id')
      .maybeSingle();
    if (claimError || !claimed) {
      return apiError(400, 'invalid_grant', 'CLI authorization is invalid or expired.');
    }

    const token = `lp_cli_${randomToken(32)}`;
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
    const { error: tokenError } = await admin.from('cli_tokens').insert({
      user_id: authRequest.user_id,
      token_hash: sha256(token),
      label: 'LaunchProof CLI',
      expires_at: tokenExpiresAt,
    });
    if (tokenError) return apiError(500, 'token_store_failed', 'CLI token could not be stored.');

    return jsonResponse({ token, tokenType: 'Bearer', expiresAt: tokenExpiresAt });
  }

  return apiError(400, 'invalid_request', 'Unknown CLI authorization action.');
}
