import { BANNER_SLOT_SPECS, BannerSlot } from '@house/shared';
import { describe, expect, it } from 'vitest';
import type { BannerSlotInfo } from '../api/schemas';
import {
  fallbackSlots,
  isBannerSlot,
  isMobileOnlySlot,
  SLOT_META,
  SLOT_ORDER,
  slotCaption,
  slotFill,
  slotLabel,
  slotSpecText,
} from './slots';

const info = (slot: BannerSlot, patch: Partial<BannerSlotInfo> = {}): BannerSlotInfo => {
  const spec = BANNER_SLOT_SPECS[slot];
  return {
    slot,
    label: spec.label,
    maxActive: spec.maxActive,
    pc: spec.pc,
    mobile: spec.mobile,
    activeCount: 0,
    scheduledCount: 0,
    pausedCount: 0,
    totalCount: 0,
    ...patch,
  };
};

describe('slot metadata', () => {
  it('covers every slot of the shared enum', () => {
    expect(SLOT_ORDER).toEqual(Object.values(BannerSlot));
    for (const slot of SLOT_ORDER) expect(SLOT_META[slot].sitePath.startsWith('/')).toBe(true);
  });

  it('guards slot query values', () => {
    expect(isBannerSlot('MAP_AD')).toBe(true);
    expect(isBannerSlot('map_ad')).toBe(false);
    expect(isBannerSlot(null)).toBe(false);
  });

  it('labels come from the API when given, otherwise from the shared defaults', () => {
    expect(slotLabel(BannerSlot.MAP_AD)).toBe(BANNER_SLOT_SPECS.MAP_AD.label);
    expect(
      slotLabel(BannerSlot.MAP_AD, [info(BannerSlot.MAP_AD, { label: '지도 광고 카드' })]),
    ).toBe('지도 광고 카드');
  });
});

describe('slotSpecText', () => {
  it('prints both sizes, or says where a slot is not shown', () => {
    expect(slotSpecText(info(BannerSlot.MAIN_HERO))).toBe('PC 2480×440 / 모바일 1074×480');
    expect(slotSpecText(info(BannerSlot.LISTING_SIDE))).toBe('PC 300×250 · 모바일 미노출');
    expect(slotSpecText(info(BannerSlot.MOBILE_MAIN))).toBe('모바일 1074×480');
    expect(isMobileOnlySlot(BannerSlot.MOBILE_MAIN)).toBe(true);
    expect(isMobileOnlySlot(BannerSlot.MAIN_HERO)).toBe(false);
  });
});

describe('slotCaption', () => {
  it('warns when the slot is full or has one seat left', () => {
    expect(
      slotCaption(info(BannerSlot.COMPLEX_FEATURED_AGENCY, { activeCount: 3, scheduledCount: 1 })),
    ).toEqual({
      text: '가득 참 · 대기 1',
      warn: true,
    });
    expect(slotCaption(info(BannerSlot.MAP_AD, { activeCount: 3 }))).toEqual({
      text: '1자리 남음',
      warn: true,
    });
  });

  it('does not call a single-seat slot "1자리 남음" while it is empty', () => {
    expect(slotCaption(info(BannerSlot.MAIN_STRIP, { maxActive: 1, activeCount: 0 })).warn).toBe(
      false,
    );
  });

  it('otherwise describes the slot', () => {
    expect(slotCaption(info(BannerSlot.MAIN_HERO, { activeCount: 2 }))).toEqual({
      text: 'PC · 모바일',
      warn: false,
    });
    expect(slotCaption(info(BannerSlot.LISTING_SIDE, { activeCount: 2 })).text).toBe('300 × 250');
    expect(slotCaption(info(BannerSlot.MAP_AD, { activeCount: 1 })).text).toBe('지역 타기팅');
    expect(slotCaption(info(BannerSlot.MOBILE_MAIN, { activeCount: 2 })).text).toBe('모바일 전용');
  });

  it('never warns when the counts are unknown (fallback slots)', () => {
    for (const slot of fallbackSlots()) expect(slotCaption(slot).warn).toBe(false);
  });
});

describe('slotFill', () => {
  it('is the live share of the limit, capped at 100', () => {
    expect(slotFill(info(BannerSlot.MAIN_HERO, { activeCount: 2 }))).toBe(25);
    expect(slotFill(info(BannerSlot.MAP_AD, { activeCount: 9 }))).toBe(100);
    expect(slotFill(info(BannerSlot.MAP_AD, { activeCount: null }))).toBe(0);
    expect(slotFill(info(BannerSlot.MAP_AD, { maxActive: 0, activeCount: 1 }))).toBe(0);
  });
});

describe('fallbackSlots', () => {
  it('mirrors the shared specs without counts', () => {
    const slots = fallbackSlots();
    expect(slots).toHaveLength(SLOT_ORDER.length);
    expect(slots[0]).toMatchObject({
      slot: BannerSlot.MAIN_HERO,
      maxActive: BANNER_SLOT_SPECS.MAIN_HERO.maxActive,
      activeCount: null,
      totalCount: null,
    });
  });
});
