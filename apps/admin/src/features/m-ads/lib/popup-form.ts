import { POPUP_MAX_DISMISS_DAYS, PopupPage } from '@house/shared';
import { z } from 'zod';
import type { AdminPopup } from '../api/schemas';
import { dayField, imageValueOf, LAST_POSITION, linkUrlField, TITLE_MAX } from './banner-form';
import { addDays, endOfKstDay, isDay, kstToday, startOfKstDay, toKstDay } from './dates';

export const POPUP_PAGE_LABEL: Record<PopupPage, string> = {
  ALL: '전체 페이지',
  MAIN: '메인',
  MAP: '지도',
  COMPLEX_DETAIL: '단지 상세',
  LISTING_DETAIL: '매물 상세',
  AGENCY_LIST: '중개사무소 찾기',
  DEAL_REQUEST: '내놓기·구하기',
};
export const POPUP_PAGES = Object.values(PopupPage) as PopupPage[];

/** User-site path of a popup target page ("실제 화면" link). */
export const POPUP_PAGE_PATH: Record<PopupPage, string> = {
  ALL: '/',
  MAIN: '/',
  MAP: '/map/apt',
  COMPLEX_DETAIL: '/map/apt',
  LISTING_DETAIL: '/map/apt',
  AGENCY_LIST: '/agencies',
  DEAL_REQUEST: '/deal',
};

/** Toggles a page chip. "전체 페이지" is exclusive; picking a specific page clears it. */
export function togglePopupPage(pages: readonly PopupPage[], page: PopupPage): PopupPage[] {
  if (page === PopupPage.ALL) return pages.includes(PopupPage.ALL) ? [] : [PopupPage.ALL];
  const rest = pages.filter((p) => p !== PopupPage.ALL);
  return rest.includes(page) ? rest.filter((p) => p !== page) : [...rest, page];
}

export function popupPagesLabel(pages: readonly PopupPage[]): string {
  if (pages.includes(PopupPage.ALL)) return POPUP_PAGE_LABEL.ALL;
  return POPUP_PAGES.filter((p) => pages.includes(p))
    .map((p) => POPUP_PAGE_LABEL[p])
    .join(' · ');
}

/** "일주일 동안 보지 않기" wording of the dismiss option (0 = only a 닫기 button). */
export function dismissLabel(days: number): string {
  if (days <= 0) return '';
  if (days === 1) return '오늘 하루 보지 않기';
  if (days === 7) return '일주일 동안 보지 않기';
  return `${days}일 동안 보지 않기`;
}

export const DISMISS_PRESETS = [0, 1, 3, 7, 14, 30] as const;

const imageSchema = z.object({
  mediaId: z.string().min(1),
  url: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  fileName: z.string().optional(),
  bytes: z.number().optional(),
});

export const popupFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, '제목을 입력해 주세요.')
      .max(TITLE_MAX, `제목은 ${TITLE_MAX}자까지 쓸 수 있어요.`),
    image: imageSchema.nullable().refine((v) => v !== null, '팝업 이미지를 올려 주세요.'),
    linkUrl: linkUrlField,
    newWindow: z.boolean(),
    targetPages: z
      .array(z.enum(PopupPage))
      .min(1, '노출할 페이지를 하나 이상 골라 주세요.')
      .max(10),
    startDate: dayField('시작일'),
    endDate: dayField('종료일'),
    /** 1-based position in the popup list, or `LAST_POSITION`. */
    position: z.number().int().min(LAST_POSITION),
    paused: z.boolean(),
    dismissDays: z
      .number({ error: '숫자를 입력해 주세요.' })
      .int('숫자를 입력해 주세요.')
      .min(0)
      .max(POPUP_MAX_DISMISS_DAYS, `최대 ${POPUP_MAX_DISMISS_DAYS}일까지 정할 수 있어요.`),
  })
  .superRefine((v, ctx) => {
    if (isDay(v.startDate) && isDay(v.endDate) && v.endDate < v.startDate)
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: '종료일은 시작일과 같거나 그 이후여야 해요.',
      });
  });
export type PopupFormValues = z.input<typeof popupFormSchema>;

/** Defaults for a new popup: main page, two weeks from today, placed last. */
export function emptyPopupForm(now: Date = new Date()): PopupFormValues {
  const today = kstToday(now);
  return {
    title: '',
    image: null,
    linkUrl: '',
    newWindow: false,
    targetPages: [PopupPage.MAIN],
    startDate: today,
    endDate: addDays(today, 14),
    position: LAST_POSITION,
    paused: false,
    dismissDays: 7,
  };
}

export function popupToForm(popup: AdminPopup): PopupFormValues {
  return {
    title: popup.title,
    image: imageValueOf(popup.media),
    linkUrl: popup.linkUrl ?? '',
    newWindow: popup.newWindow,
    targetPages: popup.targetPages,
    startDate: toKstDay(popup.startAt),
    endDate: toKstDay(popup.endAt),
    position: popup.sortOrder,
    paused: popup.paused,
    dismissDays: popup.dismissDays,
  };
}

export function duplicatePopupToForm(popup: AdminPopup): PopupFormValues {
  const title = `${popup.title} 복사본`;
  return {
    ...popupToForm(popup),
    title: title.length > TITLE_MAX ? title.slice(0, TITLE_MAX) : title,
    position: LAST_POSITION,
    paused: true,
  };
}

/** Form values → request body (`popupInputSchema`); see `toBannerInput` for `clear`. */
export function toPopupInput(
  values: PopupFormValues,
  options: { clear?: boolean } = {},
): Record<string, unknown> {
  return {
    title: values.title.trim(),
    mediaId: values.image?.mediaId ?? '',
    linkUrl: values.linkUrl.trim() || (options.clear ? null : undefined),
    newWindow: values.newWindow,
    targetPages: values.targetPages,
    startAt: startOfKstDay(values.startDate),
    endAt: endOfKstDay(values.endDate),
    paused: values.paused,
    dismissDays: values.dismissDays,
  };
}
