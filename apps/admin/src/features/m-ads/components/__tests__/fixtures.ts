import { BANNER_SLOT_SPECS, BannerSlot, BannerStatus, BannerTargeting } from '@house/shared';
import type { AdminBanner, BannerSlotInfo } from '../../api/schemas';

const DAY = 86_400_000;
/** ISO instant `days` from now (tests compute statuses against the real clock). */
export const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();

export const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export function makeBanner(n: number, patch: Partial<AdminBanner> = {}): AdminBanner {
  return {
    id: ID(n),
    code: `AD-${String(n).padStart(2, '0')}`,
    slot: BannerSlot.MAIN_HERO,
    title: `배너 ${n}`,
    advertiserName: '분양 광고주 A',
    agencyId: null,
    agency: null,
    pcMedia: {
      id: ID(100 + n),
      width: 1920,
      height: 520,
      variants: { large: { url: `/media/banner/${n}.webp`, width: 1920, height: 520 } },
    },
    mobileMedia: null,
    linkUrl: null,
    newWindow: false,
    startAt: inDays(-10),
    endAt: inDays(7.5),
    paused: false,
    priority: 0,
    sortOrder: n,
    targeting: BannerTargeting.ALL,
    targetRegionCodes: [],
    targetComplexIds: [],
    targetRegions: [],
    targetComplexes: [],
    memo: null,
    status: BannerStatus.ACTIVE,
    impressions: 48210,
    clicks: 1126,
    ...patch,
  };
}

export function makeSlot(slot: BannerSlot, patch: Partial<BannerSlotInfo> = {}): BannerSlotInfo {
  const spec = BANNER_SLOT_SPECS[slot];
  return {
    slot,
    label: spec.label,
    maxActive: spec.maxActive,
    pc: spec.pc,
    mobile: spec.mobile,
    activeCount: 2,
    scheduledCount: 0,
    pausedCount: 0,
    totalCount: 2,
    ...patch,
  };
}
