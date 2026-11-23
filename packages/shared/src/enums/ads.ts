import type { EnumValue } from './define';

export const BannerSlot = {
  MAIN_HERO: 'MAIN_HERO',
  MAIN_STRIP: 'MAIN_STRIP',
  MAP_AD: 'MAP_AD',
  COMPLEX_FEATURED_AGENCY: 'COMPLEX_FEATURED_AGENCY',
  LISTING_SIDE: 'LISTING_SIDE',
  AGENCY_SEARCH_TOP: 'AGENCY_SEARCH_TOP',
  MOBILE_MAIN: 'MOBILE_MAIN',
} as const;
export type BannerSlot = EnumValue<typeof BannerSlot>;

/** Computed from paused flag + start/end window; never stored. */
export const BannerStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  SCHEDULED: 'SCHEDULED',
  ENDED: 'ENDED',
} as const;
export type BannerStatus = EnumValue<typeof BannerStatus>;

export const BannerTargeting = {
  ALL: 'ALL',
  REGIONS: 'REGIONS',
  COMPLEXES: 'COMPLEXES',
} as const;
export type BannerTargeting = EnumValue<typeof BannerTargeting>;

export const PopupPage = {
  ALL: 'ALL',
  MAIN: 'MAIN',
  MAP: 'MAP',
  COMPLEX_DETAIL: 'COMPLEX_DETAIL',
  LISTING_DETAIL: 'LISTING_DETAIL',
  AGENCY_LIST: 'AGENCY_LIST',
  DEAL_REQUEST: 'DEAL_REQUEST',
} as const;
export type PopupPage = EnumValue<typeof PopupPage>;

export function computeScheduleStatus(
  item: { paused: boolean; startAt: Date; endAt: Date },
  now: Date = new Date(),
): BannerStatus {
  if (now >= item.endAt) return BannerStatus.ENDED;
  if (item.paused) return BannerStatus.PAUSED;
  if (now < item.startAt) return BannerStatus.SCHEDULED;
  return BannerStatus.ACTIVE;
}
