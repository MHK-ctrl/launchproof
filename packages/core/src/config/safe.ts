import type { LaunchProofConfig } from './schema.js';
import type { SafeConfigSummary, ScanMode, Severity } from '../types.js';

/** Returns a configuration view safe to print or embed in reports: no env values, headers, or secrets. */
export function safeConfigSummary(
  config: LaunchProofConfig,
  target: string | null,
  mode: ScanMode,
): SafeConfigSummary {
  return {
    target,
    mode,
    failOn: config.scan.failOn as Severity,
    networkEnabled: config.scan.network,
    fileScan: {
      include: [...config.scan.include],
      excludeCount: config.scan.exclude.length,
      gitHistory: config.scan.gitHistory,
      maxFiles: config.scan.maxFiles,
    },
    api: {
      baseUrl: config.api.baseUrl ?? null,
      endpointCount: config.api.endpoints.length,
      openapi: config.api.openapi ?? null,
      unsafeMethods: config.api.allowUnsafeMethods,
    },
    authIdentities: Object.keys(config.auth.identities),
    authorizationResources: config.authorizationTests.resources.length,
    browser: {
      enabled: config.browser.enabled,
      workflows: config.browser.workflows.length,
      baseUrl: config.browser.baseUrl ?? config.app.url ?? null,
    },
    accessibility: {
      enabled: config.accessibility.enabled,
      tags: [...config.accessibility.tags],
    },
    performance: {
      enabled: config.performance.enabled,
      lighthouse: config.performance.lighthouse,
    },
    supabase: {
      staticAnalysis: config.supabase.enabled,
      liveConfigured: Boolean(config.supabase.live),
    },
  };
}
