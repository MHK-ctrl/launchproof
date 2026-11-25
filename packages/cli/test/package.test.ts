import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Packaging regression tests.
 *
 * These encode the specific ways a clean install broke before:
 *   - the package was named `launchproof`, which on npm is an unrelated project, so anyone running
 *     `npm install -g launchproof` got someone else's tool;
 *   - the tarball shipped without a licence despite declaring MIT;
 *   - runtime dependencies on unpublished workspace packages would make the installed CLI fail to
 *     resolve `@launchproof/core` at runtime.
 *
 * They read the real package.json, not a fixture, so they fail on the commit that reintroduces the
 * problem rather than after publication.
 */

const PACKAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(PACKAGE_DIR, 'package.json'), 'utf8')) as {
  name: string;
  version: string;
  license: string;
  bin?: Record<string, string>;
  files?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  repository?: { url?: string; directory?: string };
  homepage?: string;
  engines?: { node?: string };
  publishConfig?: { access?: string };
};

describe('npm package identity', () => {
  it('is not published under the unrelated public name "launchproof"', () => {
    // registry.npmjs.org/launchproof is maintained by a different project (aabbcdl/LaunchProof).
    expect(pkg.name).not.toBe('launchproof');
  });

  it('uses a scope for the published name', () => {
    expect(pkg.name.startsWith('@')).toBe(true);
    expect(pkg.name).toMatch(/^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/);
  });

  it('declares a semver version', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
  });

  it('declares public access so a scoped package can be published', () => {
    expect(pkg.publishConfig?.access).toBe('public');
  });

  it('points at the repository and its subdirectory', () => {
    expect(pkg.repository?.url).toBe('git+https://github.com/MHK-ctrl/launchproof.git');
    expect(pkg.repository?.directory).toBe('packages/cli');
    expect(pkg.homepage).toBeTruthy();
  });

  it('requires the same Node floor as the monorepo', () => {
    expect(pkg.engines?.node).toBe('>=22.12.0');
  });
});

describe('npm package contents', () => {
  it('maps the bin to an existing executable entry point with a shebang', () => {
    const bin = pkg.bin?.launchproof;
    expect(bin).toBe('bin/launchproof.mjs');
    const target = path.join(PACKAGE_DIR, bin!);
    expect(existsSync(target)).toBe(true);
    expect(readFileSync(target, 'utf8').split('\n')[0]).toBe('#!/usr/bin/env node');
  });

  it('ships the built CLI, the bin, the licence, and the README', () => {
    expect(pkg.files).toEqual(expect.arrayContaining(['bin', 'dist', 'LICENSE', 'README.md']));
  });

  it('has a licence file in the package so the tarball is not unlicensed', () => {
    const licence = path.join(PACKAGE_DIR, 'LICENSE');
    expect(existsSync(licence)).toBe(true);
    expect(readFileSync(licence, 'utf8')).toContain('MIT License');
    expect(pkg.license).toBe('MIT');
  });

  it('does not declare runtime dependencies on unpublished workspace packages', () => {
    // tsup bundles @launchproof/core and @launchproof/browser (see tsup.config.ts noExternal).
    // Listing them as dependencies would make `npm install` fail for every consumer.
    const deps = Object.keys(pkg.dependencies ?? {});
    expect(deps).not.toContain('@launchproof/core');
    expect(deps).not.toContain('@launchproof/browser');
    expect(deps.length).toBeGreaterThan(0);
  });

  it('keeps Playwright and axe-core optional', () => {
    const meta = JSON.parse(readFileSync(path.join(PACKAGE_DIR, 'package.json'), 'utf8')) as {
      peerDependenciesMeta?: Record<string, { optional?: boolean }>;
    };
    expect(meta.peerDependenciesMeta?.playwright?.optional).toBe(true);
    expect(meta.peerDependenciesMeta?.['axe-core']?.optional).toBe(true);
  });

  it('bundles workspace packages in the build configuration', () => {
    const tsup = readFileSync(path.join(PACKAGE_DIR, 'tsup.config.ts'), 'utf8');
    expect(tsup).toContain('@launchproof/core');
    expect(tsup).toContain('@launchproof/browser');
    expect(tsup).toContain('noExternal');
  });
});
