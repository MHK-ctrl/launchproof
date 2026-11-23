import { readTextFile, type ProjectFile, type TextFileResult } from './fs-utils.js';

/**
 * Bounded text cache. Scanners share it so each project file is read at most once, while the
 * entry cap keeps memory predictable on large repositories.
 */
export class TextCache {
  private readonly cache = new Map<string, Promise<TextFileResult | null>>();

  constructor(
    private readonly maxBytes = 750_000,
    private readonly maxEntries = 2500,
  ) {}

  get(file: ProjectFile): Promise<TextFileResult | null> {
    const key = file.path;
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }
    const promise = readTextFile(file.absolutePath, this.maxBytes);
    this.cache.set(key, promise);
    if (this.cache.size > this.maxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
      }
    }
    return promise;
  }

  async text(file: ProjectFile): Promise<string | null> {
    const result = await this.get(file);
    if (!result || result.binary) {
      return null;
    }
    return result.text;
  }

  get size(): number {
    return this.cache.size;
  }
}

const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.vue',
  '.svelte',
  '.py',
  '.rb',
  '.go',
  '.php',
  '.java',
  '.kt',
  '.cs',
  '.rs',
  '.swift',
  '.sql',
  '.html',
  '.htm',
  '.css',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.env',
  '.example',
  '.sh',
  '.tf',
]);

export function isScannableTextFile(file: ProjectFile): boolean {
  const lower = file.path.toLowerCase();
  const base = lower.split('/').pop() ?? lower;
  if (base.startsWith('.env')) {
    return true;
  }
  const dot = base.lastIndexOf('.');
  if (dot < 0) {
    return false;
  }
  return CODE_EXTENSIONS.has(base.slice(dot));
}

export function isCodeFile(file: ProjectFile): boolean {
  return /\.(?:ts|tsx|js|jsx|mjs|cjs|vue|svelte|py|rb|go|php|java|kt|cs|rs|swift)$/i.test(
    file.path,
  );
}
