import path from 'node:path';

import type { LaunchProofConfig } from './config/schema.js';
import {
  matchesAnyGlob,
  pathExists,
  readPackageJson,
  walkProject,
  type ProjectFile,
} from './fs-utils.js';
import { TextCache, isCodeFile } from './text-cache.js';
import type { ApiRouteInfo, ProjectProfile } from './types.js';
import { unique } from './util.js';

const FRAMEWORK_DEPS: Array<[string, string]> = [
  ['next', 'Next.js'],
  ['react', 'React'],
  ['vue', 'Vue'],
  ['nuxt', 'Nuxt'],
  ['svelte', 'Svelte'],
  ['@sveltejs/kit', 'SvelteKit'],
  ['astro', 'Astro'],
  ['@remix-run/react', 'Remix'],
  ['@angular/core', 'Angular'],
  ['solid-js', 'Solid'],
  ['express', 'Express'],
  ['fastify', 'Fastify'],
  ['hono', 'Hono'],
  ['koa', 'Koa'],
  ['@nestjs/core', 'NestJS'],
  ['elysia', 'Elysia'],
];

const INTEGRATION_DEPS: Array<[string, string]> = [
  ['@supabase/supabase-js', 'Supabase'],
  ['firebase', 'Firebase'],
  ['stripe', 'Stripe'],
  ['@stripe/stripe-js', 'Stripe'],
  ['@clerk/nextjs', 'Clerk'],
  ['@clerk/clerk-react', 'Clerk'],
  ['next-auth', 'NextAuth'],
  ['@auth/core', 'Auth.js'],
  ['@auth0/nextjs-auth0', 'Auth0'],
  ['prisma', 'Prisma'],
  ['@prisma/client', 'Prisma'],
  ['drizzle-orm', 'Drizzle ORM'],
  ['mongoose', 'MongoDB'],
  ['openai', 'OpenAI'],
  ['@anthropic-ai/sdk', 'Anthropic'],
  ['resend', 'Resend'],
  ['@sendgrid/mail', 'SendGrid'],
  ['postmark', 'Postmark'],
  ['@sentry/nextjs', 'Sentry'],
  ['posthog-js', 'PostHog'],
  ['mixpanel', 'Mixpanel'],
  ['@upstash/redis', 'Upstash'],
  ['cloudinary', 'Cloudinary'],
  ['uploadthing', 'UploadThing'],
  ['@vercel/blob', 'Vercel Blob'],
  ['langfuse', 'Langfuse'],
];

const TEST_DEPS: Array<[string, string]> = [
  ['vitest', 'Vitest'],
  ['jest', 'Jest'],
  ['@playwright/test', 'Playwright'],
  ['playwright', 'Playwright'],
  ['cypress', 'Cypress'],
  ['mocha', 'Mocha'],
  ['@testing-library/react', 'Testing Library'],
  ['pytest', 'pytest'],
  ['supertest', 'Supertest'],
];

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.py': 'Python',
  '.rb': 'Ruby',
  '.go': 'Go',
  '.php': 'PHP',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.cs': 'C#',
  '.rs': 'Rust',
  '.swift': 'Swift',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.sql': 'SQL',
};

