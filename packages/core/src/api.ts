import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

import type { ApiEndpointConfig, LaunchProofConfig } from './config/schema.js';
import { createCheck, createFinding } from './checks.js';
import type { ApiRouteInfo, CheckResult, Evidence, Finding, ResultStatus } from './types.js';
import { truncate, unique } from './util.js';
import type { HttpClient, HttpResponseRecord } from './http/client.js';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);

export interface ResolvedIdentity {
  name: string;
  headers: Record<string, string>;
  cookie?: string;
  missing: string[];
}

/** Resolves identity headers from environment variables. Values are never logged or reported. */
export function resolveIdentity(name: string, config: LaunchProofConfig): ResolvedIdentity | null {
  const identity = config.auth.identities[name];
  if (!identity) {
    return null;
  }
  const headers: Record<string, string> = {};
  const missing: string[] = [];
  for (const [header, envName] of Object.entries(identity.headersEnv)) {
    const value = process.env[envName];
    if (!value) {
      missing.push(envName);
      continue;
    }
    headers[header] = value;
  }
  let cookie: string | undefined;
  if (identity.cookieEnv) {
    const value = process.env[identity.cookieEnv];
    if (!value) {
      missing.push(identity.cookieEnv);
    } else {
      cookie = value;
    }
  }
  if (missing.length > 0) {
    return { name, headers, missing, ...(cookie ? { cookie } : {}) };
  }
  return { name, headers, missing: [], ...(cookie ? { cookie } : {}) };
}

function endpointFromOperation(
  route: ApiRouteInfo,
  spec: Record<string, unknown>,
): ApiEndpointConfig | null {
  const operation = spec;
  const responses = operation.responses;
  let expectStatus = 200;
  if (responses && typeof responses === 'object') {
    const keys = Object.keys(responses as Record<string, unknown>)
      .map((key) => Number(key))
      .filter((code) => Number.isInteger(code) && code >= 200 && code < 300);
    if (keys.length > 0) {
      expectStatus = keys[0] ?? 200;
    }
  }
  return {
    name: typeof operation.summary === 'string' ? truncate(operation.summary, 80) : undefined,
    path: route.path,
    method: route.method as ApiEndpointConfig['method'],
    expectStatus,
    expectJson: /json/i.test(String(operation.produces ?? 'json')),
    requiredJsonKeys: [],
    requiresAuth: Boolean(operation.security),
  };
}

