import fs from 'node:fs';
import path from 'node:path';
import type { Page } from 'playwright/test';
import { ROOT, WEB_URL } from './env';

/**
 * Origin of an office's own site (사무소 홈페이지) on the e2e stack: `<slug>.<web host>:<port>`.
 * The web server answers every Host; browsers resolve `*.localhost` to loopback themselves
 * (Node's resolver may not, so use the browser — `page.goto` / in-page fetch — for these hosts).
 */
export function officeOrigin(slug: string): string {
  const u = new URL(WEB_URL);
  return `${u.protocol}//${slug}.${u.host}`;
}

/** A fresh, valid office slug (lowercase letters + digits, 3–30 chars, not reserved). */
export function uniqSlug(prefix = 'e2e'): string {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`
    .toLowerCase()
    .slice(0, 30);
}

/** Brand colours of `AGENCY_SITE_COLORS` (@house/shared agencies/site.ts) the tests pick. */
export const SITE_BRAND = { GREEN: '#3F6212' } as const;

export const SHOTS_DIR = path.join(ROOT, '.tmp', 'fe-shots');

const nextFrame = (page: Page) =>
  page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );

/**
 * Screenshots of the current state at 1440 and 390 px wide (`.tmp/fe-shots/live-<name>-<w>.png`),
 * then the original viewport is restored.
 */
export async function shots(page: Page, name: string, opts: { fullPage?: boolean } = {}) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  const original = page.viewportSize() ?? { width: 1440, height: 900 };
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await nextFrame(page);
    await page.screenshot({
      path: path.join(SHOTS_DIR, `live-${name}-${width}.png`),
      fullPage: opts.fullPage ?? false,
      animations: 'disabled',
    });
  }
  await page.setViewportSize(original);
  await nextFrame(page);
}
