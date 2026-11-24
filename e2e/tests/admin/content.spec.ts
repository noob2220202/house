import path from 'node:path';
import { expect, test } from 'playwright/test';
import { FIXTURES_DIR, uniq, WEB_URL } from '../../lib/env';

/** 광고: MAIN_HERO banner and a popup created in the admin, then visible on the user site. */
test.describe('admin ads → user site', () => {
  test('MAIN_HERO banner with uploaded images shows on the home carousel', async ({
    page,
    browser,
  }) => {
    const title = uniq('E2E 메인배너 ');
    await page.goto('/banners');
    await page.getByRole('button', { name: '새 배너 등록' }).first().click();
    const form = page.locator('form').filter({ has: page.getByLabel('노출 위치') });
    await form.getByLabel('노출 위치').selectOption('MAIN_HERO');
    await form.getByLabel('제목').fill(title);
    await form.getByLabel('PC 이미지').setInputFiles(path.join(FIXTURES_DIR, 'banner-hero-pc.png'));
    await form
      .getByLabel('모바일 이미지')
      .setInputFiles(path.join(FIXTURES_DIR, 'banner-hero-mobile.png'));
    await expect(page.getByAltText('PC 이미지 미리보기')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByAltText('모바일 이미지 미리보기')).toBeVisible({ timeout: 30_000 });
    const link = form.getByLabel('링크 URL');
    if (await link.isVisible()) await link.fill(`${WEB_URL}/map`);

    const saved = page.waitForResponse(
      (r) => r.url().endsWith('/api/v1/admin/banners') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: '저장', exact: true }).click();
    const res = await saved;
    expect(res.status(), await res.text()).toBe(201);

    // The home page caches banners (ISR, revalidate 60 s): reload until the new one is served.
    const visitor = await browser.newPage();
    await expect
      .poll(
        async () => {
          await visitor.goto(`${WEB_URL}/`);
          return visitor.getByRole('img', { name: new RegExp(title) }).count();
        },
        { timeout: 120_000, intervals: [2_000, 5_000, 10_000] },
      )
      .toBeGreaterThan(0);
    await visitor.close();
  });

  test('popup shows on the home page', async ({ page, browser }) => {
    const title = uniq('E2E 공지팝업 ');
    await page.goto('/banners/popups');
    await page.getByRole('button', { name: '새 팝업 등록' }).first().click();
    const form = page.locator('form').filter({ has: page.getByLabel('팝업 이미지') });
    await form.getByLabel('제목').fill(title);
    await form.getByLabel('팝업 이미지').setInputFiles(path.join(FIXTURES_DIR, 'popup.png'));
    await expect(page.getByAltText('팝업 이미지 미리보기')).toBeVisible({ timeout: 30_000 });
    const saved = page.waitForResponse(
      (r) => r.url().endsWith('/api/v1/admin/popups') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: '저장', exact: true }).click();
    const res = await saved;
    expect(res.status(), await res.text()).toBe(201);

    const visitor = await browser.newPage();
    await expect
      .poll(
        async () => {
          await visitor.goto(`${WEB_URL}/`);
          // Popups may be shown one after another (the seeded 환영 popup first): close the
          // others until ours is on screen or none is left.
          for (let i = 0; i < 6; i++) {
            const ours = visitor.getByRole('dialog', { name: `공지: ${title}` });
            if (await ours.isVisible()) return 1;
            const other = visitor.getByRole('dialog', { name: /^공지:/ }).first();
            if (!(await other.isVisible())) return 0;
            await other.getByRole('button', { name: '닫기', exact: true }).click();
            await expect(other).toBeHidden();
          }
          return 0;
        },
        { timeout: 120_000, intervals: [2_000, 5_000, 10_000] },
      )
      .toBeGreaterThan(0);
    await visitor.close();
  });
});
