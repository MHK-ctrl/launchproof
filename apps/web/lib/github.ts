import { cookies } from 'next/headers';

import { decryptSecret, encryptSecret } from '@/lib/crypto';

export const GITHUB_CONNECT_COOKIE = 'lp_github_connect';

export interface GitHubRepository {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  htmlUrl: string;
  defaultBranch: string | null;
  visibility: 'public' | 'private' | 'internal';
  private: boolean;
  permissions?: {
    admin?: boolean;
    maintain?: boolean;
    push?: boolean;
    triage?: boolean;
    pull?: boolean;
  };
}

interface GitHubApiRepository {
  id?: unknown;
  name?: unknown;
  full_name?: unknown;
  owner?: { login?: unknown };
  html_url?: unknown;
  default_branch?: unknown;
  visibility?: unknown;
  private?: unknown;
  permissions?: unknown;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function mapRepository(value: GitHubApiRepository): GitHubRepository | null {
  const id = typeof value.id === 'number' && Number.isSafeInteger(value.id) ? value.id : null;
  const name = asString(value.name);
  const fullName = asString(value.full_name);
  const owner = asString(value.owner?.login);
  const htmlUrl = asString(value.html_url);
  if (!id || !name || !fullName || !owner || !htmlUrl) return null;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName)) return null;
  const visibility =
    value.visibility === 'private' || value.visibility === 'internal'
      ? value.visibility
      : value.private === true
        ? 'private'
        : 'public';
  return {
    id,
    name,
    fullName,
    owner,
    htmlUrl: htmlUrl.startsWith('https://github.com/') ? htmlUrl : `https://github.com/${fullName}`,
    defaultBranch: asString(value.default_branch),
    visibility,
    private: visibility !== 'public',
    ...(value.permissions && typeof value.permissions === 'object'
      ? { permissions: value.permissions as GitHubRepository['permissions'] }
      : {}),
  };
}

async function githubFetch(path: string, token: string): Promise<unknown> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'LaunchProof-Cloud/0.1',
    },
    signal: AbortSignal.timeout(12_000),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(
      response.status === 401 || response.status === 403
        ? 'GitHub denied repository access. Reconnect and approve the repository permission.'
        : `GitHub repository request failed (${response.status}).`,
    );
  }
  return response.json() as Promise<unknown>;
}

export async function listGitHubRepositories(token: string): Promise<GitHubRepository[]> {
  const data = await githubFetch(
    '/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member',
    token,
  );
  if (!Array.isArray(data)) throw new Error('GitHub returned an unexpected repository list.');
  return data
    .map((item) => mapRepository(item as GitHubApiRepository))
    .filter((item): item is GitHubRepository => item !== null);
}

export async function getGitHubRepository(
  id: number,
  token: string,
): Promise<GitHubRepository | null> {
  const data = await githubFetch(`/repositories/${id}`, token);
  return mapRepository(data as GitHubApiRepository);
}

export async function readConnectToken(userId: string): Promise<string | null> {
  const store = await cookies();
  const encrypted = store.get(GITHUB_CONNECT_COOKIE)?.value;
  if (!encrypted) return null;
  try {
    const parsed = JSON.parse(decryptSecret(encrypted)) as {
      version?: unknown;
      userId?: unknown;
      token?: unknown;
    };
    if (
      parsed.version !== 1 ||
      parsed.userId !== userId ||
      typeof parsed.token !== 'string' ||
      parsed.token.length < 20
    ) {
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
}

export async function setConnectToken(token: string, userId: string): Promise<void> {
  const store = await cookies();
  store.set(GITHUB_CONNECT_COOKIE, encryptSecret(JSON.stringify({ version: 1, userId, token })), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60,
  });
}

export async function clearConnectToken(): Promise<void> {
  const store = await cookies();
  store.set(GITHUB_CONNECT_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
