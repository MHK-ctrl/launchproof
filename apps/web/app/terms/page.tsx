import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms',
  description:
    'Terms for using the LaunchProof CLI and optional cloud dashboard, including authorized-use requirements and limitations.',
};

export default function TermsPage() {
  return (
    <div className="container py-14">
      <div className="prose-docs max-w-3xl">
        <p className="eyebrow">Terms</p>
        <h1 className="mt-2 text-[2.2rem] font-semibold tracking-[-0.03em] text-[#f0f6ff]">
          Terms of service
        </h1>
        <p className="mt-3 text-[13px] text-[#8499b0]">Effective 24 November 2026.</p>

        <p className="mt-5">
          LaunchProof is an open-source verification tool published under the MIT License. These
          terms cover use of the CLI, the website, and the optional hosted dashboard. By using the
          service you agree to them. If you do not agree, do not use the hosted dashboard.
        </p>

        <h2>Authorized testing only</h2>
        <p>
          You may point LaunchProof only at systems you own or are explicitly authorized in writing
          to test. LaunchProof cannot verify your authority. Supplying{' '}
          <code>authorization.authorized: true</code>, <code>--authorized</code>, or a scope entry
          is a statement by you that you have permission. Do not use the tool to probe, scan, or
          attack third-party systems, and do not use it to evade rate limits or access controls.
        </p>

        <h2>Your responsibilities</h2>
        <ul>
          <li>Choose scan targets and credentials lawfully, and keep them secure.</li>
          <li>
            Review findings before acting; automated checks are heuristic and can be wrong in both
            directions.
          </li>
          <li>
            Do not upload data you are not allowed to share, and do not attempt to bypass redaction.
          </li>
          <li>
            Do not abuse the hosted service, attempt to access another user&apos;s data, or disrupt
            availability.
          </li>
          <li>
            Keep your GitHub account and CLI tokens secure, and revoke them when no longer needed.
          </li>
        </ul>

        <h2>No guarantee of security or readiness</h2>
        <p>
          A passing gate, a clean scan, or the absence of findings does not mean an application is
          secure, compliant, or ready for production. LaunchProof reports what it observed and
          labels checks it could not perform as <strong>SKIPPED</strong> or{' '}
          <strong>NOT VERIFIED</strong>. It is not a substitute for code review, threat modeling,
          professional penetration testing, or legal and regulatory review. The software is provided
          &quot;as is&quot;, without warranties of any kind, to the extent permitted by law.
        </p>

        <h2>Accounts and availability</h2>
        <p>
          The hosted dashboard is provided free of charge and may change, be rate-limited, or be
          unavailable. Accounts that abuse the service, attempt cross-tenant access, or upload
          unlawful content may be suspended or removed. You can delete your account at any time from
          the dashboard; deleting it removes your hosted profile, repositories, scans, findings, and
          CLI tokens.
        </p>

        <h2>Intellectual property</h2>
        <p>
          The LaunchProof source is licensed under the MIT License; see the repository&apos;s
          <code>LICENSE</code> file. You retain ownership of your code, scan targets, and uploaded
          scan summaries. You grant only the limited permission needed to store and display the
          summaries you explicitly upload so the dashboard can show them back to you.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, the LaunchProof contributors are not liable for
          indirect, incidental, special, or consequential damages, or for lost profits or data,
          arising from use of the tool or service. Nothing here limits liability that cannot be
          limited by law.
        </p>

        <h2>Changes and contact</h2>
        <p>
          These terms may be updated as the product changes; the effective date above will change
          when they do. Questions can be raised through the{' '}
          <a href="https://github.com/MHK-ctrl/launchproof/issues">project issue tracker</a> or the{' '}
          <Link href="/contact">contact page</Link>. See the{' '}
          <Link href="/privacy">privacy policy</Link> for data handling.
        </p>

        <p className="mt-8 text-[12px] text-[#6e8199]">
          This page is product documentation, not legal advice. An owner-provided legal review is
          still required before relying on it as a formal contract.
        </p>
      </div>
    </div>
  );
}
