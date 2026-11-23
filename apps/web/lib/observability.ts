import { randomUUID } from 'node:crypto';

import { apiError } from '@/lib/api';

type LogLevel = 'info' | 'warn' | 'error';
type LogValue = string | number | boolean | null | undefined;

const SENSITIVE_KEY =
  /(?:authorization|cookie|token|secret|password|passwd|body|report|content|key)/i;
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function requestId(request: Request): string {
  const supplied = request.headers.get('x-request-id');
  return supplied && SAFE_REQUEST_ID.test(supplied) ? supplied : randomUUID();
}

/**
 * Emit one JSON line per event. Callers pass only operational metadata; values whose field name
 * looks sensitive are dropped as a second line of defence. Never pass request bodies, report
 * contents, cookies, tokens, or raw provider errors here.
 */
export function structuredLog(
  level: LogLevel,
  event: string,
  fields: Record<string, LogValue> = {},
): void {
  const safe: Record<string, LogValue> = {
    timestamp: new Date().toISOString(),
    level,
    event,
  };
  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE_KEY.test(key)) continue;
    if (value === undefined) continue;
    safe[key] = typeof value === 'string' ? value.slice(0, 500) : value;
  }
  console[level](JSON.stringify(safe));
}

function redactedError(error: unknown): Record<string, string> {
  if (error instanceof Error) return { errorName: error.name };
  if (error && typeof error === 'object') {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(code)) return { errorCode: code };
  }
  return {};
}

/** Log a server-side failure and return an error whose request ID matches the log line. */
export function serverErrorResponse(
  request: Request,
  event: string,
  code: string,
  message: string,
  error?: unknown,
  status = 500,
) {
  const id = requestId(request);
  structuredLog('error', event, { requestId: id, ...redactedError(error) });
  return apiError(status, code, message, { 'x-request-id': id });
}
