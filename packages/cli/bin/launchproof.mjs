#!/usr/bin/env node
import('../dist/index.js').catch((error) => {
  console.error('LaunchProof failed to start:', error instanceof Error ? error.message : error);
  process.exitCode = 3;
});
