import { bannerInputSchema, BannerSlot, BannerStatus, BannerTargeting } from '@house/shared';
import { describe, expect, it } from 'vitest';
import type { AdminBanner } from '../api/schemas';
import {
  applyStatusChoice,
  bannerFormSchema,
  bannerToForm,
  duplicateToForm,
  emptyBannerForm,
  isAdLinkUrl,
  LAST_POSITION,
  requestedPosition,
  resolvePosition,
  statusChoiceOf,
  TITLE_MAX,
  toBannerInput,
  type BannerFormValues,
} from './banner-form';

// 2026-11-24 12:00 KST
const NOW = new Date('2026-11-24T03:00:00Z');
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const IMAGE = { mediaId: ID(1), url: '/media/banner/a.webp', width: 1920, height: 520 };

const valid = (patch: Partial<BannerFormValues> = {}): BannerFormValues => ({
  ...emptyBannerForm(BannerSlot.MAIN_HERO, NOW),
  title: '순천 이사·입주청소 한 번에 예약',
  pcImage: IMAGE,
  ...patch,
});

const errorsOf = (values: BannerFormValues) => {
  const parsed = bannerFormSchema.safeParse(values);
  return parsed.success
    ? {}
    : Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message]));
};

const banner = (patch: Partial<AdminBanner> = {}): AdminBanner => ({
  id: ID(9),
  code: 'AD-03',
  slot: BannerSlot.MAIN_HERO,
  title: '순천 이사·입주청소 한 번에 예약',
  advertiserName: '늘봄 이사·청소',
  agencyId: null,
  agency: null,
  pcMedia: {
    id: ID(1),
    width: 1920,
    height: 520,
    variants: { large: { url: '/media/banner/a.webp', width: 1920, height: 520 } },
  },
  mobileMedia: null,
  linkUrl: 'https://example.com/nulbom?utm_source=brand',
  newWindow: true,
  startAt: '2026-12-01T00:00:00+09:00',
  endAt: '2026-12-31T23:59:59+09:00',
  paused: false,
  priority: 0,
  sortOrder: 2,
  targeting: BannerTargeting.REGIONS,
  targetRegionCodes: ['4615033028'],
  targetComplexIds: [],
  targetRegions: [{ code: '4615033028', name: '신대지구' }],
  targetComplexes: [],
  memo: null,
  status: BannerStatus.SCHEDULED,
  impressions: 0,
  clicks: 0,
  ...patch,
});

describe('isAdLinkUrl', () => {
  it('allows https and site-relative paths only', () => {
    expect(isAdLinkUrl('https://example.com/nulbom?utm_source=brand')).toBe(true);
    expect(isAdLinkUrl('/map/apt?q=%EC%97%B0%ED%96%A5')).toBe(true);
    expect(isAdLinkUrl('http://example.com')).toBe(false);
    expect(isAdLinkUrl('//evil.example.com')).toBe(false);
    expect(isAdLinkUrl('javascript:alert(1)')).toBe(false);
    expect(isAdLinkUrl('example.com')).toBe(false);
  });

  it('refuses backslashes, whitespace and control characters (protocol-relative tricks)', () => {
    expect(isAdLinkUrl('/\\evil.example.com')).toBe(false);
    expect(isAdLinkUrl('/\\/evil.example.com')).toBe(false);
    expect(isAdLinkUrl('https://example.com\\@evil.example.com')).toBe(false);
    expect(isAdLinkUrl('/map apt')).toBe(false);
    expect(isAdLinkUrl('/\t/evil.example.com')).toBe(false);
    expect(isAdLinkUrl('https://exa\u0000mple.com')).toBe(false);
  });
});

describe('order position', () => {
  it('shows LAST_POSITION as the last place and clamps explicit places', () => {
    expect(resolvePosition(LAST_POSITION, 4)).toBe(4);
    expect(resolvePosition(2, 4)).toBe(2);
    expect(resolvePosition(9, 4)).toBe(4);
    expect(resolvePosition(LAST_POSITION, 0)).toBe(1);
  });

  it('asks for no reorder when an appended item should stay last', () => {
    // new banner, counts still loading (size 1) → keep the backend's append
    expect(requestedPosition(LAST_POSITION, 1, true)).toBeNull();
    expect(requestedPosition(LAST_POSITION, 4, true)).toBeNull();
    expect(requestedPosition(4, 4, true)).toBeNull();
    expect(requestedPosition(2, 4, true)).toBe(2);
    // edited in place: the chosen place is always requested
    expect(requestedPosition(3, 3, false)).toBe(3);
    expect(requestedPosition(1, 3, false)).toBe(1);
  });
});

