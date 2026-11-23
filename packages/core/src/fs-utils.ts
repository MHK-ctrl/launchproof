import { promises as fs } from 'node:fs';
import path from 'node:path';

import { toPosix } from './util.js';

const DEFAULT_IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'out',
  'coverage',
  '.launchproof',
  '.venv',
  'venv',
  'vendor',
  '.cache',
  '.turbo',
  '.yarn',
  'test-results',
  'playwright-report',
  '.playwright',
]);

export const DEFAULT_SCAN_EXCLUDES = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/out/**',
  '**/coverage/**',
  '**/.launchproof/**',
  '**/.venv/**',
  '**/vendor/**',
  '**/*.min.js',
  '**/*.min.css',
  '**/*.map',
  '**/package-lock.json',
  '**/pnpm-lock.yaml',
  '**/yarn.lock',
  '**/bun.lockb',
];

const globCache = new Map<string, RegExp>();

export function globToRegExp(glob: string): RegExp {
  const cached = globCache.get(glob);
  if (cached) {
    return cached;
  }
  const normalized = toPosix(glob).replace(/^\.\//, '');
  let source = '';
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index] ?? '';
    if (char === '*') {
      if (normalized[index + 1] === '*') {
        index += 1;
        if (normalized[index + 1] === '/') {
          index += 1;
          source += '(?:.*/)?';
        } else {
          source += '.*';
        }
      } else {
        source += '[^/]*';
      }
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  const regex = new RegExp(`^${source}$`);
  globCache.set(glob, regex);
  return regex;
}

export function matchesGlob(relativePath: string, glob: string): boolean {
  return globToRegExp(glob).test(toPosix(relativePath));
}

export function matchesAnyGlob(relativePath: string, globs: readonly string[]): boolean {
  return globs.some((glob) => matchesGlob(relativePath, glob));
}

export function shouldIgnorePath(relativePath: string, exclude: readonly string[]): boolean {
  const normalized = toPosix(relativePath);
  return matchesAnyGlob(normalized, exclude);
}

export interface ProjectFile {
  /** Path relative to the project root, using forward slashes. */
  path: string;
  absolutePath: string;
  size: number;
}

export interface WalkResult {
  files: ProjectFile[];
  truncated: boolean;
  skippedSymlinks: number;
}

export interface WalkOptions {
  exclude?: string[];
  maxFiles?: number;
  /** Hard limit on directory entries, independent of the file limit, to bound traversal. */
  maxEntries?: number;
}

/**
 * Deterministic, bounded project walk. Symlinks are never followed and large dependency
 * directories are skipped before descent so scans stay fast and local.
 */
export async function walkProject(root: string, options: WalkOptions = {}): Promise<WalkResult> {
  const exclude = options.exclude ?? DEFAULT_SCAN_EXCLUDES;
  const maxFiles = options.maxFiles ?? 5000;
  const maxEntries = options.maxEntries ?? Math.max(maxFiles * 4, 10_000);
  const files: ProjectFile[] = [];
  let entries = 0;
  let truncated = false;
  let skippedSymlinks = 0;

  async function visit(absoluteDir: string, relativeDir: string): Promise<void> {
    if (truncated) {
      return;
    }
    let directoryEntries;
    try {
      directoryEntries = await fs.readdir(absoluteDir, { withFileTypes: true });
    } catch {
      return;
    }
    directoryEntries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of directoryEntries) {
      entries += 1;
      if (entries > maxEntries) {
        truncated = true;
        return;
      }
      if (entry.isSymbolicLink()) {
        skippedSymlinks += 1;
        continue;
      }
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (DEFAULT_IGNORED_DIRS.has(entry.name)) {
          continue;
        }
        if (matchesAnyGlob(`${toPosix(relativePath)}/`, exclude)) {
          continue;
        }
        await visit(path.join(absoluteDir, entry.name), relativePath);
        if (truncated) {
          return;
        }
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (matchesAnyGlob(relativePath, exclude)) {
        continue;
      }
      let size = 0;
      try {
        const stat = await fs.stat(path.join(absoluteDir, entry.name));
        size = stat.size;
      } catch {
        continue;
      }
      files.push({
        path: toPosix(relativePath),
        absolutePath: path.join(absoluteDir, entry.name),
        size,
      });
      if (files.length >= maxFiles) {
        truncated = true;
        return;
      }
    }
  }

  await visit(root, '');
  return { files, truncated, skippedSymlinks };
}

export interface TextFileResult {
  text: string;
  truncated: boolean;
  binary: boolean;
}

export async function readTextFile(
  absolutePath: string,
  maxBytes = 1_000_000,
): Promise<TextFileResult | null> {
  let handle;
  try {
    handle = await fs.open(absolutePath, 'r');
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size === 0) {
      return null;
    }
    const readBytes = Math.min(stat.size, maxBytes + 1);
    const buffer = Buffer.alloc(readBytes);
    await handle.read(buffer, 0, readBytes, 0);
    const chunk = buffer.subarray(0, readBytes);
    const binary = chunk.subarray(0, Math.min(chunk.length, 8000)).includes(0);
    if (binary) {
      return { text: '', truncated: false, binary: true };
    }
    return {
      text: chunk.toString('utf8'),
      truncated: stat.size > maxBytes,
      binary: false,
    };
  } catch {
    return null;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

export async function readJsonFile<T>(absolutePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(absolutePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function pathExists(absolutePath: string): Promise<boolean> {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

export async function readPackageJson(
  absolutePath: string,
): Promise<Record<string, unknown> | null> {
  return readJsonFile<Record<string, unknown>>(absolutePath);
}
