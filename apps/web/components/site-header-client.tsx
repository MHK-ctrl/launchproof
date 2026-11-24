'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

interface NavLink {
  href: string;
  label: string;
}

export function SiteHeaderClient({ links, children }: { links: NavLink[]; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/account', { cache: 'no-store', credentials: 'same-origin' })
      .then((response) => {
        if (active) setSignedIn(response.ok);
      })
      .catch(() => {
        if (active) setSignedIn(false);
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-[#162231] bg-[#06090f]/85 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-4">
        {children}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((link) => {
            const active = pathname === link.href || pathname === `${link.href}/`;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-[13px] transition-colors ${
                  active ? 'bg-[#0e1a26] text-[#e8eff9]' : 'text-[#93a6bd] hover:text-[#e8eff9]'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/report" className="btn btn-secondary !py-2 !text-[13px]">
            View evidence
          </Link>
          {signedIn ? (
            <Link href="/dashboard" className="btn btn-primary !py-2 !text-[13px]">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-secondary !py-2 !text-[13px]">
                Sign in
              </Link>
              <Link href="/get-started" className="btn btn-primary !py-2 !text-[13px]">
                Start scanning
              </Link>
            </>
          )}
        </div>
        <button
          type="button"
          className="rounded-lg border border-[#223043] p-2 text-[#c3d2e4] md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
      {open ? (
        <nav
          className="border-t border-[#162231] bg-[#080d14] px-5 py-3 md:hidden"
          aria-label="Mobile"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-2 py-2.5 text-sm text-[#c3d2e4] hover:bg-[#0e1a26]"
            >
              {link.label}
            </Link>
          ))}
          {signedIn ? (
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="btn btn-primary mt-3 w-full !py-2.5 !text-[13px]"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="btn btn-secondary mt-3 w-full !py-2.5 !text-[13px]"
              >
                Sign in
              </Link>
              <Link
                href="/get-started"
                onClick={() => setOpen(false)}
                className="btn btn-primary mt-2 w-full !py-2.5 !text-[13px]"
              >
                Start scanning
              </Link>
            </>
          )}
        </nav>
      ) : null}
    </header>
  );
}