async function loadOpenApiEndpoints(
  config: LaunchProofConfig,
  rootDir: string,
  client: HttpClient,
): Promise<{ endpoints: ApiEndpointConfig[]; skippedTemplated: number; source: string } | null> {
  if (!config.api.openapi) {
    return null;
  }
  const source = config.api.openapi;
  let raw: string;
  if (/^https?:\/\//i.test(source)) {
    const response = await client.request(source);
    if (response.status !== 200) {
      throw new Error(`OpenAPI document returned HTTP ${response.status}`);
    }
    raw = response.bodyText;
  } else {
    const absolute = path.resolve(rootDir, source);
    const relative = path.relative(rootDir, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('OpenAPI files must be inside the project directory.');
    }
    raw = await fs.readFile(absolute, 'utf8');
  }
  let document: unknown;
  try {
    document = /^\s*[{[]/.test(raw) ? JSON.parse(raw) : parseYaml(raw);
  } catch {
    throw new Error('OpenAPI document could not be parsed as JSON or YAML.');
  }
  if (!document || typeof document !== 'object') {
    throw new Error('OpenAPI document is not an object.');
  }
  const paths = (document as Record<string, unknown>).paths;
  if (!paths || typeof paths !== 'object') {
    throw new Error('OpenAPI document has no paths object.');
  }
  const endpoints: ApiEndpointConfig[] = [];
  let skippedTemplated = 0;
  for (const [routePath, item] of Object.entries(paths as Record<string, unknown>)) {
    if (!item || typeof item !== 'object') continue;
    for (const [method, operation] of Object.entries(item as Record<string, unknown>)) {
      if (!HTTP_METHODS.has(method.toLowerCase()) || !operation || typeof operation !== 'object') {
        continue;
      }
      if (/[{}]/.test(routePath)) {
        skippedTemplated += 1;
        continue;
      }
      const endpoint = endpointFromOperation(
        {
          file: source,
          method: method.toUpperCase(),
          path: routePath,
          framework: 'OpenAPI',
        },
        operation as Record<string, unknown>,
      );
      if (endpoint && endpoint.method !== 'OPTIONS' && endpoint.method !== 'HEAD') {
        endpoints.push(endpoint);
      }
      if (endpoints.length >= config.api.maxEndpoints) break;
    }
    if (endpoints.length >= config.api.maxEndpoints) break;
  }
  return { endpoints, skippedTemplated, source };
}

function joinBase(base: string, routePath: string): string {
  return `${base.replace(/\/+$/, '')}${routePath.startsWith('/') ? '' : '/'}${routePath}`;
}

function evidenceFor(response: HttpResponseRecord): Evidence[] {
  return [
    { kind: 'http', label: 'Status', value: `${response.status} ${response.statusText}`.trim() },
    { kind: 'http', label: 'Final URL', value: response.finalUrl },
    { kind: 'metric', label: 'Duration', value: `${response.durationMs} ms` },
    { kind: 'http', label: 'Content-Type', value: response.contentType || 'missing' },
    { kind: 'metric', label: 'Body bytes', value: String(response.bodyBytes) },
  ];
}

export interface ApiCheckOptions {
  config: LaunchProofConfig;
  rootDir: string;
  baseUrl: string;
  client: HttpClient;
}

export async function runApiChecks(options: ApiCheckOptions): Promise<CheckResult[]> {
  const { config, client } = options;
  const started = Date.now();
  const identitiesMissing: string[] = [];
  let openapi: Awaited<ReturnType<typeof loadOpenApiEndpoints>> = null;
  try {
    openapi = await loadOpenApiEndpoints(config, options.rootDir, client);
  } catch (error) {
    return [
      createCheck({
        id: 'api.contracts',
        title: 'API contract verification',
        category: 'api',
        status: 'error',
        summary: 'The configured OpenAPI document could not be loaded.',
        error: error instanceof Error ? error.message : 'Unknown OpenAPI error',
        durationMs: Date.now() - started,
      }),
    ];
  }

  const endpoints = [...config.api.endpoints, ...(openapi?.endpoints ?? [])].slice(
    0,
    config.api.maxEndpoints,
  );
  if (endpoints.length === 0) {
    return [
      createCheck({
        id: 'api.contracts',
        title: 'API contract verification',
        category: 'api',
        status: 'skipped',
        summary:
          'No API endpoints or OpenAPI document are configured, so API behavior was not verified.',
        details:
          'Add api.endpoints or api.openapi to launchproof.config.json. A report without API checks is not evidence that the API works.',
        durationMs: Date.now() - started,
      }),
    ];
  }

  const findings: Finding[] = [];
  const evidence: Evidence[] = [];
  let executed = 0;
  let unsafeSkipped = 0;

  for (const endpoint of endpoints) {
    const method = endpoint.method;
    if (!config.api.allowUnsafeMethods && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      unsafeSkipped += 1;
      continue;
    }
    const identity = endpoint.identity ? resolveIdentity(endpoint.identity, config) : null;
    if (endpoint.identity && (!identity || identity.missing.length > 0)) {
      identitiesMissing.push(
        `${endpoint.identity} (${identity?.missing.join(', ') || 'unknown identity'})`,
      );
      continue;
    }
    const url = joinBase(options.baseUrl, endpoint.path);
    const headers: Record<string, string> = { ...(identity?.headers ?? {}) };
    if (identity?.cookie) headers.cookie = identity.cookie;
    let response: HttpResponseRecord;
    try {
      response = await client.request(url, {
        method,
        headers,
        ...(endpoint.body !== undefined ? { body: JSON.stringify(endpoint.body) } : {}),
      });
    } catch (error) {
      findings.push(
        createFinding({
          checkId: 'api.contracts',
          title: `${method} ${endpoint.path} could not be requested`,
          description: error instanceof Error ? error.message : 'Request failed',
          severity: 'medium',
          confidence: 'high',
          verification: 'observed',
          category: 'api',
          impact: 'Endpoint availability and behavior are unverified.',
          remediation: 'Confirm the base URL, network access, and that the endpoint exists.',
          location: { url },
          key: `api:error:${method}:${endpoint.path}`,
        }),
      );
      continue;
    }
    executed += 1;
    const expected = Array.isArray(endpoint.expectStatus)
      ? endpoint.expectStatus
      : [endpoint.expectStatus];
    if (!expected.includes(response.status)) {
      findings.push(
        createFinding({
          checkId: 'api.contracts',
          title: `${method} ${endpoint.path} returned HTTP ${response.status}`,
          description: `Expected status ${expected.join(' or ')} but received ${response.status}.`,
          severity: response.status >= 500 ? 'high' : 'medium',
          confidence: 'high',
          verification: 'observed',
          category: 'api',
          impact:
            response.status >= 500
              ? 'The endpoint fails at runtime, which users will experience as a broken feature.'
              : 'The API contract differs from the documented expectation.',
          remediation:
            'Reproduce the request, inspect server logs, and align the response with the documented contract.',
          evidence: evidenceFor(response),
          location: { url },
          key: `api:status:${method}:${endpoint.path}`,
        }),
      );
      continue;
    }
    if (endpoint.maxResponseMs && response.durationMs > endpoint.maxResponseMs) {
      findings.push(
        createFinding({
          checkId: 'api.contracts',
          title: `${method} ${endpoint.path} exceeded its latency budget`,
          description: `Responded in ${response.durationMs} ms against a ${endpoint.maxResponseMs} ms budget.`,
          severity: 'low',
          confidence: 'high',
          verification: 'observed',
          category: 'api',
          impact: 'Slow endpoints degrade perceived reliability.',
          remediation: 'Profile the endpoint query path and cache or precompute expensive work.',
          evidence: evidenceFor(response),
          location: { url },
          key: `api:latency:${method}:${endpoint.path}`,
        }),
      );
    }
    if (endpoint.expectJson) {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(response.bodyText);
      } catch {
        findings.push(
          createFinding({
            checkId: 'api.contracts',
            title: `${method} ${endpoint.path} did not return JSON`,
            description: `Expected a JSON body, but Content-Type was "${response.contentType || 'missing'}".`,
            severity: 'medium',
            confidence: 'high',
            verification: 'observed',
            category: 'api',
            impact: 'Clients that parse JSON will fail.',
            remediation: 'Return application/json with a valid serialized body.',
            evidence: evidenceFor(response),
            location: { url },
            key: `api:json:${method}:${endpoint.path}`,
          }),
        );
      }
      if (parsed && endpoint.requiredJsonKeys.length > 0) {
        const record =
          parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
        const missingKeys = endpoint.requiredJsonKeys.filter((key) => !(key in record));
        if (missingKeys.length > 0) {
          findings.push(
            createFinding({
              checkId: 'api.contracts',
              title: `${method} ${endpoint.path} is missing expected JSON keys`,
              description: `Missing: ${missingKeys.join(', ')}.`,
              severity: 'medium',
              confidence: 'high',
              verification: 'observed',
              category: 'api',
              impact: 'Clients depending on these fields will break.',
              remediation:
                'Return the documented fields or update the contract and clients together.',
              evidence: evidenceFor(response),
              location: { url },
              key: `api:keys:${method}:${endpoint.path}`,
            }),
          );
        }
      }
    }
    if (endpoint.requiresAuth) {
      let anonymous: HttpResponseRecord;
      try {
        anonymous = await client.request(url, { method });
      } catch {
        continue;
      }
      if (![401, 403].includes(anonymous.status)) {
        findings.push(
          createFinding({
            checkId: 'api.contracts',
            title: `${method} ${endpoint.path} accepts unauthenticated requests`,
            description: `The endpoint is marked as requiring authentication, but an anonymous request returned HTTP ${anonymous.status}.`,
            severity: anonymous.status >= 200 && anonymous.status < 300 ? 'high' : 'medium',
            confidence: 'high',
            verification: 'observed',
            category: 'api',
            impact: 'Private data or actions may be available without a session.',
            remediation:
              'Enforce authentication server-side before reading or mutating protected data.',
            evidence: evidenceFor(anonymous),
            location: { url },
            key: `api:auth:${method}:${endpoint.path}`,
          }),
        );
      }
    }
    evidence.push({
      kind: 'http',
      label: `${method} ${endpoint.path}`,
      value: `${response.status} · ${response.durationMs} ms`,
    });
  }

  const highSeverity = findings.some((f) => f.severity === 'high' || f.severity === 'critical');
  let status: ResultStatus = findings.length > 0 ? (highSeverity ? 'fail' : 'warn') : 'pass';
  if (executed === 0) {
    status = 'skipped';
  }
  return [
    createCheck({
      id: 'api.contracts',
      title: 'API contract verification',
      category: 'api',
      status,
      summary:
        executed === 0
          ? 'No API endpoint was executed. Unsafe methods are disabled and required identities may be missing.'
          : `${executed} endpoint request(s) executed; ${findings.length} contract issue(s) found.`,
      findings,
      evidence: evidence.slice(0, 25),
      details: [
        unsafeSkipped > 0
          ? `${unsafeSkipped} endpoint(s) skipped because unsafe HTTP methods are disabled (api.allowUnsafeMethods).`
          : '',
        identitiesMissing.length > 0
          ? `Identities not executed because environment variables are missing: ${unique(identitiesMissing).join(', ')}.`
          : '',
        openapi?.skippedTemplated
          ? `${openapi.skippedTemplated} templated OpenAPI path(s) were skipped because no concrete values are configured.`
          : '',
      ]
        .filter(Boolean)
        .join(' '),
      durationMs: Date.now() - started,
    }),
  ];
}

export function describeApiCoverage(config: LaunchProofConfig): string {
  const count = config.api.endpoints.length;
  if (count === 0) return 'no explicit endpoints';
  return `${count} configured endpoint(s)`;
}
