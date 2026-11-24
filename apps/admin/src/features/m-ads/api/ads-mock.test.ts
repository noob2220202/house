// @vitest-environment node
import { BannerSlot, COOKIE_NAMES } from '@house/shared';
import { NextRequest } from 'next/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  adminBannerPageSchema,
  adminBannerSchema,
  adminPopupPageSchema,
  bannerSlotListSchema,
  bannerStatsSchema,
  mediaSchema,
  regionListSchema,
} from './schemas';

/**
 * The ads mocks answer with the real views (shared AdminBannerView / AdminPopupView /
 * BannerSlotView / BannerStatsView, RegionView[]) and enforce the real input rules (strict
 * bannerUpdateSchema: no slot in a PATCH) — and the screens' schemas parse them.
 */
type R = {
  banners: typeof import('@/app/mock-api/v1/admin/banners/route');
  banner: typeof import('@/app/mock-api/v1/admin/banners/[id]/route');
  stats: typeof import('@/app/mock-api/v1/admin/banners/[id]/stats/route');
  slots: typeof import('@/app/mock-api/v1/admin/banner-slots/route');
  popups: typeof import('@/app/mock-api/v1/admin/popups/route');
  media: typeof import('@/app/mock-api/v1/admin/media/[id]/route');
  regions: typeof import('@/app/mock-api/v1/regions/route');
};
let r: R;

beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCK', '1');
  vi.resetModules();
  r = {
    banners: await import('@/app/mock-api/v1/admin/banners/route'),
    banner: await import('@/app/mock-api/v1/admin/banners/[id]/route'),
    stats: await import('@/app/mock-api/v1/admin/banners/[id]/stats/route'),
    slots: await import('@/app/mock-api/v1/admin/banner-slots/route'),
    popups: await import('@/app/mock-api/v1/admin/popups/route'),
    media: await import('@/app/mock-api/v1/admin/media/[id]/route'),
    regions: await import('@/app/mock-api/v1/regions/route'),
  };
});

function req(path: string, init: { method?: string; body?: unknown } = {}): NextRequest {
  return new NextRequest(
    `http://localhost:3201/api/v1${path}${path.includes('?') ? '&' : '?'}_delay=1`,
    {
      method: init.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        cookie: `${COOKIE_NAMES.ADMIN_SESSION}=mock-ADMIN; ${COOKIE_NAMES.CSRF}=t`,
        'x-csrf-token': 't',
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    },
  );
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe('ads mocks (real contract)', () => {
  it('lists banners as AdminBannerView pages', async () => {
    const res = await r.banners.GET(req('/admin/banners?page=1&pageSize=100'));
    const raw = (await res.json()) as { items: Record<string, unknown>[] };
    expect(raw.items[0]).toHaveProperty('pcImage');
    expect(raw.items[0]).not.toHaveProperty('pcMedia');
    const page = adminBannerPageSchema.parse(raw);
    expect(page.items.length).toBeGreaterThan(3);
  });

  it('refuses a slot in PATCH (bannerUpdateSchema is strict) and accepts the rest', async () => {
    const page = adminBannerPageSchema.parse(
      await (await r.banners.GET(req(`/admin/banners?slot=${BannerSlot.MAIN_HERO}`))).json(),
    );
    const target = page.items[0]!;
    const withSlot = await r.banner.PATCH(
      req(`/admin/banners/${target.id}`, {
        method: 'PATCH',
        body: { slot: BannerSlot.MAIN_STRIP, title: '변경' },
      }),
      ctx(target.id),
    );
    expect(withSlot.status).toBe(400);
    const ok = await r.banner.PATCH(
      req(`/admin/banners/${target.id}`, { method: 'PATCH', body: { title: '변경된 제목' } }),
      ctx(target.id),
    );
    expect(ok.status).toBe(200);
    const saved = adminBannerSchema.parse(await ok.json());
    expect(saved).toMatchObject({ title: '변경된 제목', slot: BannerSlot.MAIN_HERO });
  });

  it('answers stats for the last 30 days by default, with CTR in percent', async () => {
    const page = adminBannerPageSchema.parse(
      await (await r.banners.GET(req('/admin/banners?status=ACTIVE'))).json(),
    );
    const id = page.items[0]!.id;
    const stats = bannerStatsSchema.parse(
      await (await r.stats.GET(req(`/admin/banners/${id}/stats`), ctx(id))).json(),
    );
    expect(stats.from).not.toBeNull();
    expect(stats.daily.length).toBeLessThanOrEqual(30);
    const tooLong = await r.stats.GET(
      req(`/admin/banners/${id}/stats?from=2024-01-01&to=2026-01-01`),
      ctx(id),
    );
    expect(tooLong.status).toBe(400);
  });

  it('returns BannerSlotView rows with the design upload sizes (D4)', async () => {
    const res = await r.slots.GET(req('/admin/banner-slots'));
    const { items } = bannerSlotListSchema.parse(await res.json());
    const hero = items.find((s) => s.slot === BannerSlot.MAIN_HERO)!;
    expect(hero.pc).toEqual({ width: 2480, height: 440 });
    expect(hero.mobile).toEqual({ width: 1074, height: 480 });
    expect(hero.scheduledCount).not.toBeNull();
  });

  it('lists popups as AdminPopupView pages and serves admin media metadata', async () => {
    const res = await r.popups.GET(req('/admin/popups'));
    const page = adminPopupPageSchema.parse(await res.json());
    expect(page.items.length).toBeGreaterThan(0);
    const mediaId = page.items[0]!.media.id;
    const media = mediaSchema.parse(
      await (await r.media.GET(req(`/admin/media/${mediaId}`), ctx(mediaId))).json(),
    );
    expect(media.status).toBe('READY');
  });

  it('serves GET /regions as a bare RegionView array', async () => {
    const res = await r.regions.GET(req('/regions'));
    const body: unknown = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(regionListSchema.parse(body).items.length).toBeGreaterThan(5);
  });
});
