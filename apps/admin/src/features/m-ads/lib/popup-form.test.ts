import {
  POPUP_MAX_DISMISS_DAYS,
  PopupPage,
  popupCreateSchema,
  popupUpdateSchema,
} from '@house/shared';
import { describe, expect, it } from 'vitest';
import { LAST_POSITION } from './banner-form';
import {
  dismissLabel,
  emptyPopupForm,
  popupFormSchema,
  popupPagesLabel,
  togglePopupPage,
  toPopupInput,
  type PopupFormValues,
} from './popup-form';

const NOW = new Date('2026-11-24T03:00:00Z');
const IMAGE = {
  mediaId: '00000000-0000-4000-8000-000000000001',
  url: '/media/popup/a.webp',
  width: 760,
  height: 600,
};
const valid = (patch: Partial<PopupFormValues> = {}): PopupFormValues => ({
  ...emptyPopupForm(NOW),
  title: '허위매물 신고 포상 안내',
  image: IMAGE,
  ...patch,
});
const errorsOf = (values: PopupFormValues) => {
  const parsed = popupFormSchema.safeParse(values);
  return parsed.success
    ? {}
    : Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message]));
};

describe('togglePopupPage', () => {
  it('"전체 페이지" is exclusive', () => {
    expect(togglePopupPage([PopupPage.MAIN, PopupPage.MAP], PopupPage.ALL)).toEqual([
      PopupPage.ALL,
    ]);
    expect(togglePopupPage([PopupPage.ALL], PopupPage.ALL)).toEqual([]);
    expect(togglePopupPage([PopupPage.ALL], PopupPage.MAP)).toEqual([PopupPage.MAP]);
  });

  it('toggles single pages', () => {
    expect(togglePopupPage([PopupPage.MAIN], PopupPage.MAP)).toEqual([
      PopupPage.MAIN,
      PopupPage.MAP,
    ]);
    expect(togglePopupPage([PopupPage.MAIN, PopupPage.MAP], PopupPage.MAIN)).toEqual([
      PopupPage.MAP,
    ]);
  });
});

describe('labels', () => {
  it('lists the pages in a fixed order', () => {
    expect(popupPagesLabel([PopupPage.MAP, PopupPage.MAIN])).toBe('메인 · 지도');
    expect(popupPagesLabel([PopupPage.ALL, PopupPage.MAIN])).toBe('전체 페이지');
    expect(popupPagesLabel([])).toBe('');
  });

  it('words the dismiss option', () => {
    expect(dismissLabel(0)).toBe('');
    expect(dismissLabel(1)).toBe('오늘 하루 보지 않기');
    expect(dismissLabel(7)).toBe('일주일 동안 보지 않기');
    expect(dismissLabel(3)).toBe('3일 동안 보지 않기');
  });
});

describe('popupFormSchema', () => {
  it('accepts the defaults once title and image are set', () => {
    expect(emptyPopupForm(NOW)).toMatchObject({
      targetPages: [PopupPage.MAIN],
      startDate: '2026-11-24',
      endDate: '2026-12-08',
      position: LAST_POSITION,
      dismissDays: 7,
    });
    expect(errorsOf(valid())).toEqual({});
  });

  it('requires title, image and at least one page', () => {
    const errors = errorsOf(valid({ title: '', image: null, targetPages: [] }));
    expect(errors.title).toBeDefined();
    expect(errors.image).toBe('팝업 이미지를 올려 주세요.');
    expect(errors.targetPages).toMatch(/페이지/);
  });

  it('limits the dismiss days to the shared maximum', () => {
    expect(errorsOf(valid({ dismissDays: POPUP_MAX_DISMISS_DAYS }))).toEqual({});
    expect(errorsOf(valid({ dismissDays: POPUP_MAX_DISMISS_DAYS + 1 })).dismissDays).toMatch(
      /최대/,
    );
    expect(errorsOf(valid({ dismissDays: 1.5 })).dismissDays).toBeDefined();
  });

  it('rejects an end before the start', () => {
    expect(
      errorsOf(valid({ startDate: '2026-12-10', endDate: '2026-12-01' })).endDate,
    ).toBeDefined();
  });
});

describe('toPopupInput', () => {
  it('produces a body the shared popupCreateSchema accepts', () => {
    const input = toPopupInput(
      valid({ linkUrl: '/notices', targetPages: [PopupPage.MAIN, PopupPage.MAP] }),
    );
    expect(input).toMatchObject({
      mediaId: IMAGE.mediaId,
      linkUrl: '/notices',
      startAt: '2026-11-24T00:00:00+09:00',
      endAt: '2026-12-08T23:59:59+09:00',
      dismissDays: 7,
    });
    expect(popupCreateSchema.safeParse(input).success).toBe(true);
  });

  it('clears the link on update only', () => {
    expect(toPopupInput(valid()).linkUrl).toBeUndefined();
    expect(toPopupInput(valid(), { clear: true }).linkUrl).toBeNull();
  });

  it('produces an update body the shared popupUpdateSchema accepts', () => {
    expect(popupUpdateSchema.safeParse(toPopupInput(valid(), { clear: true })).success).toBe(true);
  });
});
