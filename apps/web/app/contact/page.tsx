import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'How to reach the LaunchProof maintainers, report a bug, request privacy help, or disclose a vulnerability privately.',
};

export default function ContactPage() {
  return (
    <div className="container py-14">
      <div className="prose-docs max-w-3xl">
        <p className="eyebrow">Contact</p>
        <h1 className="mt-2 text-[2.2rem] font-semibold tracking-[-0.03em] text-[#f0f6ff]">
          Contact and disclosure
        </h1>
        <p className="mt-4">
          LaunchProof is an open-source project maintained through its public GitHub repository.
          There is no support inbox or company address to publish; use the verified channels below.
        </p>

        <h2>Bugs, feature requests, and privacy questions</h2>
        <p>
          Open an issue at{' '}
          <a href="https://github.com/MHK-ctrl/launchproof/issues">
            github.com/MHK-ctrl/launchproof/issues
          </a>
          . Include the version or commit, what you expected, and a minimal reproduction. Do not
          include credentials, tokens, personal data, or details of an unpatched vulnerability in a
          public issue.
        </p>

        <h2>Security vulnerabilities</h2>
        <p>
          Private vulnerability reporting is enabled on the repository. Submit a report at{' '}
          <a href="https://github.com/MHK-ctrl/launchproof/security/advisories/new">
            github.com/MHK-ctrl/launchproof/security/advisories/new
          </a>
          . Include affected version/commit, impact, reproduction steps, and any suggested
          mitigation. This is a volunteer project; response times are best-effort, and no fixed SLA
          is promised.
        </p>
        <p>
          See the <Link href="/security">security model</Link> and{' '}
          <a href="https://github.com/MHK-ctrl/launchproof/blob/main/SECURITY.md">SECURITY.md</a>{' '}
          for scope and safe-harbor expectations.
        </p>

        <h2>Account or data requests</h2>
        <p>
          You can delete your account and hosted data yourself from{' '}
          <strong>Dashboard → Account</strong>. For anything the dashboard cannot do, open a GitHub
          issue asking for a private follow-up and do not post account identifiers publicly. See the{' '}
          <Link href="/privacy">privacy policy</Link> for what is stored.
        </p>

        <h2>What is not offered</h2>
        <p>
          There is no commercial support contract, no emergency hotline, no bug bounty, and no
          certification program. Do not treat any response as a security guarantee or legal advice.
        </p>
      </div>
    </div>
  );
}
