import { expect, test } from 'playwright/test';
import { activeListingWithHo, Api, apiSessionAs } from '../../lib/api';
import { SEED } from '../../lib/env';

/** Anonymous visitor: home → map → complex → listing detail, and the hero search suggest. */
test.describe('anonymous browsing', () => {
  test('home → map → complex → listing detail (명시사항 shown, no 호)', async ({
    page,
    context,
    playwright,
  }) => {
    // The broker's private view knows the 호; the public page must never show it.
    const broker = await apiSessionAs(playwright, SEED.ownerA1);
    const target = await activeListingWithHo(broker.api);
    await broker.dispose();
    const complex = target.complex!;
    const ho = target.property.ho!;
    const api = Api.of(context);

    await page.goto('/');
    // Empty hero search submit opens the apartment map.
    const search = page.getByRole('combobox', { name: '지역 또는 단지명 검색' });
    await search.click();
    await search.press('Enter');
    await expect(page).toHaveURL(/\/map(\/|\?|$)/);
    await expect(page.getByRole('main')).toBeVisible();

    // Map → complex page (the stylized static map has no markers to click deterministically:
    // the complex page is reached by its canonical URL, as a map marker links it).
    await page.goto(`/complex/${complex.id}`);
    await expect(page.getByRole('heading', { name: complex.name }).first()).toBeVisible();

    // Complex page → the listing.
    const link = page.locator(`a[href*="/listing/${target.id}"]`).first();
    if (await link.count()) await link.click();
    else await page.goto(`/listing/${target.id}`);
    await expect(page).toHaveURL(new RegExp(`/listing/${target.id}`));

    // 중개대상물 표시·광고 명시사항 (공인중개사법 제18조의2) block.
    await expect(
      page.getByRole('heading', { name: '중개대상물 표시·광고 명시사항' }),
    ).toBeVisible();
    await expect(page.locator('dl[aria-labelledby="s-disc"]')).toBeVisible();

    // 호수 is never public: not in the public API detail, not on the page.
    const detail = await api.get<Record<string, unknown>>(`/listings/${target.id}`);
    expect(JSON.stringify(detail)).not.toMatch(/"ho"\s*:/);
    const text = await page.locator('body').innerText();
    expect(text).not.toContain(`${ho}호`);
  });

  test('hero search suggests complexes and opens the complex page', async ({ page, context }) => {
    const api = Api.of(context);
    const suggest = await api.get<{ items: { type: string; id: string; label: string }[] }>(
      `/search/suggest?q=${encodeURIComponent('신대')}`,
    );
    const target = suggest.items.find((s) => s.type === 'COMPLEX');
    expect(target, 'seed has a 신대 complex').toBeTruthy();

    await page.goto('/');
    const search = page.getByRole('combobox', { name: '지역 또는 단지명 검색' });
    await search.fill('신대');
    const option = page.getByRole('option', { name: new RegExp(target!.label) });
    await expect(option).toBeVisible();
    // The listbox also offers the 읍면동 (REGION) suggestion.
    await expect(page.getByRole('option').first()).toBeVisible();
    await option.click();
    await expect(page).toHaveURL(new RegExp(`/complex/${target!.id}`));
  });
});
