import { promises as fs } from 'node:fs';
import path from 'node:path';

import { pathExists } from '../fs-utils.js';

export interface DotEnvResult {
  files: string[];
  keys: string[];
  warnings: string[];
}

function parseDotEnv(source: string): { values: Map<string, string>; invalidLines: number } {
  const values = new Map<string, string>();
  let invalidLines = 0;
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }
    const withoutExport = line.startsWith('export ') ? line.slice(7).trim() : line;
    const separator = withoutExport.indexOf('=');
    if (separator <= 0) {
      invalidLines += 1;
      continue;
    }
    const key = withoutExport.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      invalidLines += 1;
      continue;
    }
    let value = withoutExport.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      const quote = value[0];
      value = value.slice(1, -1);
      if (quote === '"') {
        value = value
          .replaceAll('\\n', '\n')
          .replaceAll('\\r', '\r')
          .replaceAll('\\t', '\t')
          .replaceAll('\\"', '"')
          .replaceAll('\\\\', '\\');
      }
    } else {
      const commentIndex = value.indexOf(' #');
      if (commentIndex >= 0) {
        value = value.slice(0, commentIndex).trim();
      }
    }
    values.set(key, value);
  }
  return { values, invalidLines };
}

/**
 * Loads `.env` then `.env.local` (local values win) without overriding variables that are
 * already set in the process environment. Values are never returned or logged.
 */
export async function loadDotEnvFiles(
  rootDir: string,
  targetEnv: NodeJS.ProcessEnv = process.env,
): Promise<DotEnvResult> {
  const files: string[] = [];
  const keys = new Set<string>();
  const warnings: string[] = [];
  const merged = new Map<string, string>();

  for (const name of ['.env', '.env.local']) {
    const filePath = path.join(rootDir, name);
    if (!(await pathExists(filePath))) {
      continue;
    }
    try {
      const source = await fs.readFile(filePath, 'utf8');
      const { values, invalidLines } = parseDotEnv(source);
      if (invalidLines > 0) {
        warnings.push(`${name}: ignored ${invalidLines} malformed line(s).`);
      }
      for (const [key, value] of values) {
        merged.set(key, value);
      }
      files.push(filePath);
    } catch {
      warnings.push(`${name}: could not be read.`);
    }
  }

  for (const [key, value] of merged) {
    keys.add(key);
    if (targetEnv[key] === undefined) {
      targetEnv[key] = value;
    }
  }

  return { files, keys: [...keys].sort(), warnings };
}
