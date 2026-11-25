import { escapeHtml } from '../util.js';
import { VERSION } from '../version.js';
import type { CheckResult, Finding, ScanReport, Severity } from '../types.js';

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
};

const STATUS_LABELS: Record<string, string> = {
  pass: 'Pass',
  fail: 'Fail',
  warn: 'Warning',
  skipped: 'Skipped',
  'not-verified': 'Not verified',
  error: 'Error',
};

const SAFE_STATUSES = new Set(Object.keys(STATUS_LABELS));

function safeSeverity(value: string): Severity {
  return Object.hasOwn(SEVERITY_LABELS, value) ? (value as Severity) : 'info';
}

function safeStatus(value: string): string {
  return SAFE_STATUSES.has(value) ? value : 'error';
}

function safeNumber(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '0';
}

function safeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function safeReferenceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function severityClass(severity: Severity): string {
  return `sev-${severity}`;
}

function renderEvidence(finding: Finding): string {
  if (finding.evidence.length === 0) {
    return '';
  }
  return `<div class="evidence"><div class="evidence-title">Evidence</div>${finding.evidence
    .map(
      (item) =>
        `<div class="evidence-row"><span class="evidence-kind">${escapeHtml(item.kind)}</span><span class="evidence-label">${escapeHtml(item.label)}</span><pre>${escapeHtml(item.value)}</pre>${item.redacted ? '<span class="redacted">redacted</span>' : ''}</div>`,
    )
    .join('')}</div>`;
}

function renderFinding(finding: Finding): string {
  const severity = safeSeverity(finding.severity);
  const location = finding.location
    ? finding.location.file
      ? `${finding.location.file}${finding.location.line ? `:${finding.location.line}` : ''}`
      : finding.location.url
    : '';
  const references =
    finding.references && finding.references.length > 0
      ? `<div class="refs">${finding.references
          .map((reference) => {
            const href = safeReferenceUrl(reference);
            return href
              ? `<a href="${escapeHtml(href)}" rel="noreferrer noopener" target="_blank">${escapeHtml(reference)}</a>`
              : `<span class="ref">${escapeHtml(reference)}</span>`;
          })
          .join('')}</div>`
      : '';
  return `<article class="finding ${severityClass(severity)}" data-severity="${severity}" data-search="${escapeHtml(`${finding.title} ${finding.id} ${finding.description} ${location}`.toLowerCase())}">
    <header class="finding-head">
      <span class="sev">${SEVERITY_LABELS[severity]}</span>
      <span class="finding-id">${escapeHtml(finding.id)}</span>
      <span class="finding-conf" title="Confidence">${escapeHtml(finding.confidence)} confidence · ${escapeHtml(finding.verification)}</span>
    </header>
    <h3>${escapeHtml(finding.title)}</h3>
    ${location ? `<div class="loc">${escapeHtml(location)}</div>` : ''}
    <p>${escapeHtml(finding.description)}</p>
    <div class="finding-grid">
      <section><h4>Impact</h4><p>${escapeHtml(finding.impact)}</p></section>
      <section><h4>Remediation</h4><p>${escapeHtml(finding.remediation)}</p></section>
    </div>
    ${renderEvidence(finding)}
    ${references}
  </article>`;
}

function renderCheck(check: CheckResult): string {
  const status = safeStatus(check.status);
  return `<tr>
    <td><span class="status ${status}">${STATUS_LABELS[status]}</span></td>
    <td><span class="check-id">${escapeHtml(check.id)}</span><div class="check-summary">${escapeHtml(check.summary)}</div>${check.details ? `<div class="check-details">${escapeHtml(check.details)}</div>` : ''}</td>
    <td class="num">${check.findings.length}</td>
    <td class="num">${safeNumber(check.durationMs)} ms</td>
  </tr>`;
}

function severityBar(report: ScanReport): string {
  const total = Math.max(safeCount(report.summary.totalFindings), 1);
  return (['critical', 'high', 'medium', 'low', 'info'] as Severity[])
    .map((severity) => ({ severity, count: safeCount(report.summary.bySeverity[severity]) }))
    .filter(({ count }) => count > 0)
    .map(
      ({ severity, count }) =>
        `<span class="bar-seg ${severity}" style="width:${(count / total) * 100}%" title="${count} ${severity}"></span>`,
    )
    .join('');
}

