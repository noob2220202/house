import path from 'node:path';
import { expect, test } from 'playwright/test';
import { bodyOf } from '../../lib/api';
import { FIXTURES_DIR, uniq, WEB_URL } from '../../lib/env';

/** 광고: MAIN_HERO banner and a popup created in the admin, then visible on the user site. */
test.describe('admin ads → user site', () => {
  // The home page is ISR (revalidate 60 s, and the banner read is cached 60 s too): allow the
  // 150 s poll below plus the admin steps.
  test.describe.configure({ timeout: 210_000 });
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
    // The admin accepts https:// links or a site path ("/map"), not plain http.
    if (await link.isVisible()) await link.fill('/map');

    const saved = page.waitForResponse(
      (r) => r.url().endsWith('/api/v1/admin/banners') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: '저장', exact: true }).click();
    const res = await saved;
    expect(res.status(), await bodyOf(res)).toBe(201);
    const { id } = (await res.json()) as { id: string };

    // The home page caches banners (ISR, revalidate 60 s): reload until the new one is served.
    // A slide is the AdFrame "광고: <title>" — a link to the click redirect when the banner has
    // a link (set above), a role="img" frame otherwise.
    const visitor = await browser.newPage();
    const name = `광고: ${title}`;
    const slide = visitor
      .getByRole('link', { name, exact: true })
      .or(visitor.getByRole('img', { name, exact: true }));
    await expect
      .poll(
        async () => {
          await visitor.goto(`${WEB_URL}/`);
          return slide.count();
        },
        { timeout: 150_000, intervals: [2_000, 5_000, 10_000] },
      )
      .toBeGreaterThan(0);
    if (await link.isVisible()) {
      // Clicks are counted by the API redirect, never a direct link to the target.
      await expect(slide.first()).toHaveAttribute('href', new RegExp(`/banners/${id}/click$`));
    }
    // The uploaded creative (processed webp), not a placeholder.
    await expect(slide.first().locator('img')).toHaveAttribute('src', /\.webp|_next\/image/);
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
    expect(res.status(), await bodyOf(res)).toBe(201);

    const visitor = await browser.newPage();
    await expect
      .poll(
        async () => {
          // The popup layer renders after hydration from GET /popups?page=MAIN (client fetch):
          // wait for that answer instead of checking the DOM right after the navigation.
          const served = visitor.waitForResponse(
            (r) => /\/api\/v1\/popups\?/.test(r.url()) && r.request().method() === 'GET',
          );
          await visitor.goto(`${WEB_URL}/`);
          const popups = (await (await served).json()) as { items: { title: string }[] };
          const queue = popups.items.map((p) => p.title);
          if (!queue.includes(title)) return 0;
          // Popups are shown one at a time in back-office order (the seeded 환영 popup first;
          // 닫기 hides one for this tab session): close the ones in front of ours.
          const card = visitor.getByRole('dialog', { name: /^공지: / });
          for (let i = 0; i < queue.length; i++) {
            await expect(card).toBeVisible();
            const shown = ((await card.getByRole('heading').textContent()) ?? '').trim();
            if (shown === `공지: ${title}`) return 1;
            await card.getByRole('button', { name: '닫기', exact: true }).click();
            await expect(visitor.getByRole('dialog', { name: shown, exact: true })).toBeHidden();
          }
          return 0;
        },
        { timeout: 120_000, intervals: [2_000, 5_000, 10_000] },
      )
      .toBeGreaterThan(0);
    await visitor.close();
  });
});
