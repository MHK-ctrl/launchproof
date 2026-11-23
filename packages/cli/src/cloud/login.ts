import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';

import { apiUrl, cloudRequest } from './http.js';
import { storeToken } from './token-store.js';

interface TokenExchangeResponse {
  token: string;
  expiresAt: string;
}

function randomUrlToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

function openBrowser(url: string): void {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore', shell: false });
    child.on('error', () => {
      // The URL is printed regardless.
    });
    child.unref();
  } catch {
    // The URL is printed regardless.
  }
}

export interface LoginResult {
  tokenStore: 'keychain' | 'file';
  expiresAt: string;
}

export async function login(
  base: URL,
  options: { noBrowser?: boolean },
  output: (message: string) => void,
): Promise<LoginResult> {
  const state = randomUrlToken(32);
  const verifier = randomUrlToken(48);
  const challenge = createHash('sha256').update(verifier).digest('base64url');

  const resources: { server?: ReturnType<typeof createServer> } = {};
  let timer: NodeJS.Timeout | null = null;

  const callback = new Promise<{ code: string }>((resolve, reject) => {
    const server = createServer((request, response) => {
      try {
        const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
        if (requestUrl.pathname !== '/callback') {
          response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          response.end('Not found');
          return;
        }
        const code = requestUrl.searchParams.get('code');
        const returnedState = requestUrl.searchParams.get('state');
        if (!code || returnedState !== state) {
          response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
          response.end('Invalid authorization response. You can close this tab.');
          return;
        }
        response.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        response.end(
          '<!doctype html><meta charset="utf-8"><title>LaunchProof CLI</title><body style="font-family:system-ui;background:#06090f;color:#e8eff9;padding:40px"><h1>CLI authorized</h1><p>You can close this tab and return to the terminal.</p></body>',
        );
        resolve({ code });
      } catch {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Authorization failed. You can close this tab.');
      }
    });

    resources.server = server;
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not start the local CLI callback listener.'));
        return;
      }
      const target = new URL(apiUrl(base, '/cli/login'));
      target.searchParams.set('state', state);
      target.searchParams.set('challenge', challenge);
      target.searchParams.set('port', String(address.port));
      output(`Open this URL in your browser to approve the CLI:\n${target.toString()}`);
      if (!options.noBrowser) openBrowser(target.toString());
    });

    timer = setTimeout(() => {
      reject(new Error('CLI login timed out after 5 minutes. Run launchproof login again.'));
    }, 5 * 60_000);
    timer.unref();
  });

  try {
    const { code } = await callback;
    const exchange = await cloudRequest<TokenExchangeResponse>(base, '/api/cli/token', {
      method: 'POST',
      body: { action: 'exchange', code, state, verifier },
      timeoutMs: 20_000,
    });
    const tokenStore = await storeToken(exchange.data.token);
    return { tokenStore, expiresAt: exchange.data.expiresAt };
  } finally {
    if (timer) clearTimeout(timer);
    resources.server?.close();
  }
}
