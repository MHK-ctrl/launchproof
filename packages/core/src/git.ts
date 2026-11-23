import { runCommand } from './process.js';

export interface GitHistoryEntry {
  file: string;
  commit: string;
  date: string;
}

export async function isGitRepository(rootDir: string): Promise<boolean> {
  const result = await runCommand('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd: rootDir,
    timeoutMs: 5000,
  });
  return result.code === 0 && result.stdout.trim() === 'true';
}

/** Returns tracked file paths relative to the repository root, or null outside git. */
export async function listTrackedFiles(rootDir: string): Promise<Set<string> | null> {
  const result = await runCommand('git', ['ls-files', '-z'], {
    cwd: rootDir,
    timeoutMs: 15_000,
    maxBufferBytes: 5_000_000,
  });
  if (result.code !== 0) {
    return null;
  }
  return new Set(
    result.stdout
      .split('\u0000')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );
}

const SENSITIVE_FILE_PATTERN =
  /(^|\/)(?:\.env(?:\..*)?|\.npmrc|id_rsa|id_ed25519|credentials(?:\..*)?|secrets?(?:\..*)?|service[-_]?account(?:\..*)?|.*\.(?:pem|p12|pfx|keystore))$/i;

/**
 * Finds sensitive-looking files that were ever added in reachable git history. This is a
 * filename-level check, not a full secret search of every historical blob; that limitation is
 * reported in the scan.
 */
export async function findSensitiveHistoryAdditions(
  rootDir: string,
  maxCommits: number,
): Promise<GitHistoryEntry[]> {
  const result = await runCommand(
    'git',
    [
      'log',
      '--all',
      '--diff-filter=A',
      '--name-only',
      '--format=@@LP@@%H%x1f%aI',
      `--max-count=${maxCommits}`,
    ],
    {
      cwd: rootDir,
      timeoutMs: 15_000,
      maxBufferBytes: 3_000_000,
    },
  );
  if (result.code !== 0) {
    return [];
  }

  const entries: GitHistoryEntry[] = [];
  const seen = new Set<string>();
  let commit = '';
  let date = '';
  for (const rawLine of result.stdout.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('@@LP@@')) {
      const [hash = '', authored = ''] = line.slice(6).split('\u001f');
      commit = hash;
      date = authored;
      continue;
    }
    if (line.length === 0 || !SENSITIVE_FILE_PATTERN.test(line)) {
      continue;
    }
    const key = `${line}\u0000${commit}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    entries.push({ file: line, commit, date });
    if (entries.length >= 20) {
      break;
    }
  }
  return entries;
}