/**
 * Scope and authorization statement. Every commercial report must state what was assessed, when,
 * with which tool version, and on what authority, before it states any finding.
 */
function renderScope(report: ScanReport, dateLabel: string): string {
  const { meta, summary } = report;
  const target = meta.target ? escapeHtml(meta.target) : null;
  const authorization = target
    ? `The operator states that written authorization exists to test <code>${target}</code>. LaunchProof does not verify that authorization and cannot confirm it.`
    : 'No live target was tested in this run. Scope is limited to the local project files named above.';
  return `<section class="panel" id="scope">
  <h2>Assessment scope and authorization</h2>
  <div class="config-grid">
    <div><span>Project</span>${escapeHtml(meta.projectName)}</div>
    <div><span>Assessment date</span>${escapeHtml(dateLabel)}</div>
    <div><span>Tool version</span>LaunchProof v${escapeHtml(VERSION)} (report schema ${safeNumber(meta.schemaVersion)})</div>
    <div><span>Mode</span>${escapeHtml(meta.mode)}</div>
    <div><span>Target</span>${target ? `<code>${target}</code>` : 'Local files only'}</div>
    <div><span>Checks</span>${safeNumber(summary.totalChecks)} selected · ${safeNumber(summary.byStatus.pass)} passed · ${safeNumber(safeCount(summary.byStatus.skipped) + safeCount(summary.byStatus['not-verified']))} skipped or unverified</div>
  </div>
  <div class="callout" style="margin-top:16px">
    <strong>Authorization.</strong> ${authorization}
  </div>
  <div class="callout" style="margin-top:10px">
    <strong>What this document is.</strong> An evidence-backed record of the automated checks listed
    below, run on the date shown. It is not a penetration test, security certification, compliance
    attestation, or guarantee that the application is secure. Findings are observations and
    pattern matches; confirm and reproduce each one before acting on it. Read the Limitations
    section before making a release or purchasing decision based on this report.
  </div>
</section>`;
}

function renderProject(report: ScanReport): string {
  const project = report.project;
  if (!project) return '';
  return `<section class="panel" id="project">
    <h2>Project profile</h2>
    <div class="profile-grid">
      <div><span>Name</span><strong>${escapeHtml(project.name)}</strong></div>
      <div><span>Package manager</span><strong>${escapeHtml(project.packageManager)}</strong></div>
      <div><span>Frameworks</span><strong>${escapeHtml(project.frameworks.join(', ') || 'Not detected')}</strong></div>
      <div><span>Languages</span><strong>${escapeHtml(project.languages.map((language) => `${language.name} (${language.files})`).join(', ') || 'Unknown')}</strong></div>
      <div><span>API routes discovered</span><strong>${safeNumber(project.apiRoutes.length)}</strong></div>
      <div><span>Deployment targets</span><strong>${escapeHtml(project.deployment.join(', ') || 'Not detected')}</strong></div>
      <div><span>Test frameworks</span><strong>${escapeHtml(project.testFrameworks.join(', ') || 'Not detected')}</strong></div>
      <div><span>Files scanned</span><strong>${safeNumber(project.filesScanned)}${project.truncated ? ' (truncated)' : ''}</strong></div>
    </div>
    ${project.apiRoutes.length > 0 ? `<details><summary>Discovered API routes (${project.apiRoutes.length})</summary><ul class="route-list">${project.apiRoutes.map((route) => `<li><code>${escapeHtml(route.method)}</code> ${escapeHtml(route.path)} <span>${escapeHtml(route.framework)}</span></li>`).join('')}</ul></details>` : ''}
  </section>`;
}

