import { BANNER_SLOT_SPECS, BannerSlot, BannerTargeting } from '@house/shared';
import type { BannerSlotInfo } from '../api/schemas';
import { formatSize } from './image-rules';

export const SLOT_ORDER = Object.values(BannerSlot) as BannerSlot[];

export const isBannerSlot = (value: string | null | undefined): value is BannerSlot =>
  !!value && (SLOT_ORDER as string[]).includes(value);

/** Page skeleton used by the live preview. */
export type SlotPreviewKind =
  | 'hero'
  | 'strip'
  | 'map'
  | 'complex'
  | 'listing'
  | 'agencies'
  | 'mobile';

export interface SlotMeta {
  /** User-site path where the slot is rendered ("실제 화면" link). */
  sitePath: string;
  /** Where the slot shows up, for the spec sheet. */
  where: string;
  preview: SlotPreviewKind;
  /** Card caption when the slot has room (otherwise the remaining seats are shown). */
  caption?: string;
  /** Targeting that makes most sense for the slot (preselected for new banners). */
  defaultTargeting: BannerTargeting;
}

export const SLOT_META: Record<BannerSlot, SlotMeta> = {
  MAIN_HERO: {
    sitePath: '/',
    where: '메인 화면 최상단, 검색 영역 아래 대형 배너 (순서대로 넘김)',
    preview: 'hero',
    defaultTargeting: BannerTargeting.ALL,
  },
  MAIN_STRIP: {
    sitePath: '/',
    where: '메인 화면 중간, 섹션 사이 가로 띠배너',
    preview: 'strip',
    defaultTargeting: BannerTargeting.ALL,
  },
  MAP_AD: {
    sitePath: '/map/apt',
    where: '지도 화면 좌측 하단 카드 (모바일은 지도 위 한 줄)',
    preview: 'map',
    caption: '지역 타기팅',
    defaultTargeting: BannerTargeting.REGIONS,
  },
  COMPLEX_FEATURED_AGENCY: {
    sitePath: '/map/apt',
    where: '단지 상세의 "이 단지 전문 중개사무소" 영역',
    preview: 'complex',
    caption: '단지 타기팅',
    defaultTargeting: BannerTargeting.COMPLEXES,
  },
  LISTING_SIDE: {
    sitePath: '/map/apt',
    where: '매물 상세 오른쪽 사이드 (PC 전용)',
    preview: 'listing',
    defaultTargeting: BannerTargeting.ALL,
  },
  AGENCY_SEARCH_TOP: {
    sitePath: '/agencies',
    where: '중개사무소 찾기 목록 상단',
    preview: 'agencies',
    defaultTargeting: BannerTargeting.ALL,
  },
  MOBILE_MAIN: {
    sitePath: '/',
    where: '모바일 메인 화면 상단 배너 (모바일 전용)',
    preview: 'mobile',
    caption: '모바일 전용',
    defaultTargeting: BannerTargeting.ALL,
  },
};

/** Slots from the shared defaults — used when `GET /admin/banner-slots` is not available (403). */
export function fallbackSlots(): BannerSlotInfo[] {
  return SLOT_ORDER.map((slot) => {
    const spec = BANNER_SLOT_SPECS[slot];
    return {
      slot,
      label: spec.label,
      maxActive: spec.maxActive,
      defaultMaxActive: spec.maxActive,
      pc: spec.pc,
      mobile: spec.mobile,
      activeCount: null,
      scheduledCount: null,
      pausedCount: null,
      totalCount: null,
    };
  });
}

export const slotLabel = (slot: BannerSlot, slots?: readonly BannerSlotInfo[]) =>
  slots?.find((s) => s.slot === slot)?.label ?? BANNER_SLOT_SPECS[slot].label;

/** True when the slot shows the same creative on phones only (pc spec === mobile spec). */
export const isMobileOnlySlot = (slot: BannerSlot) => SLOT_META[slot].preview === 'mobile';

/** "PC 2480×440 / 모바일 1074×480" */
export function slotSpecText(info: Pick<BannerSlotInfo, 'slot' | 'pc' | 'mobile'>): string {
  if (isMobileOnlySlot(info.slot)) return `모바일 ${formatSize(info.pc, '×')}`;
  const pc = `PC ${formatSize(info.pc, '×')}`;
  return info.mobile ? `${pc} / 모바일 ${formatSize(info.mobile, '×')}` : `${pc} · 모바일 미노출`;
}

export interface SlotCaption {
  text: string;
  warn: boolean;
}

/** Caption of a slot overview card: seats left when the slot is (nearly) full, the spec otherwise. */
export function slotCaption(info: BannerSlotInfo): SlotCaption {
  const waiting = info.scheduledCount ? ` · 대기 ${info.scheduledCount}` : '';
  if (info.activeCount !== null) {
    const left = info.maxActive - info.activeCount;
    if (left <= 0) return { text: `가득 참${waiting}`, warn: true };
    if (left === 1 && info.maxActive > 1) return { text: `1자리 남음${waiting}`, warn: true };
  }
  const meta = SLOT_META[info.slot];
  if (meta.caption) return { text: meta.caption, warn: false };
  return { text: info.mobile ? 'PC · 모바일' : formatSize(info.pc), warn: false };
}

/** Meter fill 0–100. */
export function slotFill(info: BannerSlotInfo): number {
  if (info.activeCount === null || info.maxActive <= 0) return 0;
  return Math.min(100, Math.round((info.activeCount / info.maxActive) * 100));
}
