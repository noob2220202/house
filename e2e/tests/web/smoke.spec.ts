import { expect, test } from 'playwright/test';

/**
 * @smoke Anonymous home page in REAL API mode: SSR data comes from apps/api (no mock routes),
 * the hero search is interactive. Kept minimal on purpose — the first thing to run after
 * `scripts/e2e-stack.sh up`.
 */
test('@smoke anonymous home renders from the real API', async ({ page }) => {
  const mockCalls: string[] = [];
  page.on('request', (req) => {
    if (new URL(req.url()).pathname.startsWith('/mock-api/')) mockCalls.push(req.url());
  });

  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle(/순천부동산/);
  await expect(page.getByRole('combobox', { name: '지역 또는 단지명 검색' })).toBeVisible();
  // Real mode: the browser never talks to the mock route handlers.
  const health = await page.request.get('/api/v1/health');
  expect(health.status()).toBe(200);
  expect(mockCalls).toEqual([]);
});
