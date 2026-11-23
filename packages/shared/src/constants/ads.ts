import type { BannerSlot } from '../enums/ads';

export interface BannerSlotSpec {
  /** Max simultaneously live banners in the slot (overridable in banner_slot_configs). */
  maxActive: number;
  /** Recommended image size in px (pc / mobile). */
  pc: { width: number; height: number };
  mobile: { width: number; height: number } | null;
  label: string;
}

export const BANNER_SLOT_SPECS: Record<BannerSlot, BannerSlotSpec> = {
  MAIN_HERO: {
    maxActive: 8,
    pc: { width: 1920, height: 520 },
    mobile: { width: 750, height: 560 },
    label: '메인 상단 대형',
  },
  MAIN_STRIP: {
    maxActive: 6,
    pc: { width: 1200, height: 120 },
    mobile: { width: 750, height: 200 },
    label: '메인 띠배너',
  },
  MAP_AD: {
    maxActive: 4,
    pc: { width: 360, height: 200 },
    mobile: { width: 750, height: 200 },
    label: '지도 광고',
  },
  COMPLEX_FEATURED_AGENCY: {
    maxActive: 3,
    pc: { width: 360, height: 120 },
    mobile: { width: 750, height: 200 },
    label: '단지 추천 중개사무소',
  },
  LISTING_SIDE: {
    maxActive: 4,
    pc: { width: 300, height: 250 },
    mobile: null,
    label: '매물 상세 사이드',
  },
  AGENCY_SEARCH_TOP: {
    maxActive: 3,
    pc: { width: 1200, height: 150 },
    mobile: { width: 750, height: 200 },
    label: '중개사무소 찾기 상단',
  },
  MOBILE_MAIN: {
    maxActive: 8,
    pc: { width: 750, height: 560 },
    mobile: { width: 750, height: 560 },
    label: '모바일 메인',
  },
};

export const POPUP_MAX_DISMISS_DAYS = 30;
