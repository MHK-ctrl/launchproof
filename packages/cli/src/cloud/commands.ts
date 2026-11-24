import { createInterface } from 'node:readline/promises';

import type { ScanReport } from '@launchproof/core';

import { cloudRequest } from './http.js';
import { buildCloudPayload, payloadPreview, type CloudScanPayload } from './payload.js';
import { readGitMetadata } from './git.js';
import { getStoredToken } from './token-store.js';

interface RepositorySummary {
  id: string;
  full_name: string;
  owner: string;
  name: string;
  visibility: string;
  connection_status: string;
}

interface UploadResponse {
  scanId: string;
  findingsStored: number;
}

export async function getTokenOrThrow(): Promise<string> {
  const token = await getStoredToken();
  if (!token) {
    throw new Error('Not signed in. Run launchproof login before uploading.');
  }
  return token;
}

export async function fetchRepositories(base: URL, token: string): Promise<RepositorySummary[]> {
  const response = await cloudRequest<{ repositories?: RepositorySummary[] }>(
    base,
    '/api/cli/repositories',
    { token },
  );
  return Array.isArray(response.data.repositories) ? response.data.repositories : [];
}

export async function resolveRepository(
  base: URL,
  token: string,
  rootDir: string,
  explicit: string | undefined,
): Promise<RepositorySummary> {
  const repositories = await fetchRepositories(base, token);
  if (repositories.length === 0) {
    throw new Error(
      'No active repositories are connected to your account. Connect one in the LaunchProof dashboard first.',
    );
  }
  if (explicit) {
    const match = repositories.find(
      (repository) =>
        repository.id === explicit || repository.full_name.toLowerCase() === explicit.toLowerCase(),
    );
    if (!match) {
      throw new Error(
        `No active connected repository matches "${explicit}". Run launchproof repositories to list connected repositories.`,
      );
    }
    return match;
  }

  const git = await readGitMetadata(rootDir);
  if (git.remoteFullName) {
    const match = repositories.find(
      (repository) => repository.full_name.toLowerCase() === git.remoteFullName?.toLowerCase(),
    );
    if (match) return match;
    throw new Error(
      `Git remote ${git.remoteFullName} is not connected. Connect it in the dashboard or pass --repository <id>.`,
    );
  }
  if (repositories.length === 1 && repositories[0]) {
    return repositories[0];
  }
  throw new Error(
    `Could not determine a repository. Pass --repository <id>. Connected: ${repositories
      .map((repository) => repository.full_name)
      .join(', ')}`,
  );
}

export async function confirmUpload(
  payload: CloudScanPayload,
  repository: RepositorySummary,
  options: { yes?: boolean },
  output: (message: string) => void,
): Promise<boolean> {
  output(
    [
      'Upload preview:',
      ...payloadPreview(payload).map((line) => `  ${line}`),
      `  Repository: ${repository.full_name}`,
      'Will upload: sanitized findings, check summaries, counts, timestamps, commit/branch, repository metadata.',
      'Will NOT upload: source code, raw files, secrets, .env values, evidence payloads, full local paths, or logs.',
    ].join('\n'),
  );
  if (options.yes) return true;
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    output(
      'Upload skipped: no interactive terminal. Re-run with --yes to confirm the sanitized upload.',
    );
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question('Upload this sanitized scan summary? [y/N] ');
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

export async function uploadReport(
  base: URL,
  token: string,
  report: ScanReport,
  repository: RepositorySummary,
  options: { yes?: boolean },
  output: (message: string) => void,
  rootDir: string,
): Promise<boolean> {
  const git = await readGitMetadata(rootDir);
  const payload = buildCloudPayload(report, repository.id, rootDir, git);
  const approved = await confirmUpload(payload, repository, options, output);
  if (!approved) {
    output('Upload cancelled. The local report remains available.');
    return false;
  }
  const response = await cloudRequest<UploadResponse>(base, '/api/scans', {
    method: 'POST',
    token,
    body: payload,
    timeoutMs: 30_000,
  });
  output(
    `Upload complete: scan ${response.data.scanId} (${response.data.findingsStored} findings stored) for ${repository.full_name}.`,
  );
  return true;
}
