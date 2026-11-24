'use client';

import { FolderGit2, LayoutDashboard, ListChecks, Settings, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/repositories', label: 'Repositories', icon: FolderGit2 },
  { href: '/dashboard/scans', label: 'Scans', icon: ListChecks },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  { href: '/dashboard/account', label: 'Account', icon: UserRound },
];

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto lg:flex-col">
      {LINKS.map((link) => {
        const active =
          link.href === '/dashboard'
            ? pathname === '/dashboard' || pathname === '/dashboard/'
            : pathname.startsWith(link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors ${
              active
                ? 'bg-[var(--accent-dim)] text-[var(--accent-strong)]'
                : 'text-[var(--muted)] hover:bg-[#0e1a26] hover:text-[var(--text)]'
            }`}
          >
            <Icon size={15} aria-hidden="true" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
