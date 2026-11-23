# Browser, accessibility, and performance testing

Browser checks are optional. They use a single headless Chromium instance and are bounded by pages,
links, workflows, and timeouts.

## Setup

```bash
npm install --save-dev playwright axe-core
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npx playwright install --only-shell chromium
```

`playwright` and `axe-core` are optional peer dependencies of the published packages. If they or the
browser shell are missing, checks return `not-verified`, not `pass`.

Run `launchproof doctor` to inspect availability.

## Scope

Browser checks use the same authorization gate as HTTP checks. Loopback is allowed by default; remote
URLs need authorization and scope. The browser context ignores certificate errors only if you write
custom code—LaunchProof does not set `ignoreHTTPSErrors`.

## What runs

- **Page load**: root navigation, status, title, console errors, uncaught page errors, failed
  requests (favicon ignored).
- **Workflows**: configured steps with assertions. A failed step is a high-severity browser finding.
- **Links**: same-origin anchors on sampled pages, requested with Playwright's request context.
  HTTP 4xx/5xx is reported; external links are not.
- **Mobile layout**: configured mobile viewport; horizontal overflow detection.
- **Accessibility**: axe-core injected into each sampled page with configured tags, include/exclude
  selectors, and violation mapping.
- **Performance**: FCP, LCP, CLS, load time, JS transfer, request count, DOM nodes against budgets.
- **Screenshots**: optional on failure/always, written under `.launchproof/screenshots`.

## Workflow configuration

```json
{
  "browser": {
    "enabled": true,
    "baseUrl": "http://localhost:3000",
    "timeoutMs": 20000,
    "workflows": [
      {
        "name": "Sign in",
        "path": "/login",
        "steps": [
          { "action": "fill", "selector": "#email", "value": "demo@example.test" },
          {
            "action": "fill",
            "selector": "#password",
            "valueEnv": "LP_TEST_PASSWORD",
            "secret": true
          },
          { "action": "click", "selector": "button[type=submit]" },
          { "action": "expectText", "text": "Dashboard" },
          { "action": "expectUrl", "contains": "/dashboard" }
        ],
        "expectNoConsoleErrors": true
      }
    ]
  }
}
```

Selectors should be stable. Prefer accessible roles or `data-testid` attributes. `valueEnv` keeps
credentials out of config; `secret: true` documents intent but does not affect storage because values
are not written to reports.

For authenticated flows, `identity` references a named identity whose headers/cookies are applied to
the browser context. This is a simple mechanism, not a replacement for a full login fixture; some
apps need a dedicated test account.

## Accessibility

Tags default to `wcag2a` and `wcag2aa`. axe impacts map to severity: critical → high, serious →
medium, moderate → low, minor → info. Findings include rule, selectors, and help URL.

Automated checks cover only a subset of WCAG. Manual keyboard, screen reader, zoom, contrast, and
cognitive testing remain necessary.

## Performance

Budgets default to FCP 3s, LCP 4s, CLS 0.25, load 6s, JS 1.75 MB, 120 requests, 3,000 DOM nodes.
Values are single-run measurements from the scanning machine, not production field data. Lighthouse
is not bundled; requesting it produces a `not-verified` check explaining that.

## Resource usage

- One Chromium instance, closed in a `finally` block
- At most 5 pages per check and 25 links per page by default
- 20-second default navigation timeout
- Workflows capped at 25, steps at 50
- No parallel browser workers in the test suite

This is intended to run on an 18 GB Apple Silicon laptop alongside normal development tools.