export interface DiscoveryResult {
  profile: ProjectProfile;
  rootDir: string;
  files: ProjectFile[];
  walkTruncated: boolean;
  skippedSymlinks: number;
  trackedFiles: Set<string> | null;
  envExampleKeys: string[];
  packageJson: Record<string, unknown> | null;
  cache: TextCache;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readDependencies(pkg: Record<string, unknown>): {
  all: Map<string, string>;
  direct: number;
  dev: number;
} {
  const all = new Map<string, string>();
  const dependencies = asRecord(pkg.dependencies);
  const devDependencies = asRecord(pkg.devDependencies);
  for (const [name, version] of Object.entries(dependencies)) {
    all.set(name, String(version));
  }
  for (const [name, version] of Object.entries(devDependencies)) {
    all.set(name, String(version));
  }
  return {
    all,
    direct: Object.keys(dependencies).length,
    dev: Object.keys(devDependencies).length,
  };
}

function detectPackageManager(
  pkg: Record<string, unknown>,
  files: ProjectFile[],
): ProjectProfile['packageManager'] {
  const declared = typeof pkg.packageManager === 'string' ? pkg.packageManager.split('@')[0] : '';
  if (declared === 'npm' || declared === 'pnpm' || declared === 'yarn' || declared === 'bun') {
    return declared;
  }
  const names = new Set(files.map((file) => file.path.split('/').pop() ?? ''));
  if (names.has('pnpm-lock.yaml')) return 'pnpm';
  if (names.has('yarn.lock')) return 'yarn';
  if (names.has('bun.lockb') || names.has('bun.lock')) return 'bun';
  if (names.has('package-lock.json')) return 'npm';
  return 'unknown';
}

function nextRoutePath(relative: string): string | null {
  const match = /^(?:src\/)?app\/(.*)\/route\.(?:ts|js|tsx|jsx)$/.exec(relative);
  if (!match) {
    return null;
  }
  const segments = (match[1] ?? '')
    .split('/')
    .filter((segment) => segment.length > 0 && !/^\(.*\)$/.test(segment))
    .map((segment) => {
      if (segment.startsWith('[...') && segment.endsWith(']')) return `*${segment.slice(4, -1)}`;
      if (segment.startsWith('[') && segment.endsWith(']')) return `:${segment.slice(1, -1)}`;
      return segment;
    });
  return `/${segments.join('/')}`.replace(/\/$/, '') || '/';
}

function nextPagesRoute(relative: string): string | null {
  const match = /^(?:src\/)?pages\/(api\/.*)\.(?:ts|js|tsx|jsx)$/.exec(relative);
  if (!match) {
    return null;
  }
  let route = match[1] ?? '';
  route = route.replace(/\/index$/, '');
  route = route
    .split('/')
    .map((segment) =>
      segment.startsWith('[...') && segment.endsWith(']')
        ? `*${segment.slice(4, -1)}`
        : segment.startsWith('[') && segment.endsWith(']')
          ? `:${segment.slice(1, -1)}`
          : segment,
    )
    .join('/');
  return `/${route}`;
}

function routeMethods(text: string): string {
  const methods: string[] = [];
  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
    if (new RegExp(`export\\s+(?:async\\s+)?(?:function|const)\\s+${method}\\b`).test(text)) {
      methods.push(method);
    }
  }
  return methods.length > 0 ? methods.join(',') : 'GET';
}

