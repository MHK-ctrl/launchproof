import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { SiteFooter } from '../components/site-footer';
import { SiteHeader } from '../components/site-header';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'LaunchProof — Build with AI. Test like an engineering team.',
    template: '%s · LaunchProof',
  },
  description:
    'Open-source, local-first verification for AI-built applications: security, API contracts, authorization, browser flows, accessibility, and performance, with evidence you can inspect.',
  applicationName: 'LaunchProof',
  keywords: [
    'application security',
    'AI code verification',
    'launch readiness',
    'accessibility testing',
    'Playwright',
    'API testing',
    'open source',
  ],
  openGraph: {
    title: 'LaunchProof — evidence-backed verification for AI-built apps',
    description:
      'Static security, live HTTP, API contracts, authorization, browser workflows, accessibility, and performance in one honest report.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only z-[100] rounded-md bg-[#3ddc97] px-4 py-2 text-[#04120c] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