describe('bannerFormSchema', () => {
  it('accepts a complete form', () => {
    expect(errorsOf(valid())).toEqual({});
  });

  it('requires a title and the PC image', () => {
    const errors = errorsOf(valid({ title: '   ', pcImage: null }));
    expect(errors.title).toBe('제목을 입력해 주세요.');
    expect(errors.pcImage).toBe('PC 이미지를 올려 주세요.');
  });

  it('limits the title length', () => {
    expect(errorsOf(valid({ title: 'ㄱ'.repeat(TITLE_MAX + 1) })).title).toMatch(/100자/);
  });

  it('validates the link (empty is allowed)', () => {
    expect(errorsOf(valid({ linkUrl: '' }))).toEqual({});
    expect(errorsOf(valid({ linkUrl: 'http://insecure.example.com' })).linkUrl).toMatch(
      /https:\/\//,
    );
  });

  it('requires a valid period; the same day is fine', () => {
    expect(errorsOf(valid({ startDate: '2026-12-10', endDate: '2026-12-01' })).endDate).toMatch(
      /종료일/,
    );
    expect(errorsOf(valid({ startDate: '2026-12-10', endDate: '2026-12-10' }))).toEqual({});
    expect(errorsOf(valid({ startDate: '' })).startDate).toMatch(/시작일/);
  });

  it('requires targets for region / complex targeting', () => {
    expect(errorsOf(valid({ targeting: BannerTargeting.REGIONS })).regions).toMatch(/지역/);
    expect(errorsOf(valid({ targeting: BannerTargeting.COMPLEXES })).complexes).toMatch(/단지/);
    expect(
      errorsOf(
        valid({
          targeting: BannerTargeting.REGIONS,
          regions: [{ code: '4615033028', name: '신대지구' }],
        }),
      ),
    ).toEqual({});
  });
});

describe('emptyBannerForm', () => {
  it('starts today (KST), runs 30 days and goes last in the slot', () => {
    const form = emptyBannerForm(BannerSlot.MAP_AD, NOW);
    expect(form).toMatchObject({
      slot: BannerSlot.MAP_AD,
      startDate: '2026-11-24',
      endDate: '2026-12-24',
      position: LAST_POSITION,
      paused: false,
      targeting: BannerTargeting.REGIONS, // the slot's natural targeting
    });
  });

  it('uses the KST day even late in the UTC evening', () => {
    // 2026-11-24 23:30 UTC = 2026-11-25 08:30 KST
    expect(emptyBannerForm(BannerSlot.MAIN_HERO, new Date('2026-11-24T23:30:00Z')).startDate).toBe(
      '2026-11-25',
    );
  });
});

describe('bannerToForm / duplicateToForm', () => {
  it('maps a stored banner to form values', () => {
    expect(bannerToForm(banner())).toMatchObject({
      slot: BannerSlot.MAIN_HERO,
      advertiserName: '늘봄 이사·청소',
      agency: null,
      pcImage: IMAGE,
      mobileImage: null,
      startDate: '2026-12-01',
      endDate: '2026-12-31',
      position: 2,
      regions: [{ code: '4615033028', name: '신대지구' }],
      memo: '',
    });
  });

  it('keeps the linked office', () => {
    const form = bannerToForm(
      banner({ agencyId: ID(5), agency: { id: ID(5), name: '호수공원 공인중개사사무소' } }),
    );
    expect(form.agency).toEqual({ id: ID(5), name: '호수공원 공인중개사사무소' });
  });

  it('falls back to codes / ids when the names are missing', () => {
    const form = bannerToForm(banner({ targetRegions: [] }));
    expect(form.regions).toEqual([{ code: '4615033028', name: '4615033028' }]);
  });

  it('a copy is paused, appended and marked as a copy', () => {
    const copy = duplicateToForm(banner({ memo: '광고주 요청' }));
    expect(copy).toMatchObject({
      title: '순천 이사·입주청소 한 번에 예약 복사본',
      paused: true,
      position: LAST_POSITION,
      memo: '',
    });
    expect(duplicateToForm(banner({ title: 'ㄱ'.repeat(TITLE_MAX) })).title).toHaveLength(
      TITLE_MAX,
    );
  });
});

