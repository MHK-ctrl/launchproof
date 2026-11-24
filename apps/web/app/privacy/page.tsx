import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy',
  description:
    'What LaunchProof processes locally, what the optional cloud dashboard stores, and how to delete your account.',
};

export default function PrivacyPage() {
  return (
    <div className="container py-14">
      <div className="prose-docs max-w-3xl">
        <p className="eyebrow">Privacy</p>
        <h1 className="mt-2 text-[2.2rem] font-semibold tracking-[-0.03em] text-[#f0f6ff]">
          Privacy policy
        </h1>
        <p className="mt-3 text-[13px] text-[#8499b0]">Effective 24 November 2026.</p>

        <p className="mt-5">
          LaunchProof is local-first. Running the CLI, scanning a project, and generating reports
          does not require an account and does not send scan data anywhere. The optional cloud
          dashboard is the only part that stores data about you, and it is used only after you sign
          in and choose to upload a scan.
        </p>

        <h2>What stays on your machine</h2>
        <ul>
          <li>Source files, configuration, environment values, and scan targets.</li>
          <li>
            Local reports under <code>.launchproof/</code> (HTML, JSON, optional SARIF).
          </li>
          <li>
            CLI credentials: a token file with mode <code>0600</code>, or the macOS Keychain when
            available.
          </li>
          <li>
            Outbound network checks, only when you enable them for a target you are authorized to
            test.
          </li>
        </ul>

        <h2>What the cloud dashboard stores</h2>
        <p>
          The dashboard uses Supabase Auth with GitHub sign-in and a Supabase Postgres database.
          When you sign in, Supabase processes your GitHub identity and stores an account record.
          LaunchProof stores:
        </p>
        <ul>
          <li>
            <strong>Profile:</strong> your Supabase user ID, GitHub username, GitHub numeric ID,
            avatar URL, and the email GitHub returns (if any).
          </li>
          <li>
            <strong>Session:</strong> Supabase session cookies in your browser so you stay signed
            in. They are readable by JavaScript, which the Supabase browser SDK needs to refresh the
            session, and are marked <code>Secure</code> on HTTPS.
          </li>
          <li>
            <strong>Connected repositories:</strong> repository ID, owner, name, URL, default
            branch, visibility, and connection status. Source code is never copied.
          </li>
          <li>
            <strong>Uploaded scans:</strong> the sanitized summary you explicitly upload — check
            statuses, counts, timestamps, commit/branch, repository metadata, and findings with
            descriptions, severities, and file/line references.
          </li>
          <li>
            <strong>CLI tokens:</strong> a SHA-256 hash of each token and its label, timestamps, and
            expiry. The token itself is shown once to the CLI and never stored in the database.
          </li>
          <li>
            <strong>Rate-limit buckets:</strong> per-user counters (or hashed client addresses for
            unauthenticated CLI exchanges) with a short expiry.
          </li>
        </ul>

        <h2>GitHub repository access</h2>
        <p>
          Connecting a repository asks GitHub for the <code>repo</code> scope, because GitHub has no
          read-only scope for private repository metadata. LaunchProof uses the resulting provider
          token only to issue read-only GitHub API requests. The token is encrypted into an
          <code>HttpOnly</code>, <code>SameSite=Lax</code> cookie that expires after 15 minutes; it
          is never written to the database. Revoke the GitHub grant at any time in your GitHub
          settings, or disconnect the repository in the dashboard.
        </p>

        <h2>What is never uploaded</h2>
        <ul>
          <li>Source code or raw files.</li>
          <li>Environment values or secrets; secret-like text is redacted before upload.</li>
          <li>Local absolute paths, evidence payloads, browser traces, or command logs.</li>
          <li>Full local reports; the dashboard stores and re-serves a sanitized cloud summary.</li>
        </ul>

        <h2>Service providers</h2>
        <ul>
          <li>
            <strong>Vercel</strong> hosts the website and dashboard and keeps operational request
            logs.
          </li>
          <li>
            <strong>Supabase</strong> provides authentication, the Postgres database, and the GitHub
            OAuth broker.
          </li>
          <li>
            <strong>GitHub</strong> provides sign-in and, when you connect a repository, repository
            metadata.
          </li>
        </ul>
        <p>
          LaunchProof does not include advertising, analytics, or third-party telemetry, and does
          not sell personal data. Logs are used for security and reliability and are subject to the
          providers&apos; retention settings.
        </p>

        <h2>Retention and deletion</h2>
        <ul>
          <li>
            CLI tokens expire after 7 days or when revoked; expired and revoked rows are cleaned up
            opportunistically.
          </li>
          <li>GitHub provider tokens expire from the cookie after 15 minutes.</li>
          <li>Rate-limit buckets expire after their window.</li>
          <li>
            Uploaded scans and repository metadata remain until you delete them, disconnect the
            repository, or delete your account.
          </li>
          <li>
            Deleting your account from <strong>Dashboard → Account</strong> removes the Supabase
            Auth identity and cascades to your profile, repositories, scans, findings, and CLI
            tokens. Local files and reports on your machine are not touched.
          </li>
        </ul>
        <p>
          Automatic provider backups are not currently enabled on the hosted database plan, so there
          is no separate backup copy to expire. See the <Link href="/security">security page</Link>{' '}
          for the current operational posture.
        </p>

        <h2>Your choices and contact</h2>
        <p>
          You can use the CLI without an account, sign out at any time, revoke CLI tokens in
          Settings, disconnect repositories, and delete your account. For privacy questions or data
          requests, open an issue at{' '}
          <a href="https://github.com/MHK-ctrl/launchproof/issues">
            github.com/MHK-ctrl/launchproof/issues
          </a>{' '}
          or use the private advisory channel linked on the{' '}
          <Link href="/contact">contact page</Link>. Do not include credentials or personal data in
          a public issue.
        </p>

        <p className="mt-8 text-[12px] text-[#6e8199]">
          This policy describes the current implementation. It is product documentation, not legal
          advice, and it does not replace an owner-provided legal review.
        </p>
      </div>
    </div>
  );
}
