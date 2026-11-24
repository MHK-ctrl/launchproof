# launchproof CLI

The command-line interface for [LaunchProof](../../README.md): evidence-backed verification for
security, APIs, authorization, browser workflows, accessibility, and performance.

This is v1.0.0. The CLI is distributed from the LaunchProof repository: the public npm name
`launchproof` belongs to an unrelated project, so no npm package is published by this project yet.
Install from a checkout, or from a tarball produced with `npm pack -w launchproof`.

From the repository root:

```bash
npm install
npm run build
node packages/cli/bin/launchproof.mjs --help
```

Core commands: `init`, `analyze`, `test`, `security`, `scan`, `browser`, `accessibility`,
`performance`, `report`, `config`, and `doctor`.

Exit codes: `0` gate passed, `1` gate failed, `2` usage/config/authorization error, `3` unexpected
error.

Full documentation: [CLI reference](../../docs/cli.md), [configuration](../../docs/configuration.md),
and [limitations](../../docs/limitations.md).
