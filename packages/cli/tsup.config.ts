import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  dts: false,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  // The workspace packages are not published, and the public npm name belongs to another project.
  // Bundle runtime dependencies so `npm pack` produces a self-contained CLI tarball.
  noExternal: ['@launchproof/core', '@launchproof/browser'],
  // Keep CJS runtime dependencies external; bundling them breaks `require()` in ESM output.
  external: ['yaml', 'zod'],
});
