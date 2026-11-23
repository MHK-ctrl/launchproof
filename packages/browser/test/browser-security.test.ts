import http from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import { createDefaultConfig } from '@launchproof/core';

import { runBrowserChecks } from '../src/index.js';
import type { CheckResult } from '@launchproof/core';

interface TestServer {
  server: http.Server;
  url: string;
}

const servers: http.Server[] = [];
const ENV_AUTH = 'LP_BROWSER_AUTH';
const ENV_OWNER = 'LP_BROWSER_OWNER';

async function startServer(handler: http.RequestListener): Promise<TestServer> {
  const server = http.createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Test server did not bind to a TCP port.');
  }
  return { server, url: `http://127.0.0.1:${address.port}` };
}

afterEach(async () => {
  delete process.env[ENV_AUTH];
  delete process.env[ENV_OWNER];
  await Promise.all(
    servers.splice(0).map(async (server) => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }),
  );
});

describe('browser CSP compatibility', () => {
  it('scans accessibility when the target enforces a strict script-src policy', async () => {
    const app = await startServer((_request, response) => {
      response.writeHead(200, {
        'content-type': 'text/html',
        'content-security-policy':
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
      });
      response.end(
        '<!doctype html><html lang="en"><head><title>Strict CSP fixture</title></head><body><main><h1>Strict CSP fixture</h1><p>Accessible content.</p></main></body></html>',
      );
    });
    const config = createDefaultConfig();
    config.browser.timeoutMs = 5000;
    config.accessibility.paths = ['/'];

    const checks = await runBrowserChecks({
      config,
      baseUrl: app.url,
      workflows: false,
      links: false,
      mobile: false,
      accessibility: true,
      performance: false,
    });
    const accessibility = checks.find((check) => check.id === 'accessibility.axe') as
      CheckResult | undefined;
    expect(accessibility?.status).not.toBe('not-verified');
    expect(accessibility?.summary).toContain('1 page(s) scanned');
    expect(
      accessibility?.findings.some((finding) =>
        finding.title.startsWith('Accessibility scan failed'),
      ),
    ).toBe(false);
  }, 30_000);
});

describe('browser credential isolation', () => {
  it('strips identity headers from cross-origin subresources', async () => {
    const externalHeaders: http.IncomingHttpHeaders[] = [];
    const external = await startServer((request, response) => {
      if (request.url === '/pixel.png') {
        externalHeaders.push(request.headers);
      }
      response.writeHead(204);
      response.end();
    });
    const app = await startServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(
        `<!doctype html><html><head><title>Header isolation fixture</title></head><body><h1>Fixture</h1><img src="${external.url}/pixel.png" alt="external asset"></body></html>`,
      );
    });

    process.env[ENV_AUTH] = 'Bearer synthetic-browser-token';
    process.env[ENV_OWNER] = 'synthetic-owner';
    const config = createDefaultConfig();
    config.browser.timeoutMs = 5000;
    config.auth.identities = {
      owner: {
        headersEnv: {
          authorization: ENV_AUTH,
          'x-owner': ENV_OWNER,
        },
      },
    };
    config.browser.workflows = [
      {
        name: 'External asset isolation',
        path: '/',
        identity: 'owner',
        steps: [{ action: 'expectVisible', selector: 'h1' }],
        expectNoConsoleErrors: false,
      },
    ];

    const checks = await runBrowserChecks({
      config,
      baseUrl: app.url,
      workflows: true,
      links: false,
      mobile: false,
      accessibility: false,
      performance: false,
    });
    const workflow = checks.find((check) => check.id === 'browser.workflows') as
      CheckResult | undefined;
    expect(workflow?.status).toBe('pass');
    expect(externalHeaders.length).toBeGreaterThan(0);
    for (const headers of externalHeaders) {
      expect(headers.authorization).toBeUndefined();
      expect(headers.cookie).toBeUndefined();
      expect(headers['x-owner']).toBeUndefined();
    }
  }, 30_000);
});
