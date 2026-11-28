import { expect, test, type BrowserContext, type Page } from 'playwright/test';
import { Api, apiSessionAs, bodyOf, findListings, loginAs } from '../../lib/api';
import { ADMIN_URL, WEB_URL } from '../../lib/env';
import { SITE_BRAND, officeOrigin, shots, uniqSlug } from '../../lib/site';

/**
 * 사무소 홈페이지 end to end on the real stack (SPEC docs/agency-sites §3.1, §4.1–4.4, §5):
 * the 대표 requests an address in /agent/site → an admin approves it in the queue → the office
 * host `<slug>.localhost` serves the office (own primary listings only, brand colour, office
 * listing page canonical to the main site, other offices' listings 404, other paths → main
 * site) → a guest leaves a 문의 there → it lands in the office 문의함 (홈페이지 badge, unread,
 * no reply for a guest) → the admin suspends the site → the host 404s.
 *
 * Runs in the admin project (it needs the admin session); the office pages use their own
 * contexts on the user site.
 */

/** Seeded owners this flow may use (a1/a2 belong to other specs, a4 to web/inquiries.spec.ts). */
const CANDIDATE_OWNERS = [
  'a6-owner@seed.example.invalid',
  'a5-owner@seed.example.invalid',
  'a7-owner@seed.example.invalid',
  'a8-owner@seed.example.invalid',
  'a3-owner@seed.example.invalid',
];

interface SiteView {
  status: string;
  slug: string | null;
  requestedSlug: string | null;
  color: string;
  tagline: string | null;
  url: string | null;
  live: boolean;
}

interface Owner {
  email: string;
  agencyId: string;
  agencyName: string;
}

/** Polls an office-host page (Next caches GET /sites/:slug for 60 s) until it answers `status`. */
async function expectOfficeStatus(page: Page, url: string, status: number, timeout = 150_000) {
  await expect
    .poll(async () => (await page.goto(url))?.status(), {
      timeout,
      intervals: [1_000, 2_000, 5_000],
      message: `${url} → ${status}`,
    })
    .toBe(status);
}

