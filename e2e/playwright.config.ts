/**
 * Real-API browser e2e (stage 3). The stack is NOT started here: run `scripts/e2e-stack.sh up`
 * first (it builds, migrates, seeds and starts api + worker + web + admin), then
 *   pnpm exec playwright test -c e2e/playwright.config.ts
 * See docs/E2E.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium, defineConfig, devices } from 'playwright/test';
import { ADMIN_STORAGE_STATE, ADMIN_URL, STATE_DIR, WEB_URL } from './lib/env';

/**
 * The root `playwright` package (1.65.1) expects its own Chromium build, which is not installed
 * here; fall back to the preinstalled one in /opt/pw-browsers (or E2E_CHROMIUM).
 */
function chromiumExecutable(): string | undefined {
  if (process.env.E2E_CHROMIUM) return process.env.E2E_CHROMIUM;
  try {
    if (fs.existsSync(chromium.executablePath())) return undefined;
  } catch {
    // no bundled browser registered
  }
  for (const candidate of ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium_headless_shell']) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

const executablePath = chromiumExecutable();
const browser = {
  ...devices['Desktop Chrome'],
  locale: 'ko-KR',
  timezoneId: 'Asia/Seoul',
  viewport: { width: 1440, height: 900 },
  launchOptions: executablePath ? { executablePath } : {},
};

export default defineConfig({
  testDir: path.join(__dirname, 'tests'),
  outputDir: path.join(STATE_DIR, 'test-results'),
  globalSetup: path.join(__dirname, 'global-setup.ts'),
  fullyParallel: false,
  workers: Number(process.env.E2E_WORKERS ?? 2),
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(STATE_DIR, 'report'), open: 'never' }],
  ],
  use: {
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    // Anonymous / member / broker flows on the user site (apps/web).
    {
      name: 'web',
      testMatch: /web\/.*\.spec\.ts$/,
      use: { ...browser, baseURL: WEB_URL },
    },
    // Logs the e2e admin in through the real TOTP form once and stores the session.
    {
      name: 'admin-setup',
      testMatch: /admin\/admin\.setup\.ts$/,
      use: { ...browser, baseURL: ADMIN_URL },
    },
    // Back-office flows (apps/admin); some assert the result on the user site.
    {
      name: 'admin',
      testMatch: /admin\/.*\.spec\.ts$/,
      dependencies: ['admin-setup'],
      fullyParallel: false,
      use: {
        ...browser,
        baseURL: ADMIN_URL,
        storageState: ADMIN_STORAGE_STATE,
      },
    },
  ],
});
