import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Why LaunchProof exists, the principles behind it, the current v1.0.0 status, and the roadmap.',
};

export default function AboutPage() {
  return (
    <div className="container py-14">
      <div className="max-w-3xl">
        <p className="eyebrow">About</p>
        <h1 className="mt-3 text-[2.4rem] font-semibold leading-tight tracking-[-0.03em] text-[#f0f6ff]">
          Faster building needs better proof.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[#9bafc5]">
          AI-assisted development compressed the distance between an idea and a running application.
          It did not remove the need for security review, API contract tests, access control checks,
          accessibility, or performance budgets. LaunchProof exists to make those checks practical
          for small teams and solo builders—without pretending a scanner is a security guarantee.
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {[
          {
            title: 'Evidence over vibes',
            text: 'Every finding states severity, confidence, and whether it was observed, pattern-matched, or inferred. A gate result never appears without the threshold that produced it.',
          },
          {
            title: 'Local-first, optional cloud',
            text: 'Core scanning runs on your machine and reports are written locally. There is no telemetry and no automatic upload. An optional cloud dashboard stores only a sanitized summary when you explicitly pass --upload and confirm it.',
          },
          {
            title: 'Safe by default',
            text: 'Network checks are off until enabled. Non-loopback targets require explicit authorization and scope. Unsafe API methods are off. Cloud metadata is always blocked.',
          },
          {
            title: 'Honest about coverage',
            text: 'Skipped, not verified, and error are first-class states. Missing browser dependencies do not become passes, and static rules are labeled as heuristics.',
          },
          {
            title: 'One tool, inspectable artifacts',
            text: 'Terminal, offline HTML, JSON, and SARIF from the same result model. You can keep the evidence, diff it, and feed it to other tools.',
          },
          {
            title: 'Optional intelligence',
            text: 'AI remediation is disabled by default, requires consent, and never sends evidence values. It produces unverified guidance, clearly labeled.',
          },
        ].map((principle) => (
          <div key={principle.title} className="panel p-5">
            <h2 className="text-[14.5px] font-semibold text-[#e8eff9]">{principle.title}</h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[#93a6bd]">{principle.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 grid gap-4 lg:grid-cols-2">
        <section className="panel p-6">
          <p className="eyebrow">Current status</p>
          <h2 className="mt-2 text-[19px] font-semibold text-[#e8eff9]">v1.0.0, released</h2>
          <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-[#93a6bd]">
            <li>
              — CLI, static engine, HTTP/API/authorization checks, and report renderers are
              implemented.
            </li>
            <li>
              — Browser, accessibility, and performance checks pass an automated Chromium test
              suite.
            </li>
            <li>
              — The source is public on{' '}
              <a
                className="text-[#3ddc97] underline decoration-[#3ddc97]/40 underline-offset-2"
                href="https://github.com/MHK-ctrl/launchproof"
              >
                GitHub
              </a>
              ; the public npm name belongs to an unrelated project, so npm distribution is pending
              a scoped package decision.
            </li>
            <li>
              — The optional Supabase/Vercel dashboard is live at launchproof-rose.vercel.app:
              GitHub sign-in, repository connection, private scan history, authorized downloads, and
              explicit CLI upload.
            </li>
            <li>
              — Tenant isolation, CSRF rejection, live rate limits, and account deletion were tested
              against production in Phase 21.8. GitHub repository consent and a CLI upload against a
              connected repository remain unverified because GitHub required owner 2FA.
            </li>
            <li>— Documentation records limitations instead of implying complete coverage.</li>
          </ul>
        </section>
        <section className="panel p-6">
          <p className="eyebrow">Roadmap</p>
          <h2 className="mt-2 text-[19px] font-semibold text-[#e8eff9]">What comes next</h2>
          <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-[#93a6bd]">
            <li>— A scoped npm package name and verified npm publication.</li>
            <li>— Complete the GitHub connect and CLI upload flow with owner 2FA present.</li>
            <li>— More framework-aware discovery and API route extraction.</li>
            <li>— Improved authenticated browser flows and recorded traces.</li>
            <li>— Richer Supabase policy analysis and optional live write-policy tests.</li>
            <li>— Report comparison between scans and a stable SARIF rule catalog.</li>
          </ul>
          <p className="mt-4 text-[11.5px] text-[#6e8199]">
            Roadmap items are intentions, not shipped features. The report and docs only claim what
            the current release implements.
          </p>
        </section>
      </div>

      <div className="panel mt-8 flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-[16px] font-semibold text-[#e8eff9]">Open source under MIT</h2>
          <p className="mt-1 text-[12.5px] text-[#93a6bd]">
            Contributions are welcome. The project does not claim affiliation with any vendor named
            in its compatibility documentation.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/security" className="btn btn-secondary !py-2 !text-[12px]">
            Security model
          </Link>
          <Link href="/docs" className="btn btn-primary !py-2 !text-[12px]">
            Read the docs
          </Link>
        </div>
      </div>
    </div>
  );
}
