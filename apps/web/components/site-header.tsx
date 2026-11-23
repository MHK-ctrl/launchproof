import { Logo } from './logo';
import { SiteHeaderClient } from './site-header-client';

const LINKS = [
  { href: '/demo', label: 'Demo' },
  { href: '/report', label: 'Sample report' },
  { href: '/docs', label: 'Docs' },
  { href: '/get-started', label: 'Get started' },
  { href: '/security', label: 'Security' },
];

export function SiteHeader() {
  return (
    <SiteHeaderClient links={LINKS}>
      <Logo />
    </SiteHeaderClient>
  );
}