function extractExpressRoutes(text: string): ApiRouteInfo[] {
  const routes: ApiRouteInfo[] = [];
  const pattern =
    /\b(?:app|router|server)\.(get|post|put|patch|delete|all)\(\s*['"`]([^'"`\s]+)['"`]/gi;
  for (const match of text.matchAll(pattern)) {
    routes.push({
      file: '',
      method: (match[1] ?? 'get').toUpperCase(),
      path: match[2] ?? '/',
      framework: 'Express',
    });
  }
  return routes;
}

async function readTextSafe(filePath: string): Promise<string | null> {
  try {
    const { readTextFile } = await import('./fs-utils.js');
    const result = await readTextFile(filePath, 400_000);
    return result && !result.binary ? result.text : null;
  } catch {
    return null;
  }
}

async function collectApiRoutes(files: ProjectFile[]): Promise<ApiRouteInfo[]> {
  const routes: ApiRouteInfo[] = [];
  for (const file of files) {
    if (routes.length >= 100) {
      break;
    }
    const nextPath = nextRoutePath(file.path);
    if (nextPath) {
      const text = (await readTextSafe(file.absolutePath)) ?? '';
      routes.push({
        file: file.path,
        method: routeMethods(text),
        path: nextPath,
        framework: 'Next.js App Router',
      });
      continue;
    }
    const pagesPath = nextPagesRoute(file.path);
    if (pagesPath) {
      routes.push({
        file: file.path,
        method: 'ALL',
        path: pagesPath,
        framework: 'Next.js Pages Router',
      });
      continue;
    }
    if (!isCodeFile(file) || file.size > 300_000) {
      continue;
    }
    if (/\.(?:py)$/i.test(file.path)) {
      const text = await readTextSafe(file.absolutePath);
      if (!text) continue;
      for (const match of text.matchAll(
        /@(?:app|router)\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/gi,
      )) {
        routes.push({
          file: file.path,
          method: (match[1] ?? 'get').toUpperCase(),
          path: match[2] ?? '/',
          framework: 'FastAPI',
        });
        if (routes.length >= 100) break;
      }
      continue;
    }
    if (/(?:routes?|server|api|app)\.(?:ts|js|mjs|cjs|tsx|jsx)$/i.test(file.path)) {
      const text = await readTextSafe(file.absolutePath);
      if (!text || !/\b(?:app|router|server)\.(?:get|post|put|patch|delete)\s*\(/.test(text)) {
        continue;
      }
      for (const route of extractExpressRoutes(text)) {
        routes.push({ ...route, file: file.path });
        if (routes.length >= 100) break;
      }
    }
  }
  return routes;
}

async function readEnvExampleKeys(files: ProjectFile[]): Promise<string[]> {
  const keys = new Set<string>();
  const templates = files.filter((file) =>
    /(?:^|\/)\.env(?:\.example|\.sample|\.template)$/.test(file.path),
  );
  for (const file of templates.slice(0, 5)) {
    const text = await readTextSafe(file.absolutePath);
    if (!text) continue;
    for (const line of text.split(/\r?\n/)) {
      const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
      if (match?.[1]) keys.add(match[1]);
    }
  }
  return [...keys].sort().slice(0, 100);
}

async function collectEnvReferences(files: ProjectFile[]): Promise<string[]> {
  const keys = new Set<string>();
  const candidates = files.filter((file) => isCodeFile(file) && file.size < 300_000).slice(0, 250);
  for (const file of candidates) {
    const text = await readTextSafe(file.absolutePath);
    if (!text) continue;
    for (const match of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]{2,})/g)) {
      if (match[1]) keys.add(match[1]);
    }
    for (const match of text.matchAll(/process\.env\[['"]([A-Z][A-Z0-9_]{2,})['"]\]/g)) {
      if (match[1]) keys.add(match[1]);
    }
    if (keys.size >= 100) break;
  }
  return [...keys].sort().slice(0, 100);
}

async function detectPythonStack(
  rootDir: string,
  files: ProjectFile[],
): Promise<{ frameworks: string[]; integrations: string[]; tests: string[] }> {
  const frameworks: string[] = [];
  const integrations: string[] = [];
  const tests: string[] = [];
  const manifests = files.filter((file) =>
    /(?:^|\/)(?:requirements(?:-dev)?\.txt|pyproject\.toml|Pipfile)$/.test(file.path),
  );
  let combined = '';
  for (const manifest of manifests.slice(0, 3)) {
    combined += `\n${(await readTextSafe(manifest.absolutePath)) ?? ''}`;
  }
  const lower = combined.toLowerCase();
  if (/\bdjango\b/.test(lower) || (await pathExists(path.join(rootDir, 'manage.py')))) {
    frameworks.push('Django');
  }
  if (/\bfastapi\b/.test(lower)) frameworks.push('FastAPI');
  if (/\bflask\b/.test(lower)) frameworks.push('Flask');
  if (/\bsupabase\b/.test(lower)) integrations.push('Supabase');
  if (/\bstripe\b/.test(lower)) integrations.push('Stripe');
  if (/\bopenai\b/.test(lower)) integrations.push('OpenAI');
  if (/\bpytest\b/.test(lower)) tests.push('pytest');
  void files;
  return { frameworks, integrations, tests };
}

/**
 * Builds an evidence-based project profile from the filesystem only. No network access and
 * no secret values are read into the profile.
 */
export async function discoverProject(
  rootDir: string,
  config: LaunchProofConfig,
  trackedFiles: Set<string> | null = null,
): Promise<DiscoveryResult> {
  const walk = await walkProject(rootDir, {
    exclude: config.scan.exclude,
    maxFiles: config.scan.maxFiles,
  });
  const files = config.scan.include.length
    ? walk.files.filter((file) => matchesAnyGlob(file.path, config.scan.include))
    : walk.files;

  const packageJson = await readPackageJson(path.join(rootDir, 'package.json'));
  const { all: dependencies, direct, dev } = readDependencies(packageJson ?? {});
  const python = await detectPythonStack(rootDir, files);

  const frameworks = new Set<string>(python.frameworks);
  const integrations = new Set<string>(python.integrations);
  const testFrameworks = new Set<string>(python.tests);
  for (const [dep, label] of FRAMEWORK_DEPS) {
    if (dependencies.has(dep)) frameworks.add(label);
  }
  for (const [dep, label] of INTEGRATION_DEPS) {
    if (dependencies.has(dep)) integrations.add(label);
  }
  for (const [dep, label] of TEST_DEPS) {
    if (dependencies.has(dep)) testFrameworks.add(label);
  }

  const languageCounts = new Map<string, number>();
  for (const file of files) {
    const extension = path.extname(file.path).toLowerCase();
    const language = LANGUAGE_BY_EXTENSION[extension];
    if (language) {
      languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1);
    }
  }
  const languages = [...languageCounts.entries()]
    .map(([name, count]) => ({ name, files: count }))
    .sort((a, b) => b.files - a.files || a.name.localeCompare(b.name))
    .slice(0, 8);

  const scriptsValue = asRecord(packageJson?.scripts);
  const scripts: Record<string, string> = {};
  for (const [name, value] of Object.entries(scriptsValue)) {
    if (typeof value === 'string') scripts[name] = value;
  }

  const deployment: string[] = [];
  const fileNames = new Set(files.map((file) => file.path));
  if (fileNames.has('vercel.json') || dependencies.has('next')) deployment.push('Vercel');
  if (fileNames.has('netlify.toml')) deployment.push('Netlify');
  if ([...fileNames].some((name) => name.endsWith('Dockerfile'))) deployment.push('Docker');
  if (fileNames.has('render.yaml')) deployment.push('Render');
  if (fileNames.has('fly.toml')) deployment.push('Fly.io');
  if (fileNames.has('railway.json')) deployment.push('Railway');
  if (fileNames.has('Procfile')) deployment.push('Procfile-based');
  for (const file of files) {
    if (
      /^\.github\/workflows\/.*\.ya?ml$/.test(file.path) &&
      !deployment.includes('GitHub Actions')
    ) {
      deployment.push('GitHub Actions');
    }
  }

  const apiRoutes = await collectApiRoutes(files);
  const envExampleKeys = await readEnvExampleKeys(files);
  const envReferences = await collectEnvReferences(files);
  const envVars = unique([...envExampleKeys, ...envReferences]).slice(0, 100);

  const notable = [...frameworks, ...integrations, ...testFrameworks].slice(0, 20);
  for (const name of ['typescript', 'tailwindcss', 'zod', 'prisma', 'drizzle-orm', 'react']) {
    if (dependencies.has(name)) notable.push(name);
  }

  const isMonorepo =
    Boolean(packageJson?.workspaces) ||
    fileNames.has('pnpm-workspace.yaml') ||
    fileNames.has('lerna.json') ||
    fileNames.has('turbo.json');

  const profile: ProjectProfile = {
    name:
      config.project.name ??
      (typeof packageJson?.name === 'string' && packageJson.name.length > 0
        ? packageJson.name
        : path.basename(rootDir)),
    packageManager: detectPackageManager(packageJson ?? {}, files),
    monorepo: isMonorepo,
    frameworks: unique([...frameworks]),
    languages,
    scripts,
    dependencies: {
      direct,
      dev,
      notable: unique(notable).slice(0, 20),
    },
    apiRoutes,
    testFrameworks: unique([...testFrameworks]),
    deployment: unique(deployment),
    integrations: unique([...integrations]),
    envVars,
    filesScanned: files.length,
    truncated: walk.truncated,
    ignoredLargeFiles: files.filter((file) => file.size > config.scan.maxFileBytes).length,
  };

  return {
    profile,
    rootDir,
    files,
    walkTruncated: walk.truncated,
    skippedSymlinks: walk.skippedSymlinks,
    trackedFiles,
    envExampleKeys,
    packageJson,
    cache: new TextCache(config.scan.maxFileBytes),
  };
}
