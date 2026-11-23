import { describe, expect, it } from 'vitest';

import { createDefaultConfig } from '../src/config/schema.js';
import { checkTargetScope, filterSameScopeRedirect } from '../src/scope.js';
import { parseTargetUrl, redactText, redactUrl } from '../src/util.js';

describe('authorization scope gate', () => {
  it('allows loopback development targets by default', () => {
    const config = createDefaultConfig();
    const decision = checkTargetScope(new URL('http://127.0.0.1:3000/'), config);
    expect(decision.allowed).toBe(true);
    expect(decision.local).toBe(true);
  });

  it('refuses remote targets without explicit authorization', () => {
    const config = createDefaultConfig();
    const decision = checkTargetScope(new URL('https://staging.example.com/'), config);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/explicit authorization/i);
  });

  it('requires both authorization and a matching scope entry', () => {
    const config = createDefaultConfig();
    config.authorization.authorized = true;
    expect(checkTargetScope(new URL('https://staging.example.com/'), config).allowed).toBe(false);

    config.authorization.scope = ['staging.example.com'];
    expect(checkTargetScope(new URL('https://staging.example.com/app'), config).allowed).toBe(true);
    expect(checkTargetScope(new URL('https://other.example.com/'), config).allowed).toBe(false);
  });

  it('supports wildcard subdomain scopes but not the bare domain', () => {
    const config = createDefaultConfig();
    config.authorization.authorized = true;
    config.authorization.scope = ['*.example.com'];
    expect(checkTargetScope(new URL('https://api.example.com/'), config).allowed).toBe(true);
    expect(checkTargetScope(new URL('https://example.com/'), config).allowed).toBe(false);
  });

  it('blocks private networks unless explicitly enabled', () => {
    const config = createDefaultConfig();
    config.authorization.authorized = true;
    config.authorization.scope = ['192.168.1.10'];
    const blocked = checkTargetScope(new URL('http://192.168.1.10:8080/'), config);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toMatch(/Private-network/i);

    config.authorization.allowPrivateNetwork = true;
    expect(checkTargetScope(new URL('http://192.168.1.10:8080/'), config).allowed).toBe(true);
  });

  it('always blocks cloud metadata endpoints', () => {
    const config = createDefaultConfig();
    config.authorization.authorized = true;
    config.authorization.scope = ['*'];
    expect(
      checkTargetScope(new URL('http://169.254.169.254/latest/meta-data/'), config).allowed,
    ).toBe(false);
  });

  it('rejects redirects outside the authorized scope', () => {
    const config = createDefaultConfig();
    config.authorization.authorized = true;
    config.authorization.scope = ['example.com'];
    expect(
      filterSameScopeRedirect(
        new URL('https://example.com/'),
        new URL('https://example.com/login'),
        config,
      ),
    ).toBe(true);
    expect(
      filterSameScopeRedirect(
        new URL('https://example.com/'),
        new URL('https://evil.example.net/'),
        config,
      ),
    ).toBe(false);
  });

  it('re-checks the port when a redirect stays on the same host', () => {
    const config = createDefaultConfig();
    config.authorization.authorized = true;
    config.authorization.scope = ['example.com:443'];
    expect(
      filterSameScopeRedirect(
        new URL('https://example.com/'),
        new URL('https://example.com/login'),
        config,
      ),
    ).toBe(true);
    expect(
      filterSameScopeRedirect(
        new URL('https://example.com/'),
        new URL('https://example.com:8443/admin'),
        config,
      ),
    ).toBe(false);
  });
});

describe('target parsing and redaction', () => {
  it('rejects embedded credentials and non-http protocols', () => {
    expect(() => parseTargetUrl('https://user:pass@example.com')).toThrow(/credentials/i);
    expect(() => parseTargetUrl('file:///etc/passwd')).toThrow(/protocol/i);
  });

  it('redacts credential-like values from text and URLs', () => {
    const text = redactText('Authorization: Bearer abcdefghijklmnopqrstuvwxyz');
    expect(text).not.toContain('abcdefghijklmnopqrstuvwxyz');
    expect(text).toContain('****REDACTED****');
    const url = redactUrl('https://example.com/cb?token=supersecretvalue&ok=1');
    expect(url).not.toContain('supersecretvalue');
    expect(url).toContain('ok=1');
  });

  it('strips terminal escape sequences before text reaches a report', () => {
    const cleaned = redactText('\u001b[31mred\u001b[0m\u001b]0;title\u0007 text');
    expect(cleaned).toBe('red text');
  });
});
