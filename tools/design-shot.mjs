#!/usr/bin/env node
// Render a local HTML/.dc.html design artboard (or any URL) to a PNG with Playwright.
// Usage: node tools/design-shot.mjs <file-or-url> <width> <out.png> [height]
// Prints JSON: { contentHeight, scrollHeight, scrollW, horizontalOverflow, pageErrors }
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [target, w, out, h] = process.argv.slice(2);
if (!target || !w || !out) {
  console.error('Usage: node tools/design-shot.mjs <file-or-url> <width> <out.png> [height]');
  process.exit(2);
}
const url = /^https?:\/\//.test(target) ? target : pathToFileURL(path.resolve(target)).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h || 900) }, deviceScaleFactor: 1 });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => console.log('NAV', e.message));
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
const dims = await page.evaluate(() => {
  const root = document.querySelector('x-dc') || document.body;
  return {
    contentHeight: Math.ceil(root.getBoundingClientRect().height),
    scrollHeight: document.documentElement.scrollHeight,
    scrollW: document.documentElement.scrollWidth,
  };
});
await page.screenshot({ path: out, fullPage: true });
console.log(JSON.stringify({ ...dims, viewportW: Number(w), horizontalOverflow: dims.scrollW > Number(w), pageErrors }));
await browser.close();