function renderConfig(report: ScanReport): string {
  const config = report.configuration;
  return `<section class="panel" id="configuration">
    <h2>Scan configuration</h2>
    <div class="config-grid">
      <div><span>Mode</span><strong>${escapeHtml(config.mode)}</strong></div>
      <div><span>Network checks</span><strong>${config.networkEnabled ? 'Enabled' : 'Disabled'}</strong></div>
      <div><span>Target</span><strong>${escapeHtml(config.target ?? 'Local filesystem only')}</strong></div>
      <div><span>Fail threshold</span><strong>${escapeHtml(config.failOn)}</strong></div>
      <div><span>API endpoints</span><strong>${safeNumber(config.api.endpointCount)}</strong></div>
      <div><span>Identities</span><strong>${safeNumber(config.authIdentities.length)}</strong></div>
      <div><span>Browser workflows</span><strong>${safeNumber(config.browser.workflows)}</strong></div>
      <div><span>Accessibility</span><strong>${config.accessibility.enabled ? escapeHtml(config.accessibility.tags.join(', ')) : 'Disabled'}</strong></div>
      <div><span>Performance</span><strong>${config.performance.enabled ? 'Enabled' : 'Disabled'}</strong></div>
      <div><span>Supabase static</span><strong>${config.supabase.staticAnalysis ? 'Enabled' : 'Disabled'}</strong></div>
      <div><span>Supabase live</span><strong>${config.supabase.liveConfigured ? 'Configured' : 'Not configured'}</strong></div>
      <div><span>Git history</span><strong>${config.fileScan.gitHistory ? 'Checked' : 'Not checked'}</strong></div>
    </div>
  </section>`;
}

/**
 * Produces a fully self-contained HTML report: no remote fonts, scripts, or styles. All report
 * data is rendered as escaped static markup; a tiny inline script adds search and filtering.
 */
