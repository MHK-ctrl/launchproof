import http from 'node:http';

import { describe, expect, it } from 'vitest';

import { createDefaultConfig } from '../src/config/schema.js';
import { HttpClient } from '../src/http/client.js';

interface TestServer {
  server: http.Server;
  url: string;
}

async function startServer(handler: http.RequestListener): Promise<TestServer> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Test server did not bind to a TCP port.');
  }
  return { server, url: `http://127.0.0.1:${address.port}` };
}

async function stopServer(server: http.Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

describe('HTTP client safety', () => {
  it('strips caller credentials when a redirect crosses origins', async () => {
    const received: http.IncomingHttpHeaders[] = [];
    const target = await startServer((_request, response) => {
      received.push(_request.headers);
      response.writeHead(200, { 'content-type': 'text/plain' });
      response.end('ok');
    });
    const redirector = await startServer((_request, response) => {
      response.writeHead(302, { location: `${target.url}/landing` });
      response.end();
    });

    try {
      const config = createDefaultConfig();
      config.http.requestsPerSecond = 20;
      config.http.timeoutMs = 3000;
      const client = new HttpClient({ config });
      const response = await client.request(`${redirector.url}/start`, {
        headers: {
          authorization: 'Bearer synthetic-token',
          cookie: 'session=synthetic',
          'x-api-key': 'synthetic-key',
        },
      });

      expect(response.status).toBe(200);
      expect(response.finalUrl).toBe(`${target.url}/landing`);
      expect(received).toHaveLength(1);
      expect(received[0]?.authorization).toBeUndefined();
      expect(received[0]?.cookie).toBeUndefined();
      expect(received[0]?.['x-api-key']).toBeUndefined();
      expect(received[0]?.['user-agent']).toContain('LaunchProof');
    } finally {
      await stopServer(redirector.server);
      await stopServer(target.server);
    }
  });

  it('rejects URLs with embedded credentials before making a request', async () => {
    const config = createDefaultConfig();
    const client = new HttpClient({ config });
    await expect(client.request('http://user:pass@127.0.0.1:1/')).rejects.toThrow(
      /embedded credentials/i,
    );
  });

  it('does not forward a request body across an origin redirect', async () => {
    let targetRequests = 0;
    const target = await startServer((_request, response) => {
      targetRequests += 1;
      response.writeHead(200);
      response.end('unexpected');
    });
    const redirector = await startServer((_request, response) => {
      response.writeHead(307, { location: `${target.url}/landing` });
      response.end();
    });

    try {
      const config = createDefaultConfig();
      config.http.requestsPerSecond = 20;
      config.http.timeoutMs = 3000;
      const client = new HttpClient({ config });
      await expect(
        client.request(`${redirector.url}/start`, {
          method: 'POST',
          body: 'synthetic-secret-body',
        }),
      ).rejects.toThrow(/request body across an origin boundary/i);
      expect(targetRequests).toBe(0);
    } finally {
      await stopServer(redirector.server);
      await stopServer(target.server);
    }
  });
});
