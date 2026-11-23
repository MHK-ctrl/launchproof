/**
 * Intentionally insecure demo application.
 *
 * Every weakness here is deliberate and synthetic. Run it on loopback only. Do not copy any
 * pattern from this file into a real application.
 */
import http from 'node:http';

const PORT = Number(process.env.PORT ?? 4173);
const HOST = process.env.HOST ?? '127.0.0.1';

const USERS = [
  { id: 1, name: 'Ada Demo', email: 'ada@example.test', role: 'user' },
  { id: 2, name: 'Grace Demo', email: 'grace@example.test', role: 'user' },
  { id: 3, name: 'Admin Demo', email: 'admin@example.test', role: 'admin' },
];

const PAGE_STYLE = `
  :root { color-scheme: dark; }
  body { margin: 0; font-family: system-ui, sans-serif; background: #1b1d21; color: #cfd3da; line-height: 1.5; }
  header { padding: 16px 24px; background: #24272d; }
  nav a { color: #9ecbff; margin-right: 16px; }
  main { padding: 24px; }
  .hero { width: 1000px; padding: 24px; background: #24272d; border-radius: 8px; }
  .muted { color: #70747c; font-size: 13px; }
  input { display: block; margin: 8px 0; padding: 8px; }
  button { padding: 8px 14px; }
  .signed-in { color: #8ee6a5; font-weight: 600; }
`;

function page(title, body, extraHead = '') {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
${extraHead}
<style>${PAGE_STYLE}</style>
</head>
<body>
<header><strong>Vulnerable Demo</strong>
<nav><a href="/">Home</a><a href="/login">Login</a><a href="/about">About</a><a href="/broken">Broken link</a></nav>
</header>
<main>${body}</main>
</body>
</html>`;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-credentials': 'true',
    ...headers,
  });
  res.end(body);
}

function json(res, status, payload) {
  send(res, status, JSON.stringify(payload), { 'content-type': 'application/json' });
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      if (body.length < 100_000) body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', () => resolve(''));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
  const pathname = url.pathname;

  if (pathname === '/' && req.method === 'GET') {
    send(
      res,
      200,
      page(
        'Vulnerable Demo',
        `<div class="hero">
          <h1>An intentionally insecure app</h1>
          <p>This page exists so LaunchProof can demonstrate real findings. Nothing here is production code.</p>
          <p class="muted">Missing headers, wildcard CORS, an unauthenticated API, and a broken link are deliberate.</p>
          <a href="/login">Sign in</a>
        </div>`,
        '<meta name="viewport" content="width=device-width, initial-scale=1" />',
      ),
      { 'set-cookie': 'session=demo-session; Path=/' },
    );
    return;
  }

  if (pathname === '/login' && req.method === 'GET') {
    send(
      res,
      200,
      page(
        'Sign in · Vulnerable Demo',
        `<h1>Sign in</h1>
        <form id="login-form">
          <input id="email" type="email" placeholder="Email" required />
          <input id="password" type="password" placeholder="Password" required />
          <button id="submit" type="submit">Sign in</button>
        </form>
        <p id="status" role="status"></p>
        <script>
          document.getElementById('login-form').addEventListener('submit', function (event) {
            event.preventDefault();
            document.getElementById('status').textContent = 'Signed in (demo only)';
            document.getElementById('status').className = 'signed-in';
            console.error('Deliberate demo console error for LaunchProof');
          });
        </script>`,
        '<meta name="viewport" content="width=device-width, initial-scale=1" />',
      ),
    );
    return;
  }

  if (pathname === '/about') {
    send(
      res,
      200,
      page(
        'About · Vulnerable Demo',
        '<h1>About</h1><p>A local-only target for verification demos.</p>',
      ),
    );
    return;
  }

  if (pathname === '/logo.svg') {
    send(
      res,
      200,
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#334"/><text x="12" y="42" fill="#fff" font-size="28">LP</text></svg>',
      { 'content-type': 'image/svg+xml' },
    );
    return;
  }

  if (pathname === '/api/health') {
    json(res, 200, { status: 'ok', service: 'vulnerable-demo' });
    return;
  }

  if (pathname === '/api/users' && req.method === 'GET') {
    json(res, 200, { users: USERS, total: USERS.length });
    return;
  }

  const userMatch = /^\/api\/users\/(\d+)$/.exec(pathname);
  if (userMatch) {
    const user = USERS.find((candidate) => candidate.id === Number(userMatch[1]));
    if (!user) {
      json(res, 404, { error: 'User not found' });
      return;
    }
    json(res, 200, { user });
    return;
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    await readBody(req);
    json(res, 200, { token: 'demo-token-not-real', user: USERS[0] });
    return;
  }

  if (pathname === '/api/debug') {
    json(res, 200, {
      debug: true,
      environment: 'development',
      config: { database: 'demo', auth: 'disabled' },
      stack: ['at handler (/app/server.mjs:42:1)', 'at process (/app/server.mjs:7:3)'],
    });
    return;
  }

  if (pathname === '/.env') {
    send(
      res,
      200,
      [
        'DEMO_DATABASE_URL=placeholder-database-url',
        'DEMO_STRIPE_KEY=placeholder-stripe-key',
        'DEMO_SESSION_SECRET=placeholder-session-secret',
        '',
      ].join('\n'),
      { 'content-type': 'text/plain; charset=utf-8' },
    );
    return;
  }

  if (pathname === '/.git/config') {
    send(
      res,
      200,
      '[core]\n\trepositoryformatversion = 0\n\tbare = false\n[remote "origin"]\n\turl = https://example.test/demo.git\n',
      { 'content-type': 'text/plain; charset=utf-8' },
    );
    return;
  }

  if (pathname === '/server-status') {
    send(res, 200, 'Apache Server Status for demo\nServer Version: Apache/2.4.1', {
      'content-type': 'text/html; charset=utf-8',
    });
    return;
  }

  if (pathname === '/broken') {
    send(
      res,
      404,
      `<!doctype html><title>Not found</title><h1>Cannot GET /broken</h1><pre>Error: route not found
    at handler (/app/server.mjs:101:11)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)</pre>`,
    );
    return;
  }

  send(
    res,
    404,
    `<!doctype html><title>Not found</title><h1>Not found</h1><pre>Error: Cannot GET ${pathname}
    at handler (/app/server.mjs:101:11)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)</pre>`,
  );
});

server.listen(PORT, HOST, () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : PORT;
  console.log(`LAUNCHPROOF_DEMO_URL=http://${HOST}:${port}`);
  console.log('Intentionally vulnerable demo. Loopback use only.');
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
