import { expect, test } from 'playwright/test';
import { WEB_URL } from '../../lib/env';
import { officeOrigin, shots, uniqSlug } from '../../lib/site';

/**
 * 사무소 홈페이지 host routing on the production build (`next start`, no nginx) — the parts that
 * need no live site. The full request → approve → visit → suspend flow is
 * admin/agency-sites.spec.ts.
 */
test.describe('office site hosts', () => {
  test('unknown slug → office 404; reserved www → main site; /office-site on main → 404', async ({
    page,
  }) => {
    const unknown = officeOrigin(uniqSlug('nosuch'));
    const res = await page.goto(`${unknown}/`);
    expect(res?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { level: 1, name: '홈페이지를 찾을 수 없어요' }),
    ).toBeVisible();
    await shots(page, 'office-unknown-404');

    // A reserved label is not an office: www.<root> is served as the main site.
    const www = await page.goto(`${officeOrigin('www')}/`);
    expect(www?.status()).toBe(200);
    await expect(page.getByRole('combobox', { name: '지역 또는 단지명 검색' })).toBeVisible();

    // The internal office routes are not reachable on the main host.
    const internal = await page.goto(`${WEB_URL}/office-site/${uniqSlug()}`);
    expect(internal?.status()).toBe(404);
  });

  test('non-office paths on an office host redirect to the same path on the main site', async ({
    page,
  }) => {
    const origin = officeOrigin(uniqSlug('redir'));
    // Production mode: the middleware's own 307 carries an absolute Location on the main host
    // (the dev-only /to-main handler is not involved).
    const res = await page.request.fetch(`${WEB_URL}/map?zoom=14`, {
      headers: { host: new URL(origin).host },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toBe(`${WEB_URL}/map?zoom=14`);

    await page.goto(`${origin}/agencies`);
    await expect(page).toHaveURL(`${WEB_URL}/agencies`);
    await page.goto(`${origin}/me/inquiries`);
    // Then the main site's own login redirect (sessions are host-only on the main domain).
    await expect(page).toHaveURL(new RegExp(`^${WEB_URL}/login`));
  });
});
