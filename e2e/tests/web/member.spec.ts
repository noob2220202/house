import { expect, test } from 'playwright/test';
import { anyComplexListing, loginAs } from '../../lib/api';
import { uniq } from '../../lib/env';
import { installFakePostcode, pickFakeAddress } from '../../lib/postcode';

/** Signed-in member (fresh USER per test via the TEST-ONLY login). */
test.describe('member', () => {
  test('favorite a listing → /me/favorites', async ({ page, context }) => {
    const { api } = await loginAs(context, `${uniq('fav')}@e2e.example.invalid`, {
      nickname: '관심테스터',
    });
    const listing = await anyComplexListing(api);

    await page.goto(`/listing/${listing.id}`);
    const heart = page.getByRole('button', { name: /관심 매물에 추가/ }).first();
    await expect(heart).toHaveAttribute('aria-pressed', 'false');
    await heart.click();
    await expect(page.getByRole('button', { name: /관심 매물에서 빼기/ }).first()).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Persisted server-side, not only optimistic.
    await api.waitFor<{ items: { listing?: { id: string }; id?: string }[] }>(
      '/me/favorites/listings',
      (b) => b.items.some((i) => (i.listing?.id ?? i.id) === listing.id),
    );

    await page.goto('/me/favorites');
    await expect(page.getByRole('tab', { name: /관심 매물/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator(`a[href*="/listing/${listing.id}"]`).first()).toBeVisible();
  });

  test('내놓기 with consents → /me/requests', async ({ page, context }) => {
    const { api } = await loginAs(context, `${uniq('sell')}@e2e.example.invalid`, {
      nickname: '매도테스터',
    });
    // A 원룸 in a seeded 읍면동 (current 12150… code, D1) — no complex matching involved.
    const regions = await api.get<{ code: string; name: string; level: string }[]>('/regions');
    const emd = regions.find((r) => r.level === 'EMD')!;
    const road = `전남광주통합특별시 순천시 e2e로 ${Math.floor(Math.random() * 900) + 100}`;
    await installFakePostcode(page, {
      roadAddress: road,
      jibunAddress: `전남광주통합특별시 순천시 ${emd.name} 1-1`,
      zonecode: '57900',
      bcode: emd.code,
      bname: emd.name,
      apartment: 'N',
    });

    await page.goto('/deal/sell');
    // A. 매물 기본 정보
    await page.getByRole('radiogroup', { name: '매물 유형' }).getByText('원룸·투룸').click();
    await page.getByRole('button', { name: '주소 찾기' }).click();
    await pickFakeAddress(page);
    await expect(page.locator('#sell-addr')).toHaveValue(road);
    await page.locator('#sell-detail').fill('302호');
    await page.getByLabel('해당 층').fill('3');
    await page.getByRole('button', { name: '다음 단계로' }).click();

    // B. 거래 조건 (전세)
    await page.getByRole('radiogroup', { name: '거래 유형' }).getByText('전세').click();
    await page.locator('#sell-deposit').fill('8000');
    await page.locator('#sell-area').fill('23.5');
    await page.getByText('즉시 입주').click();
    await page.getByRole('button', { name: '다음 단계로' }).click();

    // C/D. 연락처 · 전달 범위 · 동의 (DEAL_REQUEST_PRIVACY + DEAL_REQUEST_PROVIDE, D8)
    await page.getByLabel('이름').fill('김테스트');
    await page.getByLabel('휴대폰 번호').fill('010-1234-5678');
    await page.getByText('필수 항목에 모두 동의합니다').click();
    await page.getByRole('button', { name: '다음 단계로' }).click();

    // Review → submit. The POST must carry the consents with the current versions.
    const created = page.waitForResponse(
      (r) => r.url().endsWith('/api/v1/deal-requests') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: '요청 등록하기' }).click();
    const res = await created;
    expect(res.status(), await res.text()).toBe(201);
    const body = res.request().postDataJSON() as { consents: { type: string }[] };
    expect(body.consents.map((c) => c.type).sort()).toEqual([
      'DEAL_REQUEST_PRIVACY',
      'DEAL_REQUEST_PROVIDE',
    ]);
    await expect(page).toHaveURL(/\/deal\/sell\/complete/);

    await page.goto('/me/requests');
    await expect(page.getByText(road).or(page.getByText(emd.name)).first()).toBeVisible();
  });
});
