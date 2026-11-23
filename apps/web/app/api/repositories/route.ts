import { z } from 'zod';

import { apiError, isSameOrigin, jsonResponse, readJsonBody } from '@/lib/api';
import { getApiSession } from '@/lib/auth';
import { getGitHubRepository, readConnectToken } from '@/lib/github';
import { serverErrorResponse } from '@/lib/observability';
import { rateLimit } from '@/lib/rate-limit';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const connectSchema = z.object({ githubRepositoryId: z.number().int().positive() }).strict();

export async function GET(request: Request): Promise<Response> {
  const session = await getApiSession();
  if (!session) return apiError(401, 'unauthorized', 'Authentication required.');
  const { data, error } = await session.supabase
    .from('repositories')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error)
    return serverErrorResponse(
      request,
      'repository_list_failed',
      'repository_list_failed',
      'Could not load repositories.',
      error,
    );
  return jsonResponse({ repositories: data ?? [] });
}

export async function POST(request: Request): Promise<Response> {
  const session = await getApiSession();
  if (!session) return apiError(401, 'unauthorized', 'Authentication required.');
  if (!isSameOrigin(request)) return apiError(403, 'forbidden', 'Request origin is not allowed.');

  const limit = await rateLimit(`repository-connect:user:${session.user.id}`, 20, 60_000);
  if (!limit.allowed) {
    return apiError(429, 'rate_limited', 'Too many repository connection attempts.', {
      'Retry-After': String(limit.retryAfter),
    });
  }
  const body = await readJsonBody(request, 10_000);
  if (!body.ok) return body.response;
  const parsed = connectSchema.safeParse(body.value);
  if (!parsed.success) return apiError(400, 'invalid_body', 'Invalid repository request.');

  const token = await readConnectToken(session.user.id);
  if (!token)
    return apiError(400, 'github_connect_required', 'Connect GitHub repository access first.');

  try {
    const repository = await getGitHubRepository(parsed.data.githubRepositoryId, token);
    if (!repository) return apiError(404, 'repository_not_found', 'Repository not accessible.');

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('repositories')
      .upsert(
        {
          user_id: session.user.id,
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
      )
      .select('*')
      .single();
    if (error || !data)
      return serverErrorResponse(
        request,
        'repository_connect_failed',
        'repository_connect_failed',
        'Repository could not be connected.',
        error,
      );
    return jsonResponse({ repository: data }, 201);
  } catch (error) {
    return serverErrorResponse(
      request,
      'github_repository_verify_failed',
      'github_unavailable',
      'GitHub repository could not be verified.',
      error,
      502,
    );
  }
}
