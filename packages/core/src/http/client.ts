import type { LaunchProofConfig } from '../config/schema.js';
import { NetworkError, ScopeError } from '../errors.js';
import { checkTargetScope, filterSameScopeRedirect } from '../scope.js';
import { TOOL_USER_AGENT } from '../version.js';
import { sleep, truncate } from '../util.js';

export interface HttpResponseRecord {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  setCookies: string[];
  bodyText: string;
  bodyBytes: number;
  contentType: string;
  durationMs: number;
  redirects: string[];
  truncated: boolean;
}

export interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  maxRedirects?: number;
}

export interface HttpClientOptions {
  config: LaunchProofConfig;
  /** Reject responses larger than this; defaults to config.http.maxResponseBytes. */
  maxResponseBytes?: number;
  /** Extra delay between requests, applied per client instance. */
  requestsPerSecond?: number;
}

/**
 * Small, bounded HTTP client for authorized verification only. Redirects are followed manually
 * so every hop is checked against the configured scope, bodies are capped, and requests are
 * rate limited. Credentials supplied by the caller are never logged.
 */
export class HttpClient {
  private readonly config: LaunchProofConfig;
  private readonly maxBytes: number;
  private readonly delayMs: number;
  private lastRequestAt = 0;
  private requestCount = 0;

  constructor(options: HttpClientOptions) {
    this.config = options.config;
    const rate = options.requestsPerSecond ?? options.config.http.requestsPerSecond;
    this.delayMs = Math.ceil(1000 / Math.max(rate, 0.5));
    this.maxBytes = options.maxResponseBytes ?? options.config.http.maxResponseBytes;
  }

  get requestsMade(): number {
    return this.requestCount;
  }

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < this.delayMs) {
      await sleep(this.delayMs - elapsed);
    }
    this.lastRequestAt = Date.now();
  }

  async request(rawUrl: string, options: HttpRequestOptions = {}): Promise<HttpResponseRecord> {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new NetworkError(`Invalid URL: ${rawUrl}`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new NetworkError(`Unsupported protocol: ${url.protocol}`);
    }
    if (url.username.length > 0 || url.password.length > 0) {
      throw new NetworkError('URLs with embedded credentials are not allowed.');
    }

    const decision = checkTargetScope(url, this.config);
    if (!decision.allowed) {
      throw new ScopeError(`Refusing request to ${url.origin}: ${decision.reason}`);
    }

    if (this.requestCount >= this.config.http.maxRequests) {
      throw new NetworkError(
        `Request budget exhausted (${this.config.http.maxRequests}). Increase http.maxRequests if this target needs more coverage.`,
      );
    }
    this.requestCount += 1;

    const started = Date.now();
    const redirects: string[] = [];
    let current = url;
    let method = (options.method ?? 'GET').toUpperCase();
    let body = options.body;
    const maxRedirects = options.maxRedirects ?? this.config.http.maxRedirects;
    const requestedUrl = url.toString();
    let crossedOrigin = false;

    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      await this.throttle();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.http.timeoutMs);
      let response: Response;
      try {
        response = await fetch(current, {
          method,
          headers: {
            'user-agent': TOOL_USER_AGENT,
            accept: 'text/html,application/json,text/plain,*/*;q=0.8',
            // Never forward caller-supplied credentials or custom headers across an origin
            // boundary. A redirect inside a wildcard scope must not become a credential leak.
            ...(crossedOrigin ? {} : this.config.http.headers),
            ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
            ...(crossedOrigin ? {} : options.headers),
          },
          body,
          redirect: 'manual',
          signal: controller.signal,
        });
      } catch (error) {
        clearTimeout(timer);
        const reason =
          error instanceof Error && error.name === 'AbortError'
            ? `Request timed out after ${this.config.http.timeoutMs} ms`
            : error instanceof Error
              ? error.message
              : 'unknown network error';
        throw new NetworkError(`Request to ${current.origin} failed: ${reason}`);
      }
      clearTimeout(timer);

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (location) {
          let next: URL;
          try {
            next = new URL(location, current);
          } catch {
            throw new NetworkError(`Invalid redirect target from ${current.origin}`);
          }
          if (next.username.length > 0 || next.password.length > 0) {
            throw new NetworkError('Redirect targets with embedded credentials are not allowed.');
          }
          if (!filterSameScopeRedirect(current, next, this.config)) {
            throw new ScopeError(
              `Redirect from ${current.origin} to ${next.origin} is outside authorization scope.`,
            );
          }
          if (next.origin !== current.origin) {
            crossedOrigin = true;
          }
          redirects.push(next.toString());
          await response.body?.cancel().catch(() => undefined);
          if (response.status === 303 || (response.status === 302 && method === 'POST')) {
            method = 'GET';
            body = undefined;
          }
          if (next.origin !== current.origin && body !== undefined) {
            throw new NetworkError(
              'Refusing to forward a request body across an origin boundary during a redirect.',
            );
          }
          current = next;
          continue;
        }
      }

      const { text, bytes, truncated } = await this.readBody(response);
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      const setCookies =
        typeof response.headers.getSetCookie === 'function'
          ? response.headers.getSetCookie()
          : headers['set-cookie']
            ? [headers['set-cookie']]
            : [];

      return {
        requestedUrl,
        finalUrl: current.toString(),
        status: response.status,
        statusText: response.statusText,
        headers,
        setCookies,
        bodyText: text,
        bodyBytes: bytes,
        contentType: headers['content-type'] ?? '',
        durationMs: Date.now() - started,
        redirects,
        truncated,
      };
    }

    throw new NetworkError(`Too many redirects (limit ${maxRedirects}) for ${url.origin}`);
  }

  private async readBody(
    response: Response,
  ): Promise<{ text: string; bytes: number; truncated: boolean }> {
    if (!response.body) {
      return { text: '', bytes: 0, truncated: false };
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    let truncated = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        const remaining = this.maxBytes - bytes;
        if (remaining <= 0) {
          truncated = true;
          break;
        }
        const slice = value.byteLength > remaining ? value.slice(0, remaining) : value;
        chunks.push(slice);
        bytes += slice.byteLength;
        if (bytes >= this.maxBytes) {
          truncated = true;
          break;
        }
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    const merged = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { text: new TextDecoder('utf-8').decode(merged), bytes, truncated };
  }
}

export function responseSnippet(response: HttpResponseRecord, max = 400): string {
  return truncate(response.bodyText.replace(/\s+/g, ' ').trim(), max);
}

export function headerValue(response: HttpResponseRecord, name: string): string | null {
  return response.headers[name.toLowerCase()] ?? null;
}
