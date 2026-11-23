import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { ReportFormat, ScanArtifacts, ScanReport } from '../types.js';
import { renderHtml } from './html.js';
import { renderSarif } from './sarif.js';

export interface WriteReportOptions {
  outputDir: string;
  formats: ReportFormat[];
  /** Also atomically update latest.json/latest.html for tools and the website sample pipeline. */
  writeLatest?: boolean;
}

export interface WrittenReport {
  artifacts: ScanArtifacts;
  files: string[];
}

/**
 * Writes report artifacts into a scan-specific directory plus convenience "latest" copies.
 * Nothing is uploaded. HTML and JSON are written with restrictive, deterministic content.
 */
export async function writeReportArtifacts(
  report: ScanReport,
  options: WriteReportOptions,
): Promise<WrittenReport> {
  const outputDir = path.resolve(options.outputDir);
  const scanDir = path.join(outputDir, report.meta.id);
  await fs.mkdir(scanDir, { recursive: true });

  const files: string[] = [];
  const jsonPath = path.join(scanDir, 'report.json');
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  files.push(jsonPath);

  let htmlPath: string | null = null;
  if (options.formats.includes('html')) {
    htmlPath = path.join(scanDir, 'report.html');
    await fs.writeFile(htmlPath, renderHtml(report), 'utf8');
    files.push(htmlPath);
  }

  let sarifPath: string | null = null;
  if (options.formats.includes('sarif')) {
    sarifPath = path.join(scanDir, 'report.sarif');
    await fs.writeFile(sarifPath, renderSarif(report), 'utf8');
    files.push(sarifPath);
  }

  if (options.writeLatest) {
    const latestJson = path.join(outputDir, 'latest.json');
    const latestHtml = path.join(outputDir, 'latest.html');
    await fs.writeFile(latestJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await fs.writeFile(latestHtml, renderHtml(report), 'utf8');
    files.push(latestJson, latestHtml);
  }

  return { artifacts: { jsonPath, htmlPath, sarifPath }, files };
}

export function reportFilePath(outputDir: string): string {
  return path.resolve(outputDir, 'latest.json');
}
