import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'apps/web/**'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Browser tests launch a single Chromium instance; avoid competing workers.
    fileParallelism: false,
    maxWorkers: 2,
    reporters: ['default'],
  },
});
