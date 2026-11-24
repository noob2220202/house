import {
  BANNER_SLOT_SPECS,
  BannerSlot,
  BannerTargeting,
  isSafeLinkUrl,
  type BannerCreateInput,
} from '@house/shared';
import { z } from 'zod';
import { mediaUrl, type AdminBanner, type Media } from '../api/schemas';
import { addDays, endOfKstDay, isDay, kstToday, startOfKstDay, toKstDay } from './dates';
import { SLOT_META } from './slots';

/**
 * `position` value meaning "after the last item" (new and copied banners / popups, a slot change).
 * The backend appends, so no reorder call is needed, and the order select shows the last place
 * whatever the counts turn out to be once they have loaded.
 */
export const LAST_POSITION = 0;

/** 1-based place shown in the order select for a form `position` in a list of `size` places. */
export function resolvePosition(position: number, size: number): number {
  const places = Math.max(1, size);
  return position >= 1 ? Math.min(position, places) : places;
}

/**
 * Position to request after saving, or `null` to keep the place the backend gave. Items the backend
 * appends (new, copied, moved to another slot) need no follow-up reorder when they should be last.
 */
export function requestedPosition(
  position: number,
  size: number,
  appended: boolean,
): number | null {
  const place = resolvePosition(position, size);
  if (appended && place >= Math.max(1, size)) return null;
  return place;
}

/** An uploaded (or already stored) ad image as the form holds it. */
export interface AdImageValue {
  mediaId: string;
  url: string;
  width: number | null;
  height: number | null;
  /** Only for files picked in this session. */
  fileName?: string;
  bytes?: number;
}

export const TITLE_MAX = 100;

const imageSchema = z.object({
  mediaId: z.string().min(1),
  url: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  fileName: z.string().optional(),
  bytes: z.number().optional(),
});

/** Backslash, whitespace or an ASCII control character anywhere in a link. */
// eslint-disable-next-line no-control-regex -- control characters are exactly what is refused
const UNSAFE_LINK_CHAR = /[\\\s\u0000-\u001f\u007f]/;

/**
 * Link rule of the ads UI: https:// or a site-relative path (stricter than the shared `isSafeLinkUrl`).
 * Backslashes, whitespace and control characters are refused outright: browsers read "/\evil.com"
 * as the protocol-relative "//evil.com", so such a "relative" path would leave the site.
 */
export function isAdLinkUrl(value: string): boolean {
  if (UNSAFE_LINK_CHAR.test(value)) return false;
  if (value.startsWith('/')) return isSafeLinkUrl(value);
  return /^https:\/\//i.test(value) && isSafeLinkUrl(value);
}
export const LINK_URL_MESSAGE =
  'https:// 로 시작하는 주소나 /로 시작하는 사이트 안 경로만 쓸 수 있어요.';

export const linkUrlField = z
  .string()
  .trim()
  .max(2000, '주소가 너무 길어요.')
  .refine((v) => v === '' || isAdLinkUrl(v), LINK_URL_MESSAGE);

export const dayField = (label: string) => z.string().refine(isDay, `${label}을 선택해 주세요.`);

export const bannerFormSchema = z
  .object({
    slot: z.enum(BannerSlot),
    title: z
      .string()
      .trim()
      .min(1, '제목을 입력해 주세요.')
      .max(TITLE_MAX, `제목은 ${TITLE_MAX}자까지 쓸 수 있어요.`),
    advertiserName: z.string().trim().max(100, '광고주 이름은 100자까지 쓸 수 있어요.'),
    agency: z.object({ id: z.string(), name: z.string() }).nullable(),
    pcImage: imageSchema.nullable().refine((v) => v !== null, 'PC 이미지를 올려 주세요.'),
    mobileImage: imageSchema.nullable(),
    linkUrl: linkUrlField,
    newWindow: z.boolean(),
    startDate: dayField('시작일'),
    endDate: dayField('종료일'),
    /** 1-based position inside the slot, or `LAST_POSITION`. */
    position: z.number().int().min(LAST_POSITION),
    targeting: z.enum(BannerTargeting),
    regions: z.array(z.object({ code: z.string(), name: z.string() })).max(100),
    complexes: z.array(z.object({ id: z.string(), name: z.string() })).max(100),
    paused: z.boolean(),
    memo: z.string().max(1000, '메모는 1,000자까지 쓸 수 있어요.'),
    priority: z.number().int().min(0).max(1000),
  })
  .superRefine((v, ctx) => {
    if (isDay(v.startDate) && isDay(v.endDate) && v.endDate < v.startDate)
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: '종료일은 시작일과 같거나 그 이후여야 해요.',
      });
    if (v.targeting === BannerTargeting.REGIONS && v.regions.length === 0)
      ctx.addIssue({
        code: 'custom',
        path: ['regions'],
        message: '노출할 지역을 하나 이상 골라 주세요.',
      });
    if (v.targeting === BannerTargeting.COMPLEXES && v.complexes.length === 0)
      ctx.addIssue({
        code: 'custom',
        path: ['complexes'],
        message: '노출할 단지를 하나 이상 골라 주세요.',
      });
  });

export type BannerFormValues = z.input<typeof bannerFormSchema>;

/** Stored media → form image value. */
export function imageValueOf(media: Media | null | undefined): AdImageValue | null {
  const url = mediaUrl(media);
  if (!media || !url) return null;
  return { mediaId: media.id, url, width: media.width, height: media.height };
}

