import { BannerSlot, BannerStatus, BannerTargeting } from '@house/shared';
import { describe, expect, it } from 'vitest';
import {
  adminBannerPageSchema,
  adminBannerSchema,
  adminPopupSchema,
  bannerSlotListSchema,
  bannerStatsSchema,
  mediaUrl,
  regionListSchema,
} from './schemas';

const ID = '00000000-0000-4000-8000-000000000001';
const media = {
  id: ID,
  width: 1920,
  height: 520,
  variants: {
    thumb: { url: '/media/b/t.webp', width: 320, height: 87 },
    large: { url: '/media/b/l.webp', width: 1920, height: 520 },
  },
};
const image = { id: ID, url: '/media/b/l.webp', width: 2480, height: 440 };
/** Shared `AdminBannerView` as the API returns it (ads.mapper.ts). */
const banner = {
  id: ID,
  slot: 'MAIN_HERO',
  title: '연향들 더 퍼스트 견본주택 오픈',
  advertiserName: '분양 광고주 A',
  agency: null,
  pcImage: image,
  mobileImage: null,
  linkUrl: '/map/apt',
  newWindow: false,
  startAt: '2026-11-01T00:00:00+09:00',
  endAt: '2026-11-30T23:59:59+09:00',
  paused: false,
  status: 'ACTIVE',
  priority: 0,
  sortOrder: 1,
  targeting: 'REGIONS',
  targetRegionCodes: ['1215012000'],
  targetComplexes: [],
  memo: null,
  createdByAdminId: null,
  createdAt: '2026-10-30T00:00:00.000Z',
  updatedAt: '2026-10-30T00:00:00.000Z',
};

describe('ads response schemas (real views)', () => {
  it('maps AdminBannerView onto the screen model', () => {
    const parsed = adminBannerSchema.parse({
      ...banner,
      agency: { id: 'a1', name: '연향 공인중개사사무소' },
      targetComplexes: [{ id: 'c1', name: '레이크파크' }],
    });
    expect(parsed).toMatchObject({
      slot: BannerSlot.MAIN_HERO,
      status: BannerStatus.ACTIVE,
      targeting: BannerTargeting.REGIONS,
      agencyId: 'a1',
      code: null,
      // no counters in the view: loaded from the stats endpoint
      impressions: null,
      clicks: null,
      targetRegionCodes: ['1215012000'],
      targetRegions: [{ code: '1215012000', name: '1215012000' }],
      targetComplexIds: ['c1'],
    });
    expect(mediaUrl(parsed.pcMedia)).toBe('/media/b/l.webp');
    expect(parsed.pcMedia).toMatchObject({ width: 2480, height: 440 });
    expect(parsed.mobileMedia).toBeNull();
  });

  it('rejects the old assumed shape, unknown slots and statuses', () => {
    const { pcImage: _pc, ...withoutImage } = banner;
    expect(adminBannerSchema.safeParse({ ...withoutImage, pcMedia: image }).success).toBe(false);
    expect(adminBannerSchema.safeParse({ ...banner, slot: 'FOOTER' }).success).toBe(false);
    expect(adminBannerSchema.safeParse({ ...banner, status: 'LIVE' }).success).toBe(false);
  });

  it('parses the pagination envelope', () => {
    const page = adminBannerPageSchema.parse({
      items: [banner],
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });
    expect(page.items).toHaveLength(1);
  });

  it('derives the scheduled count from BannerSlotView (upcoming − active)', () => {
    const { items } = bannerSlotListSchema.parse({
      items: [
        {
          slot: 'LISTING_SIDE',
          label: '매물 상세 사이드',
          pc: { width: 300, height: 250 },
          mobile: null,
          maxActive: 4,
          defaultMaxActive: 4,
          isEnabled: true,
          note: null,
          requiresAgency: false,
          requiredTargeting: null,
          activeCount: 2,
          upcomingCount: 5,
        },
        {
          slot: 'MAIN_HERO',
          label: '메인 상단 대형',
          maxActive: 8,
          pc: { width: 2480, height: 440 },
          mobile: { width: 1074, height: 480 },
        },
      ],
    });
    expect(items[0]).toMatchObject({ activeCount: 2, scheduledCount: 3, totalCount: null });
    expect(items[1]).toMatchObject({ activeCount: null, scheduledCount: null, totalCount: null });
  });

  it('parses stats and maps AdminPopupView', () => {
    expect(
      bannerStatsSchema.parse({
        bannerId: ID,
        from: '2026-11-01',
        to: '2026-11-01',
        totals: { impressions: 10, clicks: 1, ctr: 10 },
        daily: [{ date: '2026-11-01', impressions: 10, clicks: 1, ctr: 10 }],
      }).daily,
    ).toHaveLength(1);
    const popup = adminPopupSchema.parse({
      id: ID,
      title: '허위매물 신고 포상 안내',
      image: { ...image, width: 760, height: 600 },
      linkUrl: null,
      newWindow: false,
      targetPages: ['MAIN', 'MAP'],
      startAt: '2026-11-10T00:00:00+09:00',
      endAt: '2026-11-30T23:59:59+09:00',
      paused: false,
      status: 'ACTIVE',
      dismissDays: 7,
      sortOrder: 1,
      createdByAdminId: null,
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    });
    expect(popup).toMatchObject({ impressions: null, clicks: null, code: null });
    expect(mediaUrl(popup.media)).toBe('/media/b/l.webp');
  });

  it('normalizes GET /regions (a bare RegionView array) and drops inactive rows', () => {
    const view = (code: string, name: string, isActive = true) => ({
      code,
      name,
      fullName: `전남광주통합특별시 순천시 ${name}`,
      level: 'EMD',
      parentCode: '12150',
      lat: null,
      lng: null,
      isActive,
    });
    expect(
      regionListSchema.parse([view('1215012000', '조례동'), view('1215099999', '폐지동', false)]),
    ).toEqual({ items: [{ code: '1215012000', name: '조례동' }] });
    expect(regionListSchema.safeParse({ items: [] }).success).toBe(false);
  });
});

describe('mediaUrl', () => {
  it('prefers the largest variant, then the full-size url', () => {
    expect(mediaUrl(media)).toBe('/media/b/l.webp');
    expect(mediaUrl({ ...media, variants: { thumb: media.variants.thumb } })).toBe(
      '/media/b/t.webp',
    );
    expect(mediaUrl({ ...media, url: '/media/b/full.webp', variants: {} })).toBe(
      '/media/b/full.webp',
    );
    expect(mediaUrl({ ...media, url: null, variants: {} })).toBeNull();
    expect(mediaUrl(null)).toBeNull();
  });
});
