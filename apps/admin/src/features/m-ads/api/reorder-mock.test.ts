// @vitest-environment node
import { BannerSlot, COOKIE_NAMES } from '@house/shared';
import { NextRequest } from 'next/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * The banner reorder mock follows the real contract (`bannerReorderSchema` = `{ slot, ids }`):
 * every id must belong to `slot`, and the slot's order becomes the listed one.
 */
type Route = typeof import('@/app/mock-api/v1/admin/banners/reorder/route');
type Store = typeof import('@/app/mock-api/v1/admin/banners/_store');
let route: Route;
let store: Store;

beforeAll(async () => {
  // MOCK_ENABLED is read when '@/lib/mock' is first imported.
  vi.stubEnv('NEXT_PUBLIC_API_MOCK', '1');
  vi.resetModules();
  route = await import('@/app/mock-api/v1/admin/banners/reorder/route');
  store = await import('@/app/mock-api/v1/admin/banners/_store');
});

function put(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3201/api/v1/admin/banners/reorder?_delay=1', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      cookie: `${COOKIE_NAMES.ADMIN_SESSION}=mock-ADMIN; ${COOKIE_NAMES.CSRF}=t`,
      'x-csrf-token': 't',
    },
    body: JSON.stringify(body),
  });
}

describe('PUT /admin/banners/reorder (mock)', () => {
  it('reorders the banners of the given slot', async () => {
    const ids = store.slotBanners(BannerSlot.MAIN_HERO).map((b) => b.id);
    expect(ids.length).toBeGreaterThan(1);
    const next = [...ids].reverse();
    const res = await route.PUT(put({ slot: BannerSlot.MAIN_HERO, ids: next }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { id: string; sortOrder: number }[] };
    expect(body.items.map((i) => i.id)).toEqual(next);
    expect(store.slotBanners(BannerSlot.MAIN_HERO).map((b) => b.id)).toEqual(next);
  });

  it('refuses a body without the slot and ids of another slot', async () => {
    const ids = store.slotBanners(BannerSlot.MAIN_HERO).map((b) => b.id);
    expect((await route.PUT(put({ ids }))).status).toBe(400);
    const other = otherSlot();
    const res = await route.PUT(put({ slot: other, ids }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});

/** Any slot other than MAIN_HERO (its banners are not MAIN_HERO's). */
function otherSlot(): BannerSlot {
  const slot = Object.values(BannerSlot).find((s) => s !== BannerSlot.MAIN_HERO);
  if (!slot) throw new Error('expected a second banner slot');
  return slot;
}