test.describe.serial('agency site: request → approve → visit → inquiry → suspend', () => {
  let owner: Owner;
  let ownerCtx: BrowserContext;
  let slug: string;
  const tagline = 'e2e 동네 매물, 동네 사정까지 알려 드려요';
  const guestName = `게스트${Math.floor(Math.random() * 9000) + 1000}`;
  const guestMessage = `e2e 홈페이지 문의 ${Date.now()}: 이번 주말에 방문 상담 가능할까요?`;

  test.beforeAll(async ({ playwright }) => {
    // The first seeded owner whose office has no site yet (or a rejected one): re-runs on the
    // same data move on to the next office.
    for (const email of CANDIDATE_OWNERS) {
      const s = await apiSessionAs(playwright, email);
      const mine = await s.api.get<{ site: SiteView | null }>('/agencies/mine/site');
      const agency = await s.api.get<{ id: string; name: string }>('/agencies/mine');
      await s.dispose();
      if (!mine.site || mine.site.status === 'REJECTED') {
        owner = { email, agencyId: agency.id, agencyName: agency.name };
        break;
      }
    }
    expect(owner, 'a seeded office without a site (restart the stack for fresh data)').toBeTruthy();
    slug = uniqSlug('e2e');
  });

  test.beforeEach(async ({ browser }) => {
    ownerCtx = await browser.newContext({ baseURL: WEB_URL });
    await loginAs(ownerCtx, owner.email);
  });
  test.afterEach(async () => {
    await ownerCtx.close();
  });

  test('대표 requests an address in /agent/site with the availability check', async ({
    playwright,
  }) => {
    const page = await ownerCtx.newPage();
    await page.goto('/agent/site');
    await expect(page.getByRole('heading', { level: 1, name: '내 홈페이지' })).toBeVisible();
    await expect(page.getByText('아직 신청한 홈페이지가 없어요')).toHaveCount(0); // owner sees the form
    await expect(page.getByText('현재 무료로 제공 중이에요.')).toBeVisible();

    const input = page.getByLabel('홈페이지 주소');
    // A reserved word is refused by the shared rules before any request.
    await input.fill('admin');
    await expect(page.getByText('쓸 수 없는 주소예요. 다른 주소를 입력해 주세요.')).toBeVisible();
    // A free address: the debounced GET …/availability answers available.
    const checked = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/v1/agencies/mine/site/availability?slug=${slug}`) &&
        r.request().method() === 'GET',
    );
    await input.fill(slug.toUpperCase()); // normalised to lower case
    expect((await checked).status()).toBe(200);
    await expect(page.getByText('쓸 수 있는 주소예요.')).toBeVisible();

    await page.locator('input[type="radio"][value="GREEN"]').check({ force: true });
    await page.getByLabel('한 줄 소개 (선택)').fill(tagline);
    await shots(page, 'site-01-request-form', { fullPage: true });

    const sent = page.waitForResponse(
      (r) => r.url().endsWith('/api/v1/agencies/mine/site') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: '신청하기' }).click();
    const res = await sent;
    // Create or re-request: 200 (the API answers the MyAgencySiteResponse).
    expect(res.ok(), await bodyOf(res)).toBe(true);
    await expect(
      page.getByText('운영자가 신청 내용을 확인하고 있어요.', { exact: false }),
    ).toBeVisible();
    await expect(page.getByText(`${slug}.localhost`).first()).toBeVisible();
    await shots(page, 'site-02-requested', { fullPage: true });

    // The open request reserves the address: another office sees it TAKEN.
    const other = await apiSessionAs(playwright, CANDIDATE_OWNERS.find((e) => e !== owner.email)!);
    const taken = await other.api.get<{ available: boolean; reason: string | null }>(
      `/agencies/mine/site/availability?slug=${slug}`,
    );
    await other.dispose();
    expect(taken).toEqual(expect.objectContaining({ available: false, reason: 'TAKEN' }));
  });

  test('admin approves the request from the 홈페이지 queue', async ({ page, context }) => {
    await page.goto('/agencies/sites');
    const row = page.getByRole('row').filter({ hasText: owner.agencyName });
    await expect(row).toBeVisible();
    await expect(row).toContainText(slug);
    await shots(page, 'site-03-admin-queue');

    await row.getByRole('button', { name: `${owner.agencyName} 홈페이지 승인` }).click();
    const dialog = page.getByRole('dialog', { name: '홈페이지 승인' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('홈페이지 주소')).toHaveValue(slug);
    await shots(page, 'site-04-admin-approve-dialog');
    const decided = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/v1/admin/agencies/${owner.agencyId}/site/decision`) &&
        r.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: '승인', exact: true }).click();
    const res = await decided;
    expect(res.status(), await bodyOf(res)).toBe(200);

    const admin = Api.of(context, ADMIN_URL);
    const after = await admin.get<{ site: SiteView }>(`/admin/agencies/${owner.agencyId}/site`);
    expect(after.site).toEqual(
      expect.objectContaining({ status: 'ACTIVE', slug, color: 'GREEN', tagline, live: true }),
    );
    expect(after.site.url).toBe(`${officeOrigin(slug)}`);
  });

  test('대표 sees the live address and the approval notification', async () => {
    const page = await ownerCtx.newPage();
    await page.goto('/agent/site');
    await expect(page.getByRole('link', { name: `${slug}.localhost:3200` }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '주소 복사' })).toBeVisible();
    await expect(page.getByText(/주소 준비 중/)).toHaveCount(0); // http stack: ready
    await shots(page, 'site-05-console-active', { fullPage: true });

    const api = Api.of(ownerCtx);
    const feed = await api.get<{ items: { type: string }[] }>(
      '/me/notifications?scope=agency&pageSize=20',
    );
    expect(feed.items.map((n) => n.type)).toContain('AGENCY_SITE_APPROVED');
  });

  test('office host: home with own primary listings + brand colour, listing page, 404s, redirects', async ({
    browser,
    playwright,
  }) => {
    test.setTimeout(240_000);
    const origin = officeOrigin(slug);
    const visitor = await browser.newContext();
    const page = await visitor.newPage();
    await expectOfficeStatus(page, `${origin}/`, 200);

    await expect(page).toHaveTitle(`${owner.agencyName} | 순천 부동산`);
    await expect(page.getByRole('heading', { level: 1, name: owner.agencyName })).toBeVisible();
    await expect(page.getByText(tagline).first()).toBeVisible();
    const brand = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--brand').trim(),
    );
    expect(brand.toUpperCase()).toBe(SITE_BRAND.GREEN);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^http:\/\/e2e/);

    // Only listings whose primary agency is this office.
    const anon = await playwright.request.newContext({ baseURL: WEB_URL });
    const pub = new Api(anon);
    const primary = await findListings(pub, { primaryAgencyId: owner.agencyId });
    const primaryTotal = (
      await pub.get<{ total: number }>(`/listings?primaryAgencyId=${owner.agencyId}&pageSize=1`)
    ).total;
    const linked = await findListings(pub, { agencyId: owner.agencyId });
    const primaryIds = new Set(primary.map((l) => l.id));
    expect(primary.length).toBeGreaterThan(0);
    expect(primary.every((l) => l.primaryAgency.id === owner.agencyId)).toBe(true);
    await expect(page.locator('#office-listings')).toContainText(`${primaryTotal}`);
    const cards = page.locator('#listings a[href^="/listing/"]');
    await expect(cards.first()).toBeVisible();
    const hrefs = await cards.evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
    const shown = [...new Set(hrefs.map((h) => h.split('/')[2]!.split(/[?#]/)[0]!))];
    expect(shown.length).toBeGreaterThan(0);
    for (const id of shown)
      expect(primaryIds.has(id), `card ${id} is a primary listing`).toBe(true);
    await shots(page, 'site-06-office-home', { fullPage: true });

    // Office listing page: own listing works, canonical → the main-site listing (O8).
    const own = shown[0]!;
    await cards.first().click();
    await expect(page).toHaveURL(`${origin}/listing/${own}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${WEB_URL}/listing/${own}`,
    );
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /관심 매물에 추가/ })).toHaveCount(0);
    await shots(page, 'site-07-office-listing', { fullPage: true });

    // Another office's listing (and a co-listed one this office is not primary on) → 404.
    const others = await findListings(pub, { assetTypes: 'APT' });
    const foreign = others.find((l) => l.primaryAgency.id !== owner.agencyId)!;
    expect(foreign).toBeTruthy();
    const res = await page.goto(`${origin}/listing/${foreign.id}`);
    expect(res?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { level: 1, name: '매물을 찾을 수 없어요' }),
    ).toBeVisible();
    await shots(page, 'site-08-office-foreign-listing-404');
    const coListed = linked.find((l) => !primaryIds.has(l.id));
    if (coListed) {
      expect((await page.goto(`${origin}/listing/${coListed.id}`))?.status()).toBe(404);
    }

    // Any other path → the same path on the main site.
    await page.goto(`${origin}/agencies?sort=name`);
    await expect(page).toHaveURL(`${WEB_URL}/agencies?sort=name`);
    // robots.txt / sitemap.xml are the office's own.
    const robots = await page.goto(`${origin}/robots.txt`);
    expect(robots?.status()).toBe(200);
    expect(await robots!.text()).toContain(`${origin}/sitemap.xml`);

    // The main-site office page links the live site (홈페이지 button, AgencyProfile.site).
    const profile = await pub.get<{ site: { url: string } | null }>(`/agencies/${owner.agencyId}`);
    expect(profile.site).toEqual({ url: origin });
    await anon.dispose();
    await visitor.close();
  });

  test('guest leaves a 문의 on the office host → office 문의함 (홈페이지, unread, no reply)', async ({
    browser,
  }) => {
    const origin = officeOrigin(slug);
    const ownerApi = Api.of(ownerCtx);
    const before = await ownerApi.get<{ unreadCount: number }>('/agency/inquiries?pageSize=1');

    const visitor = await browser.newContext();
    const page = await visitor.newPage();
    await expectOfficeStatus(page, `${origin}/`, 200);
    await page.getByRole('button', { name: '문의하기' }).first().click();
    const dialog = page.getByRole('dialog', { name: '중개사무소에 문의하기' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('이름').fill(guestName);
    await dialog.getByLabel('연락처').fill('010-2345-6789');
    await dialog.getByLabel('문의 내용').fill(guestMessage);
    await dialog.getByRole('checkbox', { name: /문의 개인정보 수집·이용 및 제공 동의/ }).check();
    await shots(page, 'site-09-guest-inquiry-form');
    const sent = page.waitForResponse(
      (r) => r.url().endsWith('/api/v1/inquiries') && r.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: '문의 보내기' }).click();
    const res = await sent;
    expect(res.status(), await bodyOf(res)).toBe(201);
    // Same-origin call from the office host: the API accepted Origin http://<slug>.localhost:3200.
    expect(res.request().headers().origin ?? origin).toBe(origin);
    const created = (await res.json()) as { id: string; member: boolean };
    expect(created.member).toBe(false);
    await expect(dialog.getByText('문의를 보냈어요')).toBeVisible();
    await expect(dialog.getByText('중개사무소가 남겨 주신 번호로 연락드릴 거예요.')).toBeVisible();
    await shots(page, 'site-10-guest-inquiry-sent');
    await visitor.close();

    // The office console: 문의함 row with the 홈페이지 badge, unread count up by one.
    const after = await ownerApi.get<{
      unreadCount: number;
      items: { id: string; source: string }[];
    }>('/agency/inquiries?pageSize=5');
    expect(after.unreadCount).toBe(before.unreadCount + 1);
    expect(after.items[0]).toEqual(expect.objectContaining({ id: created.id, source: 'SITE' }));

    const inbox = await ownerCtx.newPage();
    await inbox.goto('/agent/inquiries');
    await expect(inbox.getByRole('heading', { level: 1, name: '문의함' })).toBeVisible();
    const nav = inbox.getByRole('link', { name: /^문의함/ }).first();
    await expect(nav).toContainText(String(after.unreadCount));
    const row = inbox.getByRole('button').filter({ hasText: guestName });
    await expect(row).toBeVisible();
    await expect(row).toContainText('홈페이지');
    await expect(row).toContainText('비회원');
    await expect(row.getByText('읽지 않음')).toHaveCount(1);
    await shots(inbox, 'site-11-console-inbox');

    await row.click();
    const drawer = inbox.getByRole('dialog');
    await expect(drawer.getByText(guestMessage)).toBeVisible();
    await expect(
      drawer.getByText('비회원 문의예요. 남긴 번호로 전화해 주세요.', { exact: false }),
    ).toBeVisible();
    await expect(drawer.getByLabel('답변')).toHaveCount(0);
    await shots(inbox, 'site-12-console-guest-drawer');

    // The API refuses a reply to a guest as well.
    const refused = await ownerCtx.request.post(
      `${WEB_URL}/api/v1/agency/inquiries/${created.id}/replies`,
      {
        headers: {
          origin: WEB_URL,
          'content-type': 'application/json',
          'x-csrf-token': (await ownerCtx.cookies(WEB_URL)).find((c) => c.name === 'house_csrf')!
            .value,
        },
        data: JSON.stringify({ message: '답변 시도' }),
      },
    );
    expect(refused.status()).toBe(409);
    expect(((await refused.json()) as { code: string }).code).toBe('INQUIRY_REPLY_NOT_ALLOWED');
  });

  test('admin suspends the site → the office host 404s', async ({ page, browser }) => {
    test.setTimeout(240_000);
    await page.goto(`/agencies/${owner.agencyId}`);
    const panel = page.locator('#site');
    await expect(panel.getByText('운영 중').first()).toBeVisible();
    await panel.getByRole('button', { name: '홈페이지 정지' }).click();
    const dialog = page.getByRole('dialog', { name: '홈페이지 정지' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('정지 사유').fill('e2e: 홈페이지 내용 점검을 위해 잠시 정지합니다.');
    await shots(page, 'site-13-admin-suspend-dialog');
    const decided = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/v1/admin/agencies/${owner.agencyId}/site/decision`) &&
        r.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: '정지', exact: true }).click();
    const res = await decided;
    expect(res.status(), await bodyOf(res)).toBe(200);
    await expect(panel.getByText('정지').first()).toBeVisible();
    await shots(page, 'site-14-admin-suspended', { fullPage: true });

    const visitor = await browser.newContext();
    const office = await visitor.newPage();
    await expectOfficeStatus(office, `${officeOrigin(slug)}/`, 404);
    await expect(
      office.getByRole('heading', { level: 1, name: '홈페이지를 찾을 수 없어요' }),
    ).toBeVisible();
    await shots(office, 'site-15-office-suspended-404');
    await visitor.close();

    // The console shows the suspension; the main-site profile no longer links the site.
    const consolePage = await ownerCtx.newPage();
    await consolePage.goto('/agent/site');
    await expect(consolePage.getByText('홈페이지 운영이 정지되었어요')).toBeVisible();
    await shots(consolePage, 'site-16-console-suspended', { fullPage: true });
    const profile = await Api.of(ownerCtx).get<{ site: unknown }>(`/agencies/${owner.agencyId}`);
    expect(profile.site).toBeNull();
  });
});