export function renderHtml(report: ScanReport): string {
  const { meta, summary } = report;
  const checkRows = report.checks.map(renderCheck).join('');
  const findingCards = report.findings.map(renderFinding).join('');
  const gateClass = summary.gatePassed ? 'pass' : 'fail';
  const date = new Date(meta.startedAt);
  const dateLabel = Number.isNaN(date.getTime())
    ? 'Invalid timestamp'
    : `${date.toISOString().replace('T', ' ').slice(0, 19)} UTC`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="dark" />
<title>LaunchProof report · ${escapeHtml(meta.projectName)} · ${escapeHtml(meta.id)}</title>
<style>
:root{--bg:#070a0f;--panel:#0e141d;--panel2:#121a25;--border:#223043;--text:#e7eef8;--muted:#93a4bb;--accent:#3ddc97;--accent-dim:#134e3a;--red:#ff6b6b;--orange:#ff9f43;--yellow:#ffd166;--blue:#6cb6ff;--gray:#8395ab;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--sans);font-size:15px;line-height:1.6;background-image:radial-gradient(ellipse 80% 50% at 50% -20%,rgba(61,220,151,.09),transparent),linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px);background-size:auto,48px 48px,48px 48px}
a{color:var(--accent)}
.wrap{max-width:1080px;margin:0 auto;padding:32px 24px 72px}
header.top{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;flex-wrap:wrap;padding-bottom:28px;border-bottom:1px solid var(--border)}
.brand{display:flex;gap:12px;align-items:center;font-weight:700;letter-spacing:-.02em;font-size:19px}
.mark{width:36px;height:36px;border:1px solid var(--accent);border-radius:10px;display:grid;place-items:center;color:var(--accent);background:var(--accent-dim);font-family:var(--mono);font-weight:700}
.sub{color:var(--muted);font-size:13px;margin-top:2px}
.meta{font-family:var(--mono);font-size:11.5px;color:var(--muted);text-align:right;line-height:1.9}
.meta b{color:var(--text);font-weight:500}
.hero{display:grid;grid-template-columns:1.4fr 1fr;gap:18px;margin:28px 0}
.card{background:linear-gradient(180deg,var(--panel2),var(--panel));border:1px solid var(--border);border-radius:16px;padding:24px}
.gate-card{position:relative;overflow:hidden}
.gate-card:after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 90% 10%,rgba(61,220,151,.12),transparent 45%);pointer-events:none}
.gate-card.fail:after{background:radial-gradient(circle at 90% 10%,rgba(255,107,107,.14),transparent 45%)}
.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.gate{font-size:38px;font-weight:800;letter-spacing:-.03em;margin:6px 0 2px;color:var(--accent);display:flex;align-items:center;gap:12px}
.gate.fail{color:var(--red)}
.gate .dot{width:12px;height:12px;border-radius:50%;background:currentColor;box-shadow:0 0 18px currentColor}
.gate-note{color:var(--muted);font-size:13.5px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:22px}
.stat{background:rgba(0,0,0,.22);border:1px solid var(--border);border-radius:10px;padding:10px 12px}
.stat b{display:block;font-size:21px;font-family:var(--mono);letter-spacing:-.03em}
.stat span{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em}
.sev-strip{display:flex;height:8px;border-radius:99px;overflow:hidden;background:#1a2533;margin:18px 0 12px}
.bar-seg{display:block;height:100%}
.bar-seg.critical{background:var(--red)}.bar-seg.high{background:var(--orange)}.bar-seg.medium{background:var(--yellow)}.bar-seg.low{background:var(--blue)}.bar-seg.info{background:var(--gray)}
.sev-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--muted)}
.sev-legend b{font-family:var(--mono);color:var(--text)}
h2{font-size:19px;letter-spacing:-.01em;margin:0 0 16px}
.panel{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:24px;margin:18px 0}
.profile-grid,.config-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px 24px}
.profile-grid div,.config-grid div{display:flex;flex-direction:column;gap:2px;font-size:13.5px}
.profile-grid span,.config-grid span{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.07em;font-family:var(--mono)}
details{margin-top:16px;border-top:1px solid var(--border);padding-top:14px}
summary{cursor:pointer;color:var(--muted);font-size:13px}
.route-list{list-style:none;padding:0;margin:12px 0 0;font-family:var(--mono);font-size:12px}
.route-list li{padding:5px 0;border-bottom:1px dashed #1c2836}
.route-list li span{color:var(--muted);float:right}
.route-list code{color:var(--accent);min-width:52px;display:inline-block}
.toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:16px}
input[type=search]{flex:1;min-width:200px;background:#0a1017;border:1px solid var(--border);color:var(--text);border-radius:9px;padding:10px 13px;font:inherit;font-size:13.5px;outline:none}
input[type=search]:focus{border-color:var(--accent)}
.filters{display:flex;gap:6px;flex-wrap:wrap}
.filter{background:#0a1017;border:1px solid var(--border);color:var(--muted);border-radius:99px;padding:6px 11px;font:inherit;font-family:var(--mono);font-size:11px;cursor:pointer}
.filter[aria-pressed=true]{border-color:var(--accent);color:var(--accent);background:rgba(61,220,151,.08)}
.finding{border:1px solid var(--border);border-left:3px solid var(--gray);border-radius:12px;background:var(--panel);padding:18px 20px;margin:12px 0}
.finding.sev-critical{border-left-color:var(--red)}.finding.sev-high{border-left-color:var(--orange)}.finding.sev-medium{border-left-color:var(--yellow)}.finding.sev-low{border-left-color:var(--blue)}
.finding-head{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-family:var(--mono);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.sev{padding:2px 8px;border-radius:99px;font-weight:700;border:1px solid currentColor}
.sev-critical .sev{color:var(--red)}.sev-high .sev{color:var(--orange)}.sev-medium .sev{color:var(--yellow)}.sev-low .sev{color:var(--blue)}.sev-info .sev{color:var(--gray)}
.finding-id{color:var(--gray)}
.finding-conf{margin-left:auto;text-transform:none;letter-spacing:0}
.finding h3{font-size:16.5px;margin:10px 0 4px;letter-spacing:-.01em}
.loc{font-family:var(--mono);font-size:11.5px;color:var(--accent);word-break:break-all;margin-bottom:8px}
.finding p{color:#c4d2e4;font-size:13.5px;margin:6px 0}
.finding-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:12px}
.finding-grid h4{margin:0 0 4px;font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-family:var(--mono)}
.finding-grid p{white-space:pre-wrap;color:#b7c6d9}
.evidence{margin-top:14px;border-top:1px solid var(--border);padding-top:12px}
.evidence-title{font-family:var(--mono);font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:8px}
.evidence-row{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;margin:5px 0}
.evidence-kind{font-family:var(--mono);font-size:9.5px;color:var(--accent);border:1px solid var(--accent-dim);border-radius:4px;padding:1px 5px;text-transform:uppercase}
.evidence-label{font-size:12px;color:var(--muted)}
.evidence pre{margin:4px 0 0;width:100%;background:#080d13;border:1px solid #1a2634;border-radius:8px;padding:10px 12px;font-family:var(--mono);font-size:11.5px;overflow-x:auto;white-space:pre-wrap;word-break:break-word;color:#c7d6e8}
.redacted{font-family:var(--mono);font-size:9.5px;color:var(--yellow);border:1px solid #4d3d17;border-radius:4px;padding:1px 5px}
.refs{display:flex;gap:12px;flex-wrap:wrap;margin-top:10px;font-size:12px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;color:var(--muted);font-family:var(--mono);font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;padding:0 10px 10px;border-bottom:1px solid var(--border);font-weight:500}
td{padding:12px 10px;border-bottom:1px solid #182331;vertical-align:top}
td.num{font-family:var(--mono);text-align:right;white-space:nowrap;color:var(--muted)}
.check-id{font-family:var(--mono);font-size:12px;color:var(--text)}
.check-summary{color:var(--muted);font-size:12.5px;margin-top:2px}
.check-details{color:var(--gray);font-size:11.5px;margin-top:4px}
.status{font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.05em;padding:3px 8px;border-radius:99px;border:1px solid currentColor;white-space:nowrap}
.status.pass{color:var(--accent)}.status.fail{color:var(--red)}.status.warn{color:var(--yellow)}.status.skipped{color:var(--gray)}.status.not-verified{color:var(--blue)}.status.error{color:var(--red)}
.callout{background:rgba(108,182,255,.06);border:1px solid #23384f;border-radius:12px;padding:16px 18px;color:#b9cbe0;font-size:13px}
.callout strong{color:var(--text)}
.limitations{list-style:none;padding:0;margin:0;display:grid;gap:8px}
.limitations li{padding-left:18px;position:relative;color:#b4c4d8;font-size:13px}
.limitations li:before{content:"—";position:absolute;left:0;color:var(--gray);font-family:var(--mono)}
footer{margin-top:36px;color:var(--gray);font-size:11.5px;border-top:1px solid var(--border);padding-top:18px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;font-family:var(--mono)}
.empty{color:var(--muted);font-style:italic;padding:14px 0}
@media(max-width:760px){.hero{grid-template-columns:1fr}.finding-grid{grid-template-columns:1fr}.wrap{padding:20px 14px 48px}.meta{text-align:left}.gate{font-size:30px}}
@media print{body{background:#fff;color:#111;background-image:none}.wrap{max-width:none;padding:0}.panel,.finding,.card{background:#fff;border-color:#ccc;break-inside:avoid}.finding p,.finding-grid p{color:#222}.meta,.sub,.eyebrow,.stat span,.check-summary{color:#555}input,.filters{display:none}.evidence pre{background:#f4f4f4;color:#111;border-color:#ddd}a{color:#0055aa}}
</style>
</head>
<body>
<div class="wrap">
<header class="top">
  <div>
    <div class="brand"><span class="mark">LP</span><div>LaunchProof<div class="sub">Evidence-backed verification report</div></div></div>
  </div>
  <div class="meta">
    <div>Scan <b>${escapeHtml(meta.id)}</b></div>
    <div>Tool <b>v${escapeHtml(VERSION)}</b> · schema <b>${safeNumber(meta.schemaVersion)}</b></div>
    <div><b>${dateLabel}</b></div>
    <div>${safeNumber(meta.durationMs)} ms · ${escapeHtml(meta.runtime.platform)}/${escapeHtml(meta.runtime.arch)} · Node ${escapeHtml(meta.runtime.node)}</div>
  </div>
</header>

<div class="hero">
  <div class="card gate-card ${gateClass}">
    <div class="eyebrow">Release gate</div>
    <div class="gate ${gateClass}"><span class="dot"></span>${summary.gatePassed ? 'PASS' : 'FAIL'}</div>
    <div class="gate-note">${summary.gatePassed ? `No findings at or above the configured "${escapeHtml(summary.failOn)}" threshold.` : escapeHtml(summary.gateReasons.join(' · ') || 'The configured threshold was exceeded.')}</div>
    <div class="stats">
      <div class="stat"><b>${safeNumber(summary.totalChecks)}</b><span>checks</span></div>
      <div class="stat"><b>${safeNumber(summary.byStatus.pass)}</b><span>passed</span></div>
      <div class="stat"><b>${safeNumber(safeCount(summary.byStatus.fail) + safeCount(summary.byStatus.error))}</b><span>failed / errors</span></div>
    </div>
  </div>
  <div class="card">
    <div class="eyebrow">Findings</div>
    <div class="gate ${gateClass}">${safeNumber(summary.totalFindings)}</div>
    <div class="sev-strip">${severityBar(report)}</div>
    <div class="sev-legend">
      ${(['critical', 'high', 'medium', 'low', 'info'] as Severity[]).map((severity) => `<span><b>${safeNumber(summary.bySeverity[severity])}</b> ${SEVERITY_LABELS[severity]}</span>`).join('')}
    </div>
    <div class="stats" style="margin-top:18px">
      <div class="stat"><b>${safeNumber(summary.byStatus.warn)}</b><span>warnings</span></div>
      <div class="stat"><b>${safeNumber(safeCount(summary.byStatus.skipped) + safeCount(summary.byStatus['not-verified']))}</b><span>skipped / unverified</span></div>
      <div class="stat"><b>${escapeHtml(meta.mode)}</b><span>scan mode</span></div>
    </div>
  </div>
</div>

<section class="panel callout">
  <strong>Read this before acting.</strong> LaunchProof distinguishes what was observed, pattern-matched, or inferred. A passing check is not proof that the application is secure, and a clean report is not a substitute for code review or manual testing.
  ${meta.target ? `Target tested: <code>${escapeHtml(meta.target)}</code>.` : 'This scan analyzed local files only; no live target was tested.'}
</section>

${renderScope(report, dateLabel)}

${renderProject(report)}

<section class="panel" id="findings">
  <h2>Findings <span style="color:var(--muted);font-weight:400;font-size:13px">(${report.findings.length})</span></h2>
  <div class="toolbar">
    <input type="search" id="search" placeholder="Search findings, files, or IDs…" aria-label="Search findings" />
    <div class="filters" role="group" aria-label="Filter by severity">
      <button class="filter" data-filter="all" aria-pressed="true">All</button>
      ${(['critical', 'high', 'medium', 'low', 'info'] as Severity[]).map((severity) => `<button class="filter" data-filter="${severity}" aria-pressed="false">${SEVERITY_LABELS[severity]}</button>`).join('')}
    </div>
  </div>
  <div id="finding-list">${findingCards || '<div class="empty">No findings were recorded for this scan.</div>'}</div>
  <div class="empty" id="no-results" hidden>No findings match the current filter.</div>
</section>

<section class="panel">
  <h2>Checks</h2>
  <table>
    <thead><tr><th>Status</th><th>Check</th><th style="text-align:right">Findings</th><th style="text-align:right">Time</th></tr></thead>
    <tbody>${checkRows}</tbody>
  </table>
</section>

${renderConfig(report)}

<section class="panel">
  <h2>Limitations</h2>
  <ul class="limitations">${report.limitations.map((limitation) => `<li>${escapeHtml(limitation)}</li>`).join('') || '<li>No limitations were recorded. Treat this as a tooling gap, not as certainty.</li>'}</ul>
</section>

<footer>
  <span>LaunchProof v${escapeHtml(VERSION)} · ${escapeHtml(meta.id)}</span>
  <span>Generated locally. No project data was uploaded.</span>
</footer>
</div>
<script>
(function(){
  var search = document.getElementById('search');
  var list = document.getElementById('finding-list');
  var noResults = document.getElementById('no-results');
  var filters = Array.prototype.slice.call(document.querySelectorAll('.filter'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('.finding'));
  var active = 'all';
  function apply(){
    var query = (search && search.value ? search.value : '').toLowerCase().trim();
    var visible = 0;
    cards.forEach(function(card){
      var matchesSeverity = active === 'all' || card.getAttribute('data-severity') === active;
      var haystack = card.getAttribute('data-search') || '';
      var matchesQuery = query.length === 0 || haystack.indexOf(query) !== -1;
      var show = matchesSeverity && matchesQuery;
      card.hidden = !show;
      if(show) visible++;
    });
    if(noResults) noResults.hidden = visible !== 0 || cards.length === 0;
  }
  filters.forEach(function(button){
    button.addEventListener('click', function(){
      active = button.getAttribute('data-filter') || 'all';
      filters.forEach(function(other){ other.setAttribute('aria-pressed', String(other === button)); });
      apply();
    });
  });
  if(search) search.addEventListener('input', apply);
})();
</script>
</body>
</html>`;
}
