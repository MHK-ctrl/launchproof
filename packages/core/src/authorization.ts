import type { LaunchProofConfig } from './config/schema.js';
import { createCheck, createFinding } from './checks.js';
import type { CheckResult, Finding } from './types.js';
import type { HttpClient } from './http/client.js';
import { resolveIdentity } from './api.js';

export interface AuthorizationCheckOptions {
  config: LaunchProofConfig;
  baseUrl: string;
  client: HttpClient;
}

/**
 * Object-level authorization probes using two configured identities. This checks whether a
 * second user can read a resource owned by the first user; it does not brute force, fuzz, or
 * modify data unless the operator explicitly opts in.
 */
export async function runAuthorizationChecks(
  options: AuthorizationCheckOptions,
): Promise<CheckResult[]> {
  const started = Date.now();
  const { config, client } = options;
  const resources = config.authorizationTests.resources;
  if (resources.length === 0) {
    return [
      createCheck({
        id: 'authorization.objects',
        title: 'Object-level authorization',
        category: 'authorization',
        status: 'skipped',
        summary:
          'No authorization resources are configured, so cross-user access control was not tested.',
        details:
          'Configure authorizationTests.resources with ownerIdentity and otherIdentity to test for broken object-level authorization (BOLA/IDOR).',
        durationMs: Date.now() - started,
      }),
    ];
  }

  const findings: Finding[] = [];
  const skipped: string[] = [];
  let tested = 0;
  let inconclusive = 0;

  for (const resource of resources) {
    if (!resource.path && !resource.url) {
      skipped.push(`${resource.name}: no path or URL`);
      continue;
    }
    const method = resource.method;
    const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    if (unsafe && !(resource.allowUnsafeMethod && config.authorizationTests.allowUnsafeMethods)) {
      skipped.push(`${resource.name}: unsafe method ${method} disabled`);
      continue;
    }
    const url = resource.url ?? `${options.baseUrl.replace(/\/+$/, '')}${resource.path ?? '/'}`;
    const owner = resolveIdentity(resource.ownerIdentity, config);
    const other = resolveIdentity(resource.otherIdentity, config);
    if (!owner || !other || owner.missing.length > 0 || other.missing.length > 0) {
      const missing = [...(owner?.missing ?? []), ...(other?.missing ?? [])];
      skipped.push(`${resource.name}: missing env ${missing.join(', ') || 'identity'}`);
      continue;
    }

    const headersFor = (identity: typeof owner): Record<string, string> => ({
      ...identity.headers,
      ...(identity.cookie ? { cookie: identity.cookie } : {}),
    });
    let ownerResponse;
    try {
      ownerResponse = await client.request(url, {
        method,
        headers: headersFor(owner),
        ...(resource.body !== undefined ? { body: JSON.stringify(resource.body) } : {}),
      });
    } catch (error) {
      skipped.push(
        `${resource.name}: owner request failed (${error instanceof Error ? error.message : 'unknown'})`,
      );
      continue;
    }
    if (ownerResponse.status < 200 || ownerResponse.status >= 300) {
      skipped.push(
        `${resource.name}: owner received HTTP ${ownerResponse.status}; the scenario is inconclusive`,
      );
      continue;
    }

    let otherResponse;
    try {
      otherResponse = await client.request(url, {
        method,
        headers: headersFor(other),
        ...(resource.body !== undefined ? { body: JSON.stringify(resource.body) } : {}),
      });
    } catch (error) {
      inconclusive += 1;
      skipped.push(
        `${resource.name}: second-identity request failed (${error instanceof Error ? error.message : 'unknown'})`,
      );
      continue;
    }
    const expected = Array.isArray(resource.expectStatusForOther)
      ? resource.expectStatusForOther
      : [resource.expectStatusForOther];
    if (expected.includes(otherResponse.status)) {
      tested += 1;
      continue;
    }
    if (otherResponse.status < 200 || otherResponse.status >= 300) {
      // A 3xx/4xx/5xx outside the configured expectation is not proof of access.
      // Keep it visibly inconclusive instead of manufacturing a BOLA finding.
      inconclusive += 1;
      skipped.push(
        `${resource.name}: second identity received HTTP ${otherResponse.status}; the result is inconclusive`,
      );
      continue;
    }
    tested += 1;
    if (!expected.includes(otherResponse.status)) {
      findings.push(
        createFinding({
          checkId: 'authorization.objects',
          title: `Possible broken object-level authorization: ${resource.name}`,
          description: `${resource.otherIdentity} accessed a resource owned by ${resource.ownerIdentity} and received HTTP ${otherResponse.status}; expected ${expected.join(' or ')}.`,
          severity: otherResponse.status >= 200 && otherResponse.status < 300 ? 'critical' : 'high',
          confidence: otherResponse.status >= 200 && otherResponse.status < 300 ? 'high' : 'medium',
          verification: 'observed',
          category: 'authorization',
          impact:
            "Users may read or modify other users' data by changing an identifier or URL. This is one of the most common and damaging application vulnerabilities.",
          remediation:
            'Enforce object ownership on the server for every request. Never rely on client-side checks or unguessable identifiers.',
          evidence: [
            { kind: 'http', label: 'Method', value: method },
            { kind: 'http', label: 'URL', value: url },
            { kind: 'http', label: 'Owner status', value: String(ownerResponse.status) },
            { kind: 'http', label: 'Second identity status', value: String(otherResponse.status) },
            { kind: 'text', label: 'Expectation', value: expected.join(' or ') },
          ],
          location: { url },
          references: [
            'https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/',
          ],
          key: `bola:${resource.name}:${method}`,
        }),
      );
    }
  }

  const highSeverity = findings.some(
    (finding) => finding.severity === 'critical' || finding.severity === 'high',
  );
  return [
    createCheck({
      id: 'authorization.objects',
      title: 'Object-level authorization',
      category: 'authorization',
      status:
        findings.length > 0
          ? highSeverity
            ? 'fail'
            : 'warn'
          : inconclusive > 0
            ? 'warn'
            : tested > 0
              ? 'pass'
              : 'skipped',
      summary:
        tested === 0 && inconclusive === 0
          ? 'No authorization scenario could be executed. See details for missing identities or unsafe-method restrictions.'
          : `${tested} cross-identity scenario(s) tested; ${findings.length} authorization failure(s) observed; ${inconclusive} inconclusive.`,
      findings,
      evidence: [
        { kind: 'metric', label: 'Scenarios tested', value: String(tested) },
        { kind: 'metric', label: 'Scenarios inconclusive', value: String(inconclusive) },
        {
          kind: 'metric',
          label: 'Scenarios skipped',
          value: String(resources.length - tested - inconclusive),
        },
      ],
      details: skipped.length > 0 ? skipped.join('; ') : undefined,
      durationMs: Date.now() - started,
    }),
  ];
}
