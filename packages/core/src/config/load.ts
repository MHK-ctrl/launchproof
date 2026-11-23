import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

import { ConfigError } from '../errors.js';
import { pathExists } from '../fs-utils.js';
import { DEFAULT_CONFIG_FILENAMES } from '../version.js';
import {
  configurationSchema,
  createDefaultConfig,
  formatZodIssues,
  type LaunchProofConfig,
} from './schema.js';

export interface LoadedConfig {
  config: LaunchProofConfig;
  /** Absolute config path, or null when built-in defaults are in use. */
  path: string | null;
  rootDir: string;
  warnings: string[];
}

export interface LoadConfigOptions {
  cwd: string;
  configPath?: string;
}

export async function findConfigFile(cwd: string): Promise<string | null> {
  for (const name of DEFAULT_CONFIG_FILENAMES) {
    const candidate = path.join(cwd, name);
    if (await pathExists(candidate)) {
      return candidate;
    }
  }
  return null;
}

function parseConfigSource(source: string, filePath: string): unknown {
  const extension = path.extname(filePath).toLowerCase();
  try {
    if (extension === '.json') {
      return JSON.parse(source) as unknown;
    }
    return parseYaml(source) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigError(`Could not parse ${filePath}: ${message}`);
  }
}

/**
 * Loads configuration from an explicit path or the first known config filename in the
 * project root. With no file present, strict defaults are returned.
 */
export async function loadConfig(options: LoadConfigOptions): Promise<LoadedConfig> {
  const rootDir = path.resolve(options.cwd);
  let filePath: string | null = null;
  const warnings: string[] = [];

  if (options.configPath) {
    filePath = path.resolve(rootDir, options.configPath);
    if (!(await pathExists(filePath))) {
      throw new ConfigError(`Config file not found: ${filePath}`);
    }
  } else {
    filePath = await findConfigFile(rootDir);
  }

  let raw: unknown = {};
  if (filePath) {
    let source: string;
    try {
      source = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ConfigError(`Could not read ${filePath}: ${message}`);
    }
    if (source.trim().length === 0) {
      warnings.push(`Config file is empty; using defaults: ${filePath}`);
    } else {
      raw = parseConfigSource(source, filePath);
    }
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new ConfigError(`Config root must be an object: ${filePath}`);
    }
  }

  const parsed = configurationSchema.safeParse(raw);
  if (!parsed.success) {
    const location = filePath ?? 'launchproof.config.json';
    throw new ConfigError(
      `Invalid LaunchProof configuration in ${location}:\n${formatZodIssues(parsed.error)}`,
    );
  }

  if (!parsed.data.app.url && !parsed.data.api.baseUrl && parsed.data.browser.enabled) {
    warnings.push(
      'browser.enabled is true but no app.url or browser.baseUrl is configured; browser checks will be skipped.',
    );
  }

  return {
    config: parsed.data,
    path: filePath,
    rootDir,
    warnings,
  };
}

export { createDefaultConfig };
export type { LaunchProofConfig };
