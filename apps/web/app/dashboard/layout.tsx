import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { getProfile } from '@/lib/dashboard-data';
import { githubIdentity, requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DashboardNav } from './dashboard-nav';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Dashboard', template: '%s · LaunchProof Dashboard' },
  robots: { index: false, follow: false, nocache: true },
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser('/dashboard');
  const supabase = await createSupabaseServerClient();
  const profile = await getProfile(supabase, user.id);
  const identity = githubIdentity(user);
  const username = profile?.github_username ?? identity.username ?? 'GitHub account';
  const avatar = profile?.avatar_url ?? identity.avatarUrl;
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div className="container py-8">
      <div className="grid gap-7 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="panel p-4">
            <div className="flex items-center gap-3">
              {avatar ? (
                // GitHub avatars are remote; using a plain image avoids an image-proxy requirement.
                <img
                  src={avatar}
                  alt=""
                  width={38}
                  height={38}
                  referrerPolicy="no-referrer"
                  className="h-[38px] w-[38px] rounded-full border border-[var(--border-strong)]"
                />
              ) : (
                <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-[var(--border-strong)] bg-[#101b27] text-xs font-semibold text-[var(--accent)]">
                  {initials}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{username}</p>
                <p className="text-[11px] text-[var(--subtle)]">Private workspace</p>
              </div>
            </div>
            <div className="mt-4 border-t border-[var(--border)] pt-3">
              <DashboardNav />
            </div>
            <form
              action="/auth/signout"
              method="post"
              className="mt-4 border-t border-[var(--border)] pt-3"
            >
              <button
                type="submit"
                className="btn btn-ghost w-full !justify-start !px-3 !text-[13px]"
              >
                Sign out
              </button>
            </form>
          </div>
          <p className="mt-3 px-1 text-[11px] leading-5 text-[var(--subtle)]">
            Only your account can read these records. Repository metadata is fetched with a
            short-lived encrypted GitHub token; that token is never stored in the database.
          </p>
        </aside>
        <section className="min-w-0">{children}</section>
      </div>
    </div>
  );
}
