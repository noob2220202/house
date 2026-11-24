import { BannerSlot, BannerStatus, BannerTargeting } from '@house/shared';
import { describe, expect, it } from 'vitest';
import {
  adminBannerPageSchema,
  adminBannerSchema,
  adminPopupSchema,
  bannerSlotListSchema,
  bannerStatsSchema,
  mediaUrl,
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
const banner = {
  id: ID,
  slot: 'MAIN_HERO',
  title: '연향들 더 퍼스트 견본주택 오픈',
  advertiserName: '분양 광고주 A',
  agencyId: null,
  pcMedia: media,
  mobileMedia: null,
  linkUrl: '/map/apt',
  newWindow: false,
  startAt: '2026-11-01T00:00:00+09:00',
  endAt: '2026-11-30T23:59:59+09:00',
  paused: false,
  sortOrder: 1,
  targeting: 'ALL',
  status: 'ACTIVE',
};

describe('ads response schemas', () => {
  it('parses a minimal banner and fills the optional parts', () => {
    const parsed = adminBannerSchema.parse(banner);
    expect(parsed).toMatchObject({
      slot: BannerSlot.MAIN_HERO,
      status: BannerStatus.ACTIVE,
      targeting: BannerTargeting.ALL,
      priority: 0,
      impressions: 0,
      clicks: 0,
      targetRegions: [],
      targetComplexes: [],
      targetRegionCodes: [],
      targetComplexIds: [],
    });
  });

  it('rejects unknown slots and statuses', () => {
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

  it('slot counts default to null (limits without live counts)', () => {
    const { items } = bannerSlotListSchema.parse({
      items: [
        {
          slot: 'LISTING_SIDE',
          label: '매물 상세 사이드',
          maxActive: 4,
          pc: { width: 300, height: 250 },
          mobile: null,
        },
      ],
    });
    expect(items[0]).toMatchObject({ activeCount: null, totalCount: null, mobile: null });
  });

  it('parses stats and popups', () => {
    expect(
      bannerStatsSchema.parse({
        bannerId: ID,
        from: null,
        to: null,
        totals: { impressions: 10, clicks: 1, ctr: 0.1 },
        daily: [{ date: '2026-11-01', impressions: 10, clicks: 1 }],
      }).daily,
    ).toHaveLength(1);
    expect(
      adminPopupSchema.parse({
        id: ID,
        title: '허위매물 신고 포상 안내',
        media,
        linkUrl: null,
        newWindow: false,
        targetPages: ['MAIN', 'MAP'],
        startAt: '2026-11-10T00:00:00+09:00',
        endAt: '2026-11-30T23:59:59+09:00',
        paused: false,
        dismissDays: 7,
        sortOrder: 1,
        status: 'ACTIVE',
      }),
    ).toMatchObject({ impressions: 0, clicks: 0 });
  });
});

describe('mediaUrl', () => {
  it('prefers the largest variant', () => {
    expect(mediaUrl(media)).toBe('/media/b/l.webp');
    expect(mediaUrl({ ...media, variants: { thumb: media.variants.thumb } })).toBe(
      '/media/b/t.webp',
    );
    expect(mediaUrl({ ...media, variants: {} })).toBeNull();
    expect(mediaUrl(null)).toBeNull();
  });
});
