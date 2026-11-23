import { z } from 'zod';

import { DEFAULT_SCAN_EXCLUDES } from '../fs-utils.js';

export const severitySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
const httpMethodSchema = z.enum(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const statusCodeSchema = z.number().int().min(100).max(599);
const statusExpectationSchema = z.union([
  statusCodeSchema,
  z.array(statusCodeSchema).min(1).max(10),
]);
const rejectionStatusExpectationSchema = statusExpectationSchema.refine(
  (value) => (Array.isArray(value) ? value : [value]).every((status) => status >= 400),
  {
    message:
      'expectStatusForOther must contain only rejection statuses (400-599); a success status would make the authorization check vacuous.',
  },
);
const safeUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => {
      const url = new URL(value);
      return url.username.length === 0 && url.password.length === 0;
    },
    { message: 'URLs must not contain embedded credentials.' },
  );
const sameOriginPathSchema = z
  .string()
  .startsWith('/')
  .refine((value) => !value.startsWith('//'), {
    message: 'Path must remain on the configured origin (protocol-relative URLs are not allowed).',
  });

const projectSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
});

const appSchema = z.object({
  url: safeUrlSchema.optional(),
  startCommand: z.string().max(500).optional(),
  healthPath: sameOriginPathSchema.default('/'),
  framework: z.string().max(80).optional(),
});

const authorizationSchema = z.object({
  authorized: z.boolean().default(false),
  scope: z.array(z.string().min(1).max(500)).max(100).default([]),
  allowLocal: z.boolean().default(true),
  allowPrivateNetwork: z.boolean().default(false),
});

const scanSchema = z.object({
  include: z.array(z.string()).max(500).default([]),
  exclude: z.array(z.string()).max(500).default(DEFAULT_SCAN_EXCLUDES),
  maxFiles: z.number().int().min(10).max(50_000).default(8000),
  maxFileBytes: z.number().int().min(1024).max(10_000_000).default(750_000),
  gitHistory: z.boolean().default(false),
  gitHistoryMaxCommits: z.number().int().min(1).max(5000).default(200),
  failOn: severitySchema.default('high'),
  network: z.boolean().default(false),
});

const httpSchema = z.object({
  timeoutMs: z.number().int().min(1000).max(60_000).default(10_000),
  maxRequests: z.number().int().min(1).max(300).default(50),
  requestsPerSecond: z.number().min(0.5).max(20).default(4),
  maxRedirects: z.number().int().min(0).max(10).default(5),
  maxResponseBytes: z.number().int().min(10_000).max(10_000_000).default(1_500_000),
  checkSensitivePaths: z.boolean().default(true),
  extraPaths: z.array(sameOriginPathSchema).max(50).default([]),
  headers: z.record(z.string(), z.string().max(300)).prefault({}),
});

const endpointSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  path: sameOriginPathSchema,
  method: httpMethodSchema.default('GET'),
  expectStatus: statusExpectationSchema.default(200),
  expectJson: z.boolean().default(false),
  requiredJsonKeys: z.array(z.string()).default([]),
  maxResponseMs: z.number().int().min(100).max(60_000).optional(),
  identity: z.string().optional(),
  /** Anonymous requests to this endpoint should be rejected. */
  requiresAuth: z.boolean().default(false),
  body: z.unknown().optional(),
});

const apiSchema = z.object({
  baseUrl: safeUrlSchema.optional(),
  openapi: z.string().optional(),
  allowUnsafeMethods: z.boolean().default(false),
  maxEndpoints: z.number().int().min(1).max(100).default(40),
  endpoints: z.array(endpointSchema).max(50).default([]),
});

const identitySchema = z.object({
  description: z.string().max(200).optional(),
  headersEnv: z.record(z.string(), z.string()).prefault({}),
  cookieEnv: z.string().optional(),
});

const authSchema = z.object({
  identities: z.record(z.string(), identitySchema).prefault({}),
});

const authorizationResourceSchema = z
  .object({
    name: z.string().min(1).max(80),
    path: sameOriginPathSchema.optional(),
    url: safeUrlSchema.optional(),
    method: httpMethodSchema.default('GET'),
    ownerIdentity: z.string().min(1),
    otherIdentity: z.string().min(1),
    expectStatusForOther: rejectionStatusExpectationSchema.default([401, 403, 404]),
    allowUnsafeMethod: z.boolean().default(false),
    body: z.unknown().optional(),
  })
  .refine((resource) => Boolean(resource.path ?? resource.url), {
    message: 'Each authorization resource requires either "path" or "url".',
  });

const authorizationTestsSchema = z.object({
  allowUnsafeMethods: z.boolean().default(false),
  resources: z.array(authorizationResourceSchema).max(50).default([]),
});

const viewportSchema = z.object({
  width: z.number().int().min(240).max(3840).default(1280),
  height: z.number().int().min(240).max(2160).default(800),
});

const workflowStepSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('goto'),
    path: sameOriginPathSchema.default('/'),
  }),
  z.object({
    action: z.literal('click'),
    selector: z.string().min(1),
  }),
  z.object({
    action: z.literal('fill'),
    selector: z.string().min(1),
    value: z.string().default(''),
    valueEnv: z.string().optional(),
    secret: z.boolean().default(false),
  }),
  z.object({
    action: z.literal('press'),
    selector: z.string().min(1),
    key: z.string().min(1).max(40),
  }),
  z.object({
    action: z.literal('expectText'),
    text: z.string().min(1).max(500),
    selector: z.string().optional(),
  }),
  z.object({
    action: z.literal('expectVisible'),
    selector: z.string().min(1),
  }),
  z.object({
    action: z.literal('expectUrl'),
    contains: z.string().min(1).max(500),
  }),
  z.object({
    action: z.literal('wait'),
    ms: z.number().int().min(0).max(5000).default(500),
  }),
  z.object({
    action: z.literal('screenshot'),
    name: z.string().min(1).max(60).optional(),
  }),
]);

