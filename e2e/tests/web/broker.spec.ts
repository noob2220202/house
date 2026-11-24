import { expect, test } from 'playwright/test';
import { Api, apiSessionAs, loginAs } from '../../lib/api';
import { SEED } from '../../lib/env';
import { ListingWizard } from '../../lib/listing-wizard';

interface ComplexLite {
  id: string;
  name: string;
  assetType: string;
  activeListingCount: number;
  approvalDate: string | null;
}

/** 중개사 대표 (AGENCY_OWNER of seeded agency a1) on the broker console. */
test.describe('broker console', () => {
  test('owner opens the /agent dashboard', async ({ page, context }) => {
    const { login } = await loginAs(context, SEED.ownerA1);
    expect(login.role).toBe('AGENCY_OWNER');
    expect(login.agencyId).toBeTruthy();

    const res = await page.goto('/agent');
    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(/\/agent\/?$/);
    await expect(page.getByText('신대호수공인중개사사무소').first()).toBeVisible();
    // D5: no inquiry backend for launch — the console hides 문의 entirely.
    await expect(page.getByRole('link', { name: /문의 관리|받은 문의/ })).toHaveCount(0);
  });

  test('wizard publishes an apartment listing → public list + detail', async ({
    page,
    context,
  }) => {
    const { api } = await loginAs(context, SEED.ownerA1);
    const complexes = await api.get<{ items: ComplexLite[] }>('/complexes?pageSize=50');
    const complex = complexes.items.find((c) => c.assetType === 'APT' && c.approvalDate)!;
    expect(complex, 'seed has an approved APT complex').toBeTruthy();

    const wizard = new ListingWizard(page);
    await wizard.open();
    await wizard.apartmentProperty(complex.name, { dong: '101', ho: '1203', floor: '12' });
    await wizard.next();
    await wizard.deal('매매', { amount: '35000' });
    await wizard.next();
    await wizard.detail();
    await wizard.next();
    await wizard.photos();
    await wizard.next();
    await wizard.next(); // 설명·옵션 (optional)
    await wizard.verify();
    await wizard.next();
    const id = await wizard.publish();

    await expectPublic(api, page, id, { complexId: complex.id, ho: '1203' });
  });

  test('wizard publishes a one-room listing (emdCode + buildingUse) → public', async ({
    page,
    context,
  }) => {
    const { api } = await loginAs(context, SEED.ownerA1);
    const regions =
      await api.get<{ code: string; name: string; level: string; lat: number; lng: number }[]>(
        '/regions',
      );
    const emd = regions.find((r) => r.level === 'EMD' && r.name.endsWith('동'))!;
    const road = `전남광주통합특별시 순천시 e2e원룸길 ${Math.floor(Math.random() * 900) + 100}`;
    // Stub only the external geocoder boundary (NAVER_MAP_* keys are not configured in e2e).
    await page.route('**/api/v1/geo/geocode**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              roadAddress: road,
              jibunAddress: `전남광주통합특별시 순천시 ${emd.name} 100-1`,
              zipCode: '57922',
              buildingName: 'e2e 원룸하우스',
              lat: emd.lat,
              lng: emd.lng,
              emdCode: emd.code,
            },
          ],
        }),
      }),
    );

    const wizard = new ListingWizard(page);
    await wizard.open();
    await wizard.oneRoomProperty(road, { floor: '3', totalFloors: '5' });
    await wizard.next();
    await wizard.deal('월세', { amount: '500', rent: '40' });
    await wizard.next();
    await wizard.detail({ area: '23.14' });
    await wizard.next();
    await wizard.photos();
    await wizard.next();
    await wizard.next();
    await wizard.verify();
    await wizard.next();
    const id = await wizard.publish();

    const detail = await expectPublic(api, page, id, {});
    // Shared publish rules (D10): the 읍면동 code and 건축물 용도 were sent and stored.
    expect(detail.emdCode).toBe(emd.code);
    const mine = await api.get<{ property: { buildingUse: string | null; emdCode: string } }>(
      `/agency/listings/${id}`,
    );
    expect(mine.property.buildingUse).toBeTruthy();
    expect(mine.property.emdCode).toBe(emd.code);
  });

  test('co-broker request from another agency reaches the primary', async ({
    page,
    context,
    playwright,
  }) => {
    // Agency a2's owner joins one of agency a1's listings as 공동중개.
    const primary = await apiSessionAs(playwright, SEED.ownerA1);
    const { login: a2 } = await loginAs(context, SEED.ownerA2);
    const candidates = await primary.api.get<{
      items: { id: string; status: string; complex: { id: string; name: string } | null }[];
    }>('/agency/listings?pageSize=100');
    const target = candidates.items.find((l) => l.status === 'ACTIVE' && l.complex)!;
    expect(target, 'a1 has an ACTIVE complex listing').toBeTruthy();

    await page.goto('/agent/listings/co-broker');
    await page
      .getByRole('combobox', { name: '공동중개할 단지 검색' })
      .fill(target.complex!.name.slice(0, 6));
    await page
      .getByRole('option', { name: new RegExp(target.complex!.name) })
      .first()
      .click();
    const join = page.getByRole('button', { name: /공동중개 참여$/ }).first();
    await expect(join).toBeVisible();
    // Join the a1 listing specifically when several rows are listed.
    const row = page.locator(`a[href*="/listing/${target.id}"]`).first();
    const button = (await row.count())
      ? row
          .locator('xpath=ancestor::*[.//button[contains(@aria-label,"공동중개 참여")]][1]')
          .getByRole('button', { name: /공동중개 참여$/ })
      : join;
    await button.click();
    const dialog = page.getByRole('dialog', { name: '공동중개로 참여할까요?' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('담당자', { exact: true }).fill('공동테스트');
    await dialog.getByLabel('담당자 연락처').fill('010-2222-3333');
    const sent = page.waitForResponse(
      (r) =>
        /\/api\/v1\/agency\/listings\/[0-9a-f-]{36}\/co-brokers$/.test(r.url()) &&
        r.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: '공동중개 참여' }).click();
    const res = await sent;
    expect(res.ok(), await res.text()).toBe(true);
    const listingId = /listings\/([0-9a-f-]{36})\/co-brokers/.exec(res.url())![1];

    // The primary agency sees the request on the listing.
    const detail = await primary.api.get<{
      agencies: { agencyId?: string; agency?: { id: string }; status: string }[];
    }>(`/agency/listings/${listingId}`);
    expect(detail.agencies.some((a) => (a.agencyId ?? a.agency?.id) === a2.agencyId)).toBe(true);
    await primary.dispose();
  });
});

async function expectPublic(
  api: Api,
  page: import('playwright/test').Page,
  id: string,
  opts: { complexId?: string; ho?: string },
): Promise<{ id: string; emdCode: string | null }> {
  // Public API: detail + list (the map/list search reads the same rows).
  const detail = await api.get<{ id: string; status: string; emdCode: string | null }>(
    `/listings/${id}`,
  );
  expect(detail.status).toBe('ACTIVE');
  const query = opts.complexId ? `complexId=${opts.complexId}` : `emdCode=${detail.emdCode}`;
  const list = await api.get<{ items: { id: string }[] }>(`/listings?pageSize=100&${query}`);
  expect(list.items.map((l) => l.id)).toContain(id);

  // Public page, as an anonymous visitor would see it.
  const anon = await page.context().browser()!.newContext();
  const visitor = await anon.newPage();
  const res = await visitor.goto(new URL(`/listing/${id}`, page.url()).toString());
  expect(res?.status()).toBe(200);
  await expect(
    visitor.getByRole('heading', { name: '중개대상물 표시·광고 명시사항' }),
  ).toBeVisible();
  if (opts.ho) expect(await visitor.locator('body').innerText()).not.toContain(`${opts.ho}호`);
  await anon.close();
  return detail;
}
