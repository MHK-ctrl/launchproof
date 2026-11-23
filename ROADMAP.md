# Roadmap

This roadmap states intent, not shipped functionality. Every item is subject to change. The current
release is a v0.1.0 source preview; the package is not yet published to npm.

## Now (v0.1.x)

- Stabilize the scan result schema and document a compatibility policy.
- Improve framework-aware API route extraction for Next.js, Express, Fastify, Hono, and FastAPI.
- Add more static rules with tests and low false-positive rates.
- Strengthen report viewer and HTML accessibility.
- Publish the first tagged release once the repository is public and the release checklist passes.

## Next

- First-class API authentication workflows (login steps that produce session state) with secret-safe
  handling and explicit opt-in.
- Authenticated browser storage-state support.
- Screenshot and trace retention controls with clear disk and privacy documentation.
- Scan comparison to show new, fixed, and unchanged findings across runs.
- Stable SARIF rule catalog and severity mapping documentation.
- More precise Supabase policy analysis, including table-specific policy association and write-policy
  probes against a staging project.
- Optional Lighthouse integration if a maintained, bounded dependency can be added without making it
  mandatory.

## Later

- Plugin interface for custom checks with a stable contract and scoped network access.
- Additional report formats and integrations requested by users.
- Localization of terminal and HTML reports.
- Performance trend tracking across local runs.

## Non-goals

- Exploitation, fuzzing, brute forcing, or destructive testing.
- A hosted scanning service or dashboard that receives project data.
- Certification or compliance attestation.
- Testing third-party systems without the operator's authorization.
- Replacing professional security review or manual accessibility testing.
- AI-generated findings that are presented as verified facts.
