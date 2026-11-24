import { readFile } from 'node:fs/promises';

import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { proxy } from '@/proxy';
import {
  PRIVATE_CACHE_HEADERS,
  SECURITY_HEADERS,
  buildContentSecurityPolicy,
} from '@/lib/security-headers';

function directive(policy: string, name: string): string {
  return (
    policy
      .split(';')
      .map((part) => part.trim())
      .find((part) => part === name || part.startsWith(`${name} `)) ?? ''
  );
}

describe('content security policy', () => {
  const production = buildContentSecurityPolicy({
    nonce: 'test-nonce',
    supabaseUrl: 'https://project-ref.supabase.co',
    upgradeInsecureRequests: true,
  });

  it('uses a nonce for scripts and styles with no unsafe inline or eval in production', () => {
    expect(directive(production, 'script-src')).toContain("'nonce-test-nonce'");
    expect(directive(production, 'script-src')).toContain("'strict-dynamic'");
    expect(directive(production, 'style-src')).toContain("'nonce-test-nonce'");
    expect(production).not.toContain("'unsafe-inline'");
    expect(production).not.toContain("'unsafe-eval'");
  });

  it('locks down framing, objects, base URLs, and form targets', () => {
    expect(directive(production, 'default-src')).toBe("default-src 'self'");
    expect(directive(production, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive(production, 'frame-src')).toBe("frame-src 'none'");
    expect(directive(production, 'object-src')).toBe("object-src 'none'");
    expect(directive(production, 'base-uri')).toBe("base-uri 'self'");
    expect(directive(production, 'form-action')).toBe("form-action 'self'");
    expect(directive(production, 'upgrade-insecure-requests')).toBe('upgrade-insecure-requests');
  });

  it('allows only the configured Supabase project and GitHub avatars', () => {
    expect(directive(production, 'connect-src')).toBe(
      "connect-src 'self' https://project-ref.supabase.co",
    );
    expect(directive(production, 'img-src')).toBe(
      "img-src 'self' data: blob: https://avatars.githubusercontent.com",
    );
    expect(production).not.toMatch(/\s\*\s|https:\/\/\*/);
  });

  it('ignores malformed or non-http Supabase URLs instead of widening the policy', () => {
    for (const value of ['not a URL', 'javascript:alert(1)', 'data:text/plain,hi']) {
      const policy = buildContentSecurityPolicy({ nonce: 'n', supabaseUrl: value });
      expect(directive(policy, 'connect-src')).toBe("connect-src 'self'");
    }
  });

  it('permits React eval only in development', () => {
    const development = buildContentSecurityPolicy({ nonce: 'n', isDev: true });
    expect(directive(development, 'script-src')).toContain("'unsafe-eval'");
    expect(development).not.toContain("'unsafe-inline'");
  });

  it('adds upgrade-insecure-requests only for HTTPS requests', () => {
    expect(buildContentSecurityPolicy({ nonce: 'n' })).not.toContain('upgrade-insecure-requests');
  });

  it('sets the CSP header and a fresh nonce from the proxy', async () => {
    const first = await proxy(new NextRequest('https://launchproof.example/dashboard'));
    const second = await proxy(new NextRequest('https://launchproof.example/dashboard'));
    const firstPolicy = first.headers.get('content-security-policy');
    const secondPolicy = second.headers.get('content-security-policy');
    expect(firstPolicy).not.toBeNull();
    expect(firstPolicy ?? '').toContain("script-src 'self' 'nonce-");
    expect(firstPolicy ?? '').toContain("'strict-dynamic'");
    expect(firstPolicy ?? '').toContain("frame-ancestors 'none'");
    expect(firstPolicy).not.toBe(secondPolicy);
    expect(first.headers.get('x-frame-options')).toBeNull();
  });

  it('allows the fixed sample report script from self without weakening other routes', async () => {
    const report = await proxy(new NextRequest('https://launchproof.example/sample-report.html'));
    const reportPolicy = report.headers.get('content-security-policy') ?? '';
    expect(directive(reportPolicy, 'script-src')).toContain("'self'");
    expect(directive(reportPolicy, 'script-src')).not.toContain("'strict-dynamic'");
    expect(reportPolicy).not.toContain("'unsafe-inline'");
    expect(reportPolicy).not.toContain("'unsafe-eval'");
  });

  it('keeps the static report free of inline scripts, styles, and style attributes', async () => {
    const html = await readFile(
      new URL('../../../apps/web/public/sample-report.html', import.meta.url),
      'utf8',
    );
    expect(html).not.toMatch(/<style[\s>]/i);
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/i);
    expect(html).not.toMatch(/\sstyle\s*=/i);
    expect(html).toContain('src="/sample-report.js"');
    expect(html).toContain('href="/sample-report.css"');
  });
});

describe('static security headers', () => {
  it('defines clickjacking, MIME, referrer, permissions, and HSTS protections', () => {
    const headers = new Map(SECURITY_HEADERS.map(({ key, value }) => [key, value]));
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
    expect(headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
    expect(headers.has('Content-Security-Policy')).toBe(false);
  });

  it('marks authenticated pages and API responses as private and non-indexable', () => {
    const headers = new Map(PRIVATE_CACHE_HEADERS.map(({ key, value }) => [key, value]));
    expect(headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
    expect(headers.get('X-Robots-Tag')).toContain('noindex');
  });
});
