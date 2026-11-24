import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface GitMetadata {
  commitSha: string | null;
  branch: string | null;
  remoteFullName: string | null;
}

export function parseGitHubRemote(remote: string): string | null {
  const value = remote.trim();
  const patterns = [
    /^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/i,
    /^https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i,
    /^ssh:\/\/git@github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(value);
    if (match?.[1] && match[2]) return `${match[1]}/${match[2]}`;
  }
  return null;
}

async function git(rootDir: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd: rootDir,
      timeout: 5_000,
      maxBuffer: 64 * 1024,
    });
    const value = stdout.trim();
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export async function readGitMetadata(rootDir: string): Promise<GitMetadata> {
  const [commit, branch, remote] = await Promise.all([
    git(rootDir, ['rev-parse', 'HEAD']),
    git(rootDir, ['rev-parse', '--abbrev-ref', 'HEAD']),
    git(rootDir, ['config', '--get', 'remote.origin.url']),
  ]);
  return {
    commitSha: commit && /^[0-9a-f]{7,64}$/i.test(commit) ? commit : null,
    branch: branch && branch !== 'HEAD' ? branch : null,
    remoteFullName: remote ? parseGitHubRemote(remote) : null,
  };
}
