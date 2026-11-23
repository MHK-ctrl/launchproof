import type { LaunchProofConfig } from './config/schema.js';
import { createCheck } from './checks.js';
import type { CheckResult, Finding } from './types.js';
import { redactText, truncate } from './util.js';

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

/**
 * Optional, consent-gated remediation guidance through any OpenAI-compatible endpoint.
 * Only finding titles, descriptions, and locations are sent. Evidence values are never sent.
 */
export async function runAiRemediation(
  findings: Finding[],
  config: LaunchProofConfig,
): Promise<CheckResult | null> {
  if (!config.ai.enabled) {
    return null;
  }
  const started = Date.now();
  if (!config.ai.consent) {
    return createCheck({
      id: 'ai.remediation',
      title: 'AI remediation guidance',
      category: 'security',
      status: 'skipped',
      summary:
        'AI remediation is enabled but consent is not granted, so no finding data was sent to a provider.',
      details:
        'Set ai.consent to true only after reviewing the provider, model, and data handling policy.',
      durationMs: 0,
    });
  }
  const key = process.env[config.ai.apiKeyEnv];
  if (!key) {
    return createCheck({
      id: 'ai.remediation',
      title: 'AI remediation guidance',
      category: 'security',
      status: 'skipped',
      summary: `The AI provider key environment variable ${config.ai.apiKeyEnv} is not set.`,
      durationMs: 0,
    });
  }
  const selected = findings
    .filter((finding) => ['critical', 'high', 'medium'].includes(finding.severity))
    .slice(0, config.ai.maxFindings);
  if (selected.length === 0) {
    return null;
  }

  const payload = {
    model: config.ai.model,
    temperature: 0.2,
    max_tokens: 1200,
    messages: [
      {
        role: 'system',
        content:
          'You are a senior application security engineer. Give concise, specific remediation steps for each finding. Do not claim the application is secure. Never invent evidence. Return plain text grouped by finding title.',
      },
      {
        role: 'user',
        content: selected
          .map(
            (finding, index) =>
              `${index + 1}. [${finding.severity}] ${finding.title}\nDescription: ${finding.description}\nLocation: ${finding.location?.file ?? finding.location?.url ?? 'project'}\nCurrent remediation: ${finding.remediation}`,
          )
          .join('\n\n'),
      },
    ],
  };

  try {
    const response = await fetch(`${config.ai.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      return createCheck({
        id: 'ai.remediation',
        title: 'AI remediation guidance',
        category: 'security',
        status: 'error',
        summary: `The AI provider returned HTTP ${response.status}.`,
        error: 'Provider request failed; no guidance was generated.',
        details: 'This does not affect the security findings themselves.',
        durationMs: Date.now() - started,
      });
    }
    const body = (await response.json()) as ChatResponse;
    const content = body.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return createCheck({
        id: 'ai.remediation',
        title: 'AI remediation guidance',
        category: 'security',
        status: 'not-verified',
        summary: 'The AI provider returned an empty response.',
        durationMs: Date.now() - started,
      });
    }
    return createCheck({
      id: 'ai.remediation',
      title: 'AI remediation guidance (unverified)',
      category: 'security',
      status: 'not-verified',
      summary: `AI-generated guidance for ${selected.length} finding(s). It is advisory and has not been verified.`,
      details: truncate(redactText(content), 6000),
      evidence: [
        { kind: 'text', label: 'Provider', value: config.ai.provider },
        { kind: 'text', label: 'Model', value: config.ai.model },
        { kind: 'metric', label: 'Findings included', value: String(selected.length) },
      ],
      durationMs: Date.now() - started,
    });
  } catch (error) {
    return createCheck({
      id: 'ai.remediation',
      title: 'AI remediation guidance',
      category: 'security',
      status: 'error',
      summary: 'The AI provider request failed.',
      error: truncate(error instanceof Error ? error.message : 'Unknown provider error', 300),
      durationMs: Date.now() - started,
    });
  }
}
