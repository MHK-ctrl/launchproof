import { describe, expect, it } from 'vitest';

import { secureCookieOptions } from '@/lib/cookie-options';
import { requestPathFromHeaders } from '@/lib/request-path';

function headersWith(path: string | null | undefined): (name: string) => string | null | undefined {
  return (name) => (name === 'x-launchproof-path' ? path : null);
}

describe('requestPathFromHeaders', () => {
  it('preserves the requested dashboard path and query', () => {
    expect(requestPathFromHeaders(headersWith('/dashboard/settings'))).toBe('/dashboard/settings');
    expect(requestPathFromHeaders(headersWith('/dashboard/scans?page=2'))).toBe(
      '/dashboard/scans?page=2',
    );
  });

  it('falls back to the dashboard when the header is absent', () => {
    expect(requestPathFromHeaders(headersWith(null))).toBe('/dashboard');
  });

  it('rejects absolute, protocol-relative, and malformed values', () => {
    expect(requestPathFromHeaders(headersWith('https://evil.example'))).toBe('/dashboard');
    expect(requestPathFromHeaders(headersWith('//evil.example'))).toBe('/dashboard');
    expect(requestPathFromHeaders(headersWith('/dashboard\\settings'))).toBe('/dashboard');
    expect(requestPathFromHeaders(headersWith('/dashboard\r\nSet-Cookie: x=1'))).toBe('/dashboard');
  });
});

describe('secureCookieOptions', () => {
  it('marks cookies Secure for HTTPS origins', () => {
    expect(secureCookieOptions('https://launchproof-rose.vercel.app')).toEqual({ secure: true });
  });

  it('keeps local HTTP development usable', () => {
    expect(secureCookieOptions('http://127.0.0.1:3000')).toEqual({ secure: false });
    expect(secureCookieOptions('http://localhost:3000')).toEqual({ secure: false });
  });

  it('does not mark cookies Secure when the origin is missing or invalid', () => {
    expect(secureCookieOptions(null)).toEqual({ secure: false });
    expect(secureCookieOptions('not a url')).toEqual({ secure: false });
  });
});