/** Defaults for a new banner: starts today, runs 30 days, placed last in the slot. */
export function emptyBannerForm(
  slot: BannerSlot = BannerSlot.MAIN_HERO,
  now: Date = new Date(),
): BannerFormValues {
  const today = kstToday(now);
  return {
    slot,
    title: '',
    advertiserName: '',
    agency: null,
    pcImage: null,
    mobileImage: null,
    linkUrl: '',
    newWindow: false,
    startDate: today,
    endDate: addDays(today, 30),
    position: LAST_POSITION,
    targeting: SLOT_META[slot].defaultTargeting,
    regions: [],
    complexes: [],
    paused: false,
    memo: '',
    priority: 0,
  };
}

export function bannerToForm(banner: AdminBanner): BannerFormValues {
  return {
    slot: banner.slot,
    title: banner.title,
    advertiserName: banner.advertiserName ?? '',
    agency:
      banner.agencyId !== null
        ? { id: banner.agencyId, name: banner.agency?.name ?? banner.advertiserName ?? '' }
        : null,
    pcImage: imageValueOf(banner.pcMedia),
    mobileImage: imageValueOf(banner.mobileMedia),
    linkUrl: banner.linkUrl ?? '',
    newWindow: banner.newWindow,
    startDate: toKstDay(banner.startAt),
    endDate: toKstDay(banner.endAt),
    position: banner.sortOrder,
    targeting: banner.targeting,
    regions: banner.targetRegions.length
      ? banner.targetRegions
      : banner.targetRegionCodes.map((code) => ({ code, name: code })),
    complexes: banner.targetComplexes.length
      ? banner.targetComplexes
      : banner.targetComplexIds.map((id) => ({ id, name: '단지' })),
    paused: banner.paused,
    memo: banner.memo ?? '',
    priority: banner.priority,
  };
}

/** Copy of a banner as a new draft: paused (so the slot limit is not hit), appended to the slot. */
export function duplicateToForm(banner: AdminBanner): BannerFormValues {
  const title = `${banner.title} 복사본`;
  return {
    ...bannerToForm(banner),
    title: title.length > TITLE_MAX ? title.slice(0, TITLE_MAX) : title,
    position: LAST_POSITION,
    paused: true,
    memo: '',
  };
}

/**
 * Form values → request body (`bannerCreateSchema`; the PATCH body of `bannerUpdateSchema` uses the same fields). On update (`clear: true`) emptied optional
 * fields are sent as `null` so the backend clears them; on create they are simply omitted.
 */
export function toBannerInput(
  values: BannerFormValues,
  options: { clear?: boolean } = {},
): Record<string, unknown> & Pick<BannerCreateInput, 'slot' | 'title' | 'startAt' | 'endAt'> {
  const blank = options.clear ? null : undefined;
  const hasMobileSlot = BANNER_SLOT_SPECS[values.slot].mobile !== null;
  const advertiserName = values.agency ? values.agency.name : values.advertiserName.trim();
  return {
    slot: values.slot,
    title: values.title.trim(),
    advertiserName: advertiserName || blank,
    agencyId: values.agency?.id ?? blank,
    pcMediaId: values.pcImage?.mediaId ?? '',
    mobileMediaId: (hasMobileSlot ? values.mobileImage?.mediaId : undefined) ?? blank,
    linkUrl: values.linkUrl.trim() || blank,
    newWindow: values.newWindow,
    startAt: startOfKstDay(values.startDate),
    endAt: endOfKstDay(values.endDate),
    paused: values.paused,
    priority: values.priority,
    targeting: values.targeting,
    targetRegionCodes:
      values.targeting === BannerTargeting.REGIONS ? values.regions.map((r) => r.code) : [],
    targetComplexIds:
      values.targeting === BannerTargeting.COMPLEXES ? values.complexes.map((c) => c.id) : [],
    memo: values.memo.trim() || blank,
  };
}

// ---- status control (노출 / 중지 / 예약) -------------------------------------------------------------

export type StatusChoice = 'ACTIVE' | 'PAUSED' | 'SCHEDULED';

/** Which segment is selected for the current schedule (an ended period still reads as 노출/중지). */
export function statusChoiceOf(
  v: { paused: boolean; startDate: string },
  now: Date = new Date(),
): StatusChoice {
  if (v.paused) return 'PAUSED';
  return isDay(v.startDate) && v.startDate > kstToday(now) ? 'SCHEDULED' : 'ACTIVE';
}

/**
 * Status is computed from `paused` + the period, so picking a segment edits those fields:
 * 노출 → un-pause and start today if the start is in the future; 예약 → un-pause and start tomorrow
 * if the start is not in the future (keeping the length of the period); 중지 → pause.
 */
export function applyStatusChoice(
  choice: StatusChoice,
  v: { paused: boolean; startDate: string; endDate: string },
  now: Date = new Date(),
): { paused: boolean; startDate: string; endDate: string } {
  const today = kstToday(now);
  if (choice === 'PAUSED') return { ...v, paused: true };
  if (choice === 'ACTIVE') {
    const startDate = !isDay(v.startDate) || v.startDate > today ? today : v.startDate;
    const endDate = !isDay(v.endDate) || v.endDate < today ? addDays(today, 30) : v.endDate;
    return { paused: false, startDate, endDate };
  }
  if (isDay(v.startDate) && v.startDate > today) return { ...v, paused: false };
  const startDate = addDays(today, 1);
  const length =
    isDay(v.startDate) && isDay(v.endDate) && v.endDate >= v.startDate
      ? Math.round(
          (Date.parse(`${v.endDate}T00:00:00Z`) - Date.parse(`${v.startDate}T00:00:00Z`)) /
            86_400_000,
        )
      : 30;
  const shifted = addDays(startDate, length);
  return {
    paused: false,
    startDate,
    endDate: isDay(v.endDate) && v.endDate >= shifted ? v.endDate : shifted,
  };
}
