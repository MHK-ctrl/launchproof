import type { User } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/dashboard';
  }
  if (/[\r\n]/.test(value)) return '/dashboard';
  try {
    const base = 'https://launchproof.invalid';
    const parsed = new URL(value, base);
    if (parsed.origin !== base) return '/dashboard';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/dashboard';
  }
}

export function githubIdentity(user: User): {
  username: string | null;
  avatarUrl: string | null;
  githubUserId: number | null;
  email: string | null;
} {
  const metadata = user.user_metadata as Record<string, unknown>;
  const identity =
    user.identities?.find((item) => item.provider === 'github') ?? user.identities?.[0];
  const identityData = (identity?.identity_data ?? {}) as Record<string, unknown>;
  const username =
    stringValue(metadata.user_name) ??
    stringValue(metadata.preferred_username) ??
    stringValue(identityData.user_name) ??
    stringValue(identityData.preferred_username) ??
    null;
  const avatarUrl =
    stringValue(metadata.avatar_url) ?? stringValue(identityData.avatar_url) ?? null;
  const rawId =
    stringValue(metadata.provider_id) ??
    stringValue(identityData.provider_id) ??
    stringValue(metadata.sub) ??
    stringValue(identityData.sub);
  const parsedId = rawId && /^\d+$/.test(rawId) ? Number(rawId) : null;
  return {
    username,
    avatarUrl,
    githubUserId: parsedId && Number.isSafeInteger(parsedId) ? parsedId : null,
    email: user.email ?? null,
  };
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export async function syncProfile(user: User): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const identity = githubIdentity(user);
  const profile: Database['public']['Tables']['profiles']['Insert'] = {
    id: user.id,
    github_username: identity.username,
    avatar_url: identity.avatarUrl,
    github_user_id: identity.githubUserId,
    email: identity.email,
  };
  const { error } = await supabase.from('profiles').upsert(profile, { onConflict: 'id' });
  if (error) {
    throw new Error('The authenticated profile could not be synchronized.');
  }
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user;
  } catch {
    return null;
  }
});

export async function requireUser(returnTo = '/dashboard'): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(safeNextPath(returnTo))}`);
  }
  return user;
}

export interface ApiSession {
  user: User;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  method: 'session';
}

export async function getApiSession(): Promise<ApiSession | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return { user: data.user, supabase, method: 'session' };
  } catch {
    return null;
  }
}
