'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth';
import { clearConnectToken, getGitHubRepository, readConnectToken } from '@/lib/github';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface RepositoryActionResult {
  ok: boolean;
  message: string;
}

export async function connectRepository(repositoryId: number): Promise<RepositoryActionResult> {
  const user = await requireUser('/dashboard/repositories/connect');
  if (!Number.isSafeInteger(repositoryId) || repositoryId <= 0) {
    return { ok: false, message: 'Invalid GitHub repository identifier.' };
  }
  const token = await readConnectToken(user.id);
  if (!token) {
    return {
      ok: false,
      message:
        'GitHub repository access expired. Reconnect GitHub and approve the repository prompt.',
    };
  }
  try {
    // The browser supplies only an ID. Owner, name, URL, visibility, and branch come from GitHub.
    const repository = await getGitHubRepository(repositoryId, token);
    if (!repository) {
      return {
        ok: false,
        message: 'That repository is not accessible to the connected GitHub account.',
      };
    }
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from('repositories').upsert(
      {
        user_id: user.id,
        github_repository_id: repository.id,
        owner: repository.owner,
        name: repository.name,
        full_name: repository.fullName,
        html_url: repository.htmlUrl,
        default_branch: repository.defaultBranch,
        visibility: repository.visibility,
        connection_status: 'active',
      },
      { onConflict: 'user_id,github_repository_id' },
    );
    if (error) {
      return { ok: false, message: 'The repository could not be connected.' };
    }
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/repositories');
    revalidatePath('/dashboard/scans');
    return { ok: true, message: `${repository.fullName} connected.` };
  } catch {
    return { ok: false, message: 'GitHub repository access could not be verified.' };
  }
}

export async function disconnectRepository(repositoryId: string): Promise<RepositoryActionResult> {
  const user = await requireUser('/dashboard/repositories');
  if (!/^[0-9a-f-]{36}$/i.test(repositoryId)) {
    return { ok: false, message: 'Invalid repository identifier.' };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('repositories')
    .update({ connection_status: 'disconnected' })
    .eq('id', repositoryId)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle();
  if (error || !data) {
    return { ok: false, message: 'Repository not found.' };
  }
  // Drop the local short-lived GitHub provider token as well. The GitHub OAuth grant itself
  // remains active until the user revokes LaunchProof in GitHub settings.
  await clearConnectToken();
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/repositories');
  revalidatePath('/dashboard/scans');
  return {
    ok: true,
    message:
      'Repository disconnected and local GitHub access cleared. Revoke the GitHub grant in GitHub settings to remove it fully. Stored scan history is retained.',
  };
}
