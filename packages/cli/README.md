# @hamzakhan2006/launchproof

The command-line interface for [LaunchProof](../../README.md): evidence-backed verification for
security, APIs, authorization, browser workflows, accessibility, and performance. The installed
binary is `launchproof`.

**No registry release exists yet.** The unscoped npm name `launchproof` belongs to an unrelated
project, so this package publishes under the `@hamzakhan2006` scope and has not been published. Install
from a checkout or from a tarball; do not run `npm install launchproof`.

From the repository root:

```bash
npm ci
npm run build
node packages/cli/bin/launchproof.mjs --help
```

As a global command, without waiting for the registry:

```bash
npm run pack:cli
npm install --global ./artifacts/*.tgz
launchproof --version
```

Once published, the install will be:

```bash
npm install --global @hamzakhan2006/launchproof
```

Core commands: `init`, `analyze`, `test`, `security`, `scan`, `browser`, `accessibility`,
`performance`, `report`, `config`, and `doctor`.

The `report` command converts a saved JSON report to another format:

```bash
launchproof report --format html --out report.html
launchproof report --format pdf  --out report.pdf    # needs Playwright + Chromium
launchproof report --format sarif
```

PDF export reuses the optional Playwright dependency that browser checks already need. Without
Chromium the command exits `2` with install instructions; the HTML report never depends on it.

Exit codes: `0` gate passed, `1` gate failed, `2` usage/config/authorization error, `3` unexpected
error.

The bundle is self-contained: `tsup` inlines `@launchproof/core` and `@launchproof/browser`, so the
tarball has no dependency on unpublished workspace packages. `npm run verify:package` proves this by
installing the packed tarball into an unrelated project and running a real scan.

Full documentation: [CLI reference](../../docs/cli.md), [configuration](../../docs/configuration.md),
[reports](../../docs/reports.md), and [limitations](../../docs/limitations.md).