describe('toBannerInput', () => {
  it('produces a body the shared bannerInputSchema accepts', () => {
    const input = toBannerInput(
      valid({
        targeting: BannerTargeting.REGIONS,
        regions: [{ code: '4615033028', name: '신대지구' }],
        linkUrl: ' https://example.com/x ',
      }),
    );
    expect(input).toMatchObject({
      startAt: '2026-11-24T00:00:00+09:00',
      endAt: '2026-12-24T23:59:59+09:00',
      linkUrl: 'https://example.com/x',
      targetRegionCodes: ['4615033028'],
      targetComplexIds: [],
    });
    expect(bannerInputSchema.safeParse(input).success).toBe(true);
  });

  it('omits empty optionals on create and nulls them on update', () => {
    const created = toBannerInput(valid());
    expect(created.linkUrl).toBeUndefined();
    expect(created.mobileMediaId).toBeUndefined();
    expect(created.memo).toBeUndefined();
    const updated = toBannerInput(valid(), { clear: true });
    expect(updated).toMatchObject({
      linkUrl: null,
      mobileMediaId: null,
      memo: null,
      agencyId: null,
    });
  });

  it('sends the office name with its id', () => {
    const input = toBannerInput(
      valid({ advertiserName: '호수', agency: { id: ID(5), name: '호수공원 공인중개사사무소' } }),
    );
    expect(input).toMatchObject({ agencyId: ID(5), advertiserName: '호수공원 공인중개사사무소' });
  });

  it('drops targets that do not belong to the chosen targeting', () => {
    const input = toBannerInput(
      valid({
        targeting: BannerTargeting.ALL,
        regions: [{ code: '4615033028', name: '신대지구' }],
        complexes: [{ id: ID(7), name: '신대 레이크파크 1단지' }],
      }),
    );
    expect(input.targetRegionCodes).toEqual([]);
    expect(input.targetComplexIds).toEqual([]);
  });

  it('never sends a mobile image for a slot without a mobile placement', () => {
    const input = toBannerInput(
      valid({ slot: BannerSlot.LISTING_SIDE, mobileImage: { ...IMAGE, mediaId: ID(2) } }),
    );
    expect(input.mobileMediaId).toBeUndefined();
  });
});

describe('status control', () => {
  it('reads the segment from paused + start date', () => {
    expect(statusChoiceOf({ paused: true, startDate: '2026-12-01' }, NOW)).toBe('PAUSED');
    expect(statusChoiceOf({ paused: false, startDate: '2026-12-01' }, NOW)).toBe('SCHEDULED');
    expect(statusChoiceOf({ paused: false, startDate: '2026-11-24' }, NOW)).toBe('ACTIVE');
  });

  it('노출 un-pauses and pulls a future start to today', () => {
    expect(
      applyStatusChoice(
        'ACTIVE',
        { paused: true, startDate: '2026-12-01', endDate: '2026-12-31' },
        NOW,
      ),
    ).toEqual({ paused: false, startDate: '2026-11-24', endDate: '2026-12-31' });
  });

  it('노출 extends a period that already ended', () => {
    expect(
      applyStatusChoice(
        'ACTIVE',
        { paused: false, startDate: '2026-10-01', endDate: '2026-11-01' },
        NOW,
      ),
    ).toEqual({ paused: false, startDate: '2026-10-01', endDate: '2026-12-24' });
  });

  it('예약 moves the start to tomorrow and keeps the length of the period', () => {
    expect(
      applyStatusChoice(
        'SCHEDULED',
        { paused: false, startDate: '2026-11-20', endDate: '2026-11-30' },
        NOW,
      ),
    ).toEqual({ paused: false, startDate: '2026-11-25', endDate: '2026-12-05' });
  });

  it('예약 keeps a period that is already in the future', () => {
    const v = { paused: true, startDate: '2026-12-01', endDate: '2026-12-31' };
    expect(applyStatusChoice('SCHEDULED', v, NOW)).toEqual({ ...v, paused: false });
  });

  it('중지 only pauses', () => {
    const v = { paused: false, startDate: '2026-11-01', endDate: '2026-12-01' };
    expect(applyStatusChoice('PAUSED', v, NOW)).toEqual({ ...v, paused: true });
  });
});
