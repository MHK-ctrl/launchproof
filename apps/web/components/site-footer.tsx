import Link from 'next/link';

import { Logo } from './logo';

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-[#162231]">
      <div className="container grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-[13px] leading-relaxed text-[#7f93aa]">
            Evidence-backed verification for software built with AI. Local-first, open source, and
            honest about what was not tested.
          </p>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.15em] text-[#8499b0]">
            MIT · v1.0.0
          </p>
        </div>
        <div>
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-[#6e8199]">
            Product
          </p>
          <ul className="space-y-2 text-[13px] text-[#93a6bd]">
            <li>
              <Link href="/demo" className="hover:text-[#e8eff9]">
                Simulated demo
              </Link>
            </li>
            <li>
              <Link href="/report" className="hover:text-[#e8eff9]">
                Sample report
              </Link>
            </li>
            <li>
              <Link href="/docs" className="hover:text-[#e8eff9]">
                Documentation
              </Link>
            </li>
            <li>
              <Link href="/get-started" className="hover:text-[#e8eff9]">
                Get started
              </Link>
            </li>
            <li>
              <a href="https://github.com/MHK-ctrl/launchproof" className="hover:text-[#e8eff9]">
                Source code
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-[#6e8199]">
            Trust
          </p>
          <ul className="space-y-2 text-[13px] text-[#93a6bd]">
            <li>
              <Link href="/security" className="hover:text-[#e8eff9]">
                Security model
              </Link>
            </li>
            <li>
              <Link href="/security#data" className="hover:text-[#e8eff9]">
                Data handling
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-[#e8eff9]">
                About
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-[#e8eff9]">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-[#e8eff9]">
                Terms
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-[#e8eff9]">
                Contact
              </Link>
            </li>
            <li>
              <Link href="/docs#limitations" className="hover:text-[#e8eff9]">
                Limitations
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-[#6e8199]">
            Principles
          </p>
          <ul className="space-y-2 text-[13px] text-[#93a6bd]">
            <li>Local-first by default</li>
            <li>No fabricated passes</li>
            <li>Authorization before requests</li>
            <li>Secrets masked at collection</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[#111b28]">
        <div className="container flex flex-col gap-2 py-5 font-mono text-[10.5px] text-[#8499b0] sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 LaunchProof contributors. MIT licensed.</span>
          <span>Built for evidence, not marketing.</span>
        </div>
      </div>
    </footer>
  );
}
