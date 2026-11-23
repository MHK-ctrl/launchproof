import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Security',
  description:
    'LaunchProof security model, authorization rules, data handling, redaction, disclosure, and limitations.',
};

export default function SecurityPage() {
  return (
    <div className="container py-14">
      <div className="max-w-3xl">
        <p className="eyebrow">Security & trust</p>
        <h1 className="mt-3 text-[2.4rem] font-semibold leading-tight tracking-[-0.03em] text-[#f0f6ff]">
          A scanner that respects scope.
        </h1>
        <p className="mt-4 text-[14.5px] leading-relaxed text-[#9bafc5]">
          LaunchProof sends network requests only after passing an explicit scope gate. It does not
          exploit, fuzz, brute force, or modify data by default. It also refuses to present an
          unexecuted check as a pass.
        </p>
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <section className="panel p-6">
          <h2 className="text-[17px] font-semibold text-[#e8eff9]">Authorization model</h2>
          <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-[#a2b5ca]">
            <li>
              — Loopback (<code className="font-mono text-[#6ef0b6]">127.0.0.1</code>,{' '}
              <code className="font-mono text-[#6ef0b6]">localhost</code>,{' '}
              <code className="font-mono text-[#6ef0b6]">::1</code>) is allowed by default for local
              development.
            </li>
            <li>
              — Every other target requires{' '}
              <code className="font-mono text-[#6ef0b6]">authorization.authorized: true</code> and a
              matching host in <code className="font-mono text-[#6ef0b6]">authorization.scope</code>
              .
            </li>
            <li>— Private networks require an additional explicit opt-in.</li>
            <li>— Cloud metadata addresses are always refused.</li>
            <li>— Every redirect hop is re-checked; leaving scope aborts the request.</li>
            <li>— Unsafe API methods are disabled unless explicitly enabled.</li>
            <li>— Authorization tests send read-only requests by default.</li>
          </ul>
        </section>
        <section className="panel p-6">
          <h2 className="text-[17px] font-semibold text-[#e8eff9]">Secret handling</h2>
          <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-[#a2b5ca]">
            <li>
              — Credential formats are detected but values are replaced with{' '}
              <code className="font-mono text-[#6ef0b6]">****REDACTED****</code> before entering a
              finding.
            </li>
            <li>— HTTP response bodies are not copied into report evidence.</li>
            <li>
              — Environment file contents are never included; only path-level hygiene is reported.
            </li>
            <li>
              — Identity headers and cookies are read from environment variables and never printed.
            </li>
            <li>
              — AI remediation is off by default, requires consent, and receives finding text
              only—not evidence values.
            </li>
            <li>— Masking does not un-leak a credential. Rotate anything confirmed exposed.</li>
          </ul>
        </section>
      </div>

      <section className="panel mt-4 p-6" id="data">
        <h2 className="text-[17px] font-semibold text-[#e8eff9]">Data handling</h2>
        <div className="mt-3 grid gap-5 text-[13px] leading-relaxed text-[#a2b5ca] md:grid-cols-3">
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#8499b0]">
              Where scans run
            </h3>
            <p className="mt-1.5">
              On your machine. Core features do not call a LaunchProof service because none exists.
            </p>
          </div>
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#8499b0]">
              What leaves the machine
            </h3>
            <p className="mt-1.5">
              Requests to the target you configured, the npm registry for audits, and—only if
              enabled—your chosen AI provider.
            </p>
          </div>
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#8499b0]">
              What is stored
            </h3>
            <p className="mt-1.5">
              Report artifacts under <code className="font-mono">.launchproof/</code> in your
              project, plus optional screenshots. Delete them like any other build artifact.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="panel p-6">
          <h2 className="text-[17px] font-semibold text-[#e8eff9]">What LaunchProof is not</h2>
          <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-[#a2b5ca]">
            <li>— Not a penetration test, exploit framework, or security certification.</li>
            <li>— Not a guarantee that an application is secure because a scan passed.</li>
            <li>
              — Not a replacement for threat modeling, code review, or manual testing with real
              accounts.
            </li>
            <li>
              — Not a compliance attestation for SOC 2, ISO 27001, PCI, or any other standard.
            </li>
            <li>— Not authorized to test third-party systems on your behalf.</li>
          </ul>
        </section>
        <section className="panel p-6">
          <h2 className="text-[17px] font-semibold text-[#e8eff9]">Reporting a vulnerability</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[#a2b5ca]">
            Do not open a public issue containing exploit details or credentials. Use the
            repository's private security advisory channel at{' '}
            <a
              className="text-[#3ddc97] underline decoration-[#3ddc97]/40 underline-offset-2"
              href="https://github.com/MHK-ctrl/launchproof/security/advisories/new"
            >
              github.com/MHK-ctrl/launchproof/security/advisories/new
            </a>
            . If it is unavailable, contact the maintainer through the repository profile.
          </p>
          <p className="mt-3 text-[12px] leading-relaxed text-[#7f93aa]">
            Include the affected version, a minimal reproduction, impact, and any suggested fix.
            Never include live credentials in a report; rotate them first if exposed.
          </p>
          <Link href="/docs#limitations" className="btn btn-secondary mt-4 !py-2 !text-[12px]">
            Read the limitations
          </Link>
        </section>
      </div>
    </div>
  );
}
