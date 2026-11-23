/**
 * Hardened demo application used as a contrast target in integration tests.
 * It is still a demo, not a production application.
 */
import http from 'node:http';

const PORT = Number(process.env.PORT ?? 4174);
const HOST = process.env.HOST ?? '127.0.0.1';

const USERS = [
  { id: 1, name: 'Ada Demo', email: 'ada@example.test' },
  { id: 2, name: 'Grace Demo', email: 'grace@example.test' },
];

const SECURITY_HEADERS = {
  'content-security-policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'cache-control': 'no-store',
};

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; font-family: system-ui, sans-serif; background: #0b1220; color: #e6eefc; }
  header { padding: 18px 24px; background: #111b2e; }
  nav a { color: #8fc7ff; margin-right: 18px; }
  main { padding: 24px; max-width: 760px; }
  form { max-width: 360px; }
  label { display: block; margin-top: 12px; }
  input { display: block; width: 100%; margin-top: 4px; padding: 8px; }
  button { margin-top: 16px; padding: 9px 16px; }
  .ok { color: #6ee7a8; }
</style>
</head>
<body>
<header><strong>Secure Demo</strong>
<nav><a href="/">Home</a><a href="/login">Sign in</a><a href="/about">About</a></nav>
</header>
<main>${body}</main>
</body>
</html>`;
}

function baseHeaders(extra = {}) {
  return { ...SECURITY_HEADERS, ...extra };
}

function send(res, status, body, contentType = 'text/html; charset=utf-8', extra = {}) {
  res.writeHead(status, baseHeaders({ 'content-type': contentType, ...extra }));
  res.end(body);
}

function json(res, status, payload) {
  send(res, status, JSON.stringify(payload), 'application/json');
}

function authorizedUser(req) {
  const header = req.headers['x-user-id'];
  const id = Number(Array.isArray(header) ? header[0] : header);
  if (!Number.isInteger(id) || id <= 0) return null;
  return USERS.find((user) => user.id === id) ?? null;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
  const pathname = url.pathname;
  const origin = req.headers.origin;

  const paperHeaders = {};
  if (origin === 'https://app.example.com') {
    paperHeaders['access-control-allow-origin'] = origin;
    paperHeaders['vary'] = 'Origin';
  }

  if (pathname === '/' && req.method === 'GET') {
    send(
      res,
      200,
      page(
        'Secure Demo',
        '<h1>Hardened demo target</h1><p>This demo applies strict headers, authenticated APIs, and ownership checks.</p>',
        'text/html; charset=utf-8',
        { 'set-cookie': 'session=secure-demo; Path=/; HttpOnly; SameSite=Lax', ...paperHeaders },
      ),
    );
    return;
  }

  if (pathname === '/login' && req.method === 'GET') {
    send(
      res,
      200,
      page(
        'Sign in · Secure Demo',
        `<h1>Sign in</h1>
        <form id="login-form">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" autocomplete="email" required />
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required />
          <button id="submit" type="submit">Sign in</button>
        </form>
        <p id="status" role="status"></p>
        <script src="/login.js" defer></script>`,
        'text/html; charset=utf-8',
        { ...paperHeaders },
      ),
    );
    return;
  }

  if (pathname === '/login.js') {
    send(
      res,
      200,
      `document.getElementById('login-form').addEventListener('submit', function (event) {
        event.preventDefault();
        var status = document.getElementById('status');
        status.textContent = 'Signed in (demo only)';
        status.className = 'ok';
      });`,
      'text/javascript; charset=utf-8',
    );
    return;
  }

  if (pathname === '/about') {
    send(
      res,
      200,
      page(
        'About · Secure Demo',
        '<h1>About</h1><p>A local-only contrast target for LaunchProof tests.</p>',
      ),
    );
    return;
  }

  if (pathname === '/api/health') {
    json(res, 200, { status: 'ok', service: 'secure-demo' });
    return;
  }

  if (pathname === '/api/users' && req.method === 'GET') {
    if (!authorizedUser(req)) {
      json(res, 401, { error: 'Authentication required' });
      return;
    }
    json(res, 200, { users: USERS, total: USERS.length });
    return;
  }

  const userMatch = /^\/api\/users\/(\d+)$/.exec(pathname);
  if (userMatch) {
    const requester = authorizedUser(req);
    if (!requester) {
      json(res, 401, { error: 'Authentication required' });
      return;
    }
    const requestedId = Number(userMatch[1]);
    if (requester.id !== requestedId) {
      json(res, 403, { error: 'Forbidden' });
      return;
    }
    const user = USERS.find((candidate) => candidate.id === requestedId);
    if (!user) {
      json(res, 404, { error: 'User not found' });
      return;
    }
    json(res, 200, { user });
    return;
  }

  json(res, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : PORT;
  console.log(`LAUNCHPROOF_DEMO_URL=http://${HOST}:${port}`);
  console.log('Hardened demo target. Loopback use only.');
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
