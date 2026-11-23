import { isLoopbackHost } from '@launchproof/core';

export interface CloudResponse<T> {
  status: number;
  data: T;
}

export function resolveApiBase(explicit?: string): URL {
  const raw =
    explicit?.trim() || process.env.LAUNCHPROOF_API_URL?.trim() || 'http://127.0.0.1:3000';
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Invalid LaunchProof API URL. Set LAUNCHPROOF_API_URL to an http(s) URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('The LaunchProof API URL must use http or https.');
  }
  if (url.username || url.password) {
    throw new Error('The LaunchProof API URL must not contain embedded credentials.');
  }
  if (url.protocol === 'http:' && !isLoopbackHost(url.hostname)) {
    throw new Error('Plain HTTP is allowed only for a loopback LaunchProof server. Use HTTPS.');
  }
  url.pathname = url.pathname.replace(/\/$/, '');
  url.search = '';
  url.hash = '';
  return url;
}

export function apiUrl(base: URL, pathname: string): string {
  return `${base.toString().replace(/\/$/, '')}${pathname}`;
}

export async function cloudRequest<T>(
  base: URL,
  pathname: string,
  init: {
    method?: 'GET' | 'POST' | 'DELETE';
    token?: string;
    body?: unknown;
    timeoutMs?: number;
    maxResponseBytes?: number;
  } = {},
): Promise<CloudResponse<T>> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'LaunchProof-CLI/0.1',
  };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(apiUrl(base, pathname), {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(init.timeoutMs ?? 20_000),
    redirect: 'error',
  });
  const contentLength = Number(response.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > (init.maxResponseBytes ?? 2_000_000)) {
    throw new Error('LaunchProof API response exceeded the size limit.');
  }
  const raw = await response.text();
  if (Buffer.byteLength(raw, 'utf8') > (init.maxResponseBytes ?? 2_000_000)) {
    throw new Error('LaunchProof API response exceeded the size limit.');
  }
  let data: unknown = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(`LaunchProof API returned an invalid response (${response.status}).`);
    }
  }
  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? (data as { error?: { message?: unknown } }).error?.message
        : null;
    throw new Error(
      typeof message === 'string'
        ? `${message} (${response.status})`
        : `LaunchProof API request failed (${response.status}).`,
    );
  }
  return { status: response.status, data: data as T };
}