const workflowSchema = z.object({
  name: z.string().min(1).max(80),
  path: sameOriginPathSchema.default('/'),
  identity: z.string().optional(),
  steps: z.array(workflowStepSchema).max(50).default([]),
  expectNoConsoleErrors: z.boolean().default(true),
});

const browserSchema = z.object({
  enabled: z.boolean().default(false),
  baseUrl: safeUrlSchema.optional(),
  headless: z.boolean().default(true),
  timeoutMs: z.number().int().min(2000).max(60_000).default(20_000),
  viewport: viewportSchema.prefault({}),
  mobileViewport: z
    .object({
      width: z.number().int().min(240).max(1000).default(390),
      height: z.number().int().min(240).max(1400).default(844),
    })
    .prefault({}),
  maxPages: z.number().int().min(1).max(20).default(5),
  maxLinksPerPage: z.number().int().min(0).max(100).default(25),
  screenshots: z.enum(['never', 'on-failure', 'always']).default('on-failure'),
  trace: z.enum(['never', 'on-failure']).default('never'),
  checkMobileLayout: z.boolean().default(true),
  workflows: z.array(workflowSchema).max(25).default([]),
});

const accessibilitySchema = z.object({
  enabled: z.boolean().default(true),
  tags: z.array(z.string().min(1)).default(['wcag2a', 'wcag2aa']),
  paths: z.array(sameOriginPathSchema).max(20).default([]),
  include: z.array(z.string()).max(50).default([]),
  exclude: z.array(z.string()).max(50).default([]),
  maxPages: z.number().int().min(1).max(10).default(3),
});

const performanceSchema = z.object({
  enabled: z.boolean().default(true),
  lighthouse: z.boolean().default(false),
  sampleRuns: z.number().int().min(1).max(3).default(1),
  paths: z.array(sameOriginPathSchema).max(20).default([]),
  maxPages: z.number().int().min(1).max(5).default(2),
  thresholds: z
    .object({
      fcpMs: z.number().int().positive().default(3000),
      lcpMs: z.number().int().positive().default(4000),
      cls: z.number().positive().default(0.25),
      loadMs: z.number().int().positive().default(6000),
      jsBytes: z.number().int().positive().default(1_750_000),
      requests: z.number().int().positive().default(120),
      domNodes: z.number().int().positive().default(3000),
    })
    .prefault({}),
});

const supabaseLiveSchema = z.object({
  url: safeUrlSchema,
  anonKeyEnv: z.string().default('SUPABASE_ANON_KEY'),
  tables: z.array(z.string().min(1)).default([]),
  maxRows: z.number().int().min(1).max(10).default(1),
});

const supabaseSchema = z.object({
  enabled: z.boolean().default(true),
  migrationsDir: z.string().default('supabase/migrations'),
  live: supabaseLiveSchema.optional(),
});

const aiSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z.enum(['openai-compatible']).default('openai-compatible'),
  baseUrl: safeUrlSchema.default('https://api.openai.com/v1'),
  model: z.string().max(120).default('gpt-4o-mini'),
  apiKeyEnv: z.string().default('LAUNCHPROOF_AI_API_KEY'),
  consent: z.boolean().default(false),
  maxFindings: z.number().int().min(1).max(30).default(10),
});

const reportSchema = z.object({
  outputDir: z.string().min(1).default('.launchproof'),
  formats: z
    .array(z.enum(['terminal', 'json', 'html', 'sarif']))
    .default(['terminal', 'json', 'html']),
  includeEvidence: z.boolean().default(true),
  open: z.boolean().default(false),
});

export const configurationSchema = z.object({
  $schema: z.string().optional(),
  version: z.literal(1).default(1),
  project: projectSchema.prefault({}),
  app: appSchema.prefault({}),
  authorization: authorizationSchema.prefault({}),
  scan: scanSchema.prefault({}),
  http: httpSchema.prefault({}),
  api: apiSchema.prefault({}),
  auth: authSchema.prefault({}),
  authorizationTests: authorizationTestsSchema.prefault({}),
  browser: browserSchema.prefault({}),
  accessibility: accessibilitySchema.prefault({}),
  performance: performanceSchema.prefault({}),
  supabase: supabaseSchema.prefault({}),
  ai: aiSchema.prefault({}),
  report: reportSchema.prefault({}),
});

export type LaunchProofConfig = z.infer<typeof configurationSchema>;
export type IdentityConfig = z.infer<typeof identitySchema>;
export type ApiEndpointConfig = z.infer<typeof endpointSchema>;
export type AuthorizationResourceConfig = z.infer<typeof authorizationResourceSchema>;
export type WorkflowConfig = z.infer<typeof workflowSchema>;
export type WorkflowStepConfig = z.infer<typeof workflowStepSchema>;
export type PerformanceThresholds = z.infer<typeof performanceSchema>['thresholds'];

export function createDefaultConfig(): LaunchProofConfig {
  return configurationSchema.parse({});
}

export function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const location = issue.path.length > 0 ? issue.path.join('.') : 'config';
      return `  - ${location}: ${issue.message}`;
    })
    .join('\n');
}
