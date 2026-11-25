/**
 * PDF export for the first paid report.
 *
 * The HTML report is the single source of truth: this module renders the same self-contained HTML
 * in headless Chromium and prints it to A4. No second report layout exists, so a PDF can never
 * disagree with the HTML or JSON it came from.
 *
 * Playwright is an optional peer dependency, exactly as it is for browser checks. If it is missing,
 * callers get a reason string and exit with a usage error instead of a stack trace.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface PdfResult {
  ok: boolean;
  reason?: string;
}

const FOOTER = `<div style="width:100%;font-size:8px;color:#666;padding:0 14mm;display:flex;justify-content:space-between;font-family:Helvetica,Arial,sans-serif">
  <span>LaunchProof · evidence-backed verification · not a penetration test</span>
  <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
</div>`;

/**
 * Prints `html` to `outPath` as A4 PDF. Creates the parent directory.
 * Never throws for a missing optional dependency; returns `{ ok: false, reason }` instead.
 */
export async function renderPdfFile(html: string, outPath: string): Promise<PdfResult> {
  let chromium: typeof import('playwright').chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    return {
      ok: false,
      reason:
        'PDF export needs the optional Playwright dependency. Run "npm install --save-dev playwright" and "npx playwright install chromium", then retry. The HTML report works without it.',
    };
  }

  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await page.pdf({
      path: outPath,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: FOOTER,
      margin: { top: '18mm', bottom: '16mm', left: '14mm', right: '14mm' },
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Executable doesn't exist|browserType\.launch/i.test(message)) {
      return {
        ok: false,
        reason:
          'Chromium is not installed for Playwright. Run "npx playwright install chromium" and retry. The HTML report works without it.',
      };
    }
    return { ok: false, reason: `PDF export failed: ${message.split('\n')[0]}` };
  } finally {
    await browser?.close().catch(() => {});
  }
}
