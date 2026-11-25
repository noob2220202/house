import { z } from 'zod';
import { MAP_MAX_BBOX_SPAN_DEG, MAP_ZOOM } from '../constants/map';
import { PAGINATION } from '../constants/pagination';
import { normalizeRegionCode, REGION_CODE_PATTERN } from '../constants/region';
import { KR_CONTACT_PHONE_PATTERN, KR_MOBILE_PATTERN, normalizePhone } from '../utils/phone';
import { isSafeLinkUrl } from '../utils/url';

/** Primary keys are UUID (v7, time-ordered). */
export const idSchema = z.uuid({ error: '올바른 ID 형식이 아닙니다.' });
export const idParamSchema = z.object({ id: idSchema });
export type IdParam = z.infer<typeof idParamSchema>;

/** Integer amount in 만원. */
export const manwonSchema = z.int().min(0).max(100_000_000);
/** Area in ㎡ (two decimals). */
export const areaSqmSchema = z.number().positive().max(1_000_000);

export const latSchema = z.number().min(33).max(39);
export const lngSchema = z.number().min(124).max(132);
export const latLngSchema = z.object({ lat: latSchema, lng: lngSchema });

/**
 * 법정동코드 (2/5/8/10 digits), stored form ({@link normalizeRegionCode}): legacy codes of the
 * service region (전라남도 순천시 46150…, e.g. from an old URL or a cached Kakao bcode) are mapped
 * to the current code (12150…), and a 10-digit 읍면동 code ("1215013300") becomes its 8-digit
 * form ("12150133"), so callers may send any of them and only one spelling reaches the database.
 */
export const regionCodeSchema = z
  .string()
  .regex(REGION_CODE_PATTERN, '올바른 지역코드가 아닙니다.')
  .transform(normalizeRegionCode);

/**
 * Korean mobile number (contact field only — never verified, no SMS is ever sent).
 * Accepts "010-1234-5678", "+82 10 1234 5678", … and normalizes to digits "01012345678".
 */
export const phoneSchema = z
  .string()
  .max(30)
  .transform(normalizePhone)
  .pipe(z.string().regex(KR_MOBILE_PATTERN, '올바른 휴대폰 번호가 아닙니다.'));

/** Any Korean contact number: mobile, landline (02/0xx), 050x/070, or 1588-style 대표번호. */
export const contactPhoneSchema = z
  .string()
  .max(30)
  .transform(normalizePhone)
  .pipe(z.string().regex(KR_CONTACT_PHONE_PATTERN, '올바른 전화번호가 아닙니다.'));

export const linkUrlSchema = z
  .string()
  .max(2000)
  .refine(isSafeLinkUrl, '허용되지 않는 링크 주소입니다.');

/** ISO date string (YYYY-MM-DD). */
export const dateOnlySchema = z.iso.date();
/** ISO datetime string with offset, e.g. 2026-01-01T00:00:00+09:00. */
export const dateTimeSchema = z.iso.datetime({ offset: true });

// ---------- query-string helpers (all query values arrive as strings) ----------

/** Upper bound for csv filter lists; every csvArray item is an enum value, so real filters are far smaller. */
export const CSV_ARRAY_MAX = 50;

/** "a,b" or ["a","b"] → ["a","b"], validated by `item`; longer than CSV_ARRAY_MAX is rejected. */
export function csvArray<T extends z.ZodType>(item: T) {
  return z.preprocess(
    (v) => {
      if (v === undefined || v === null || v === '') return undefined;
      const raw = Array.isArray(v) ? v : [v];
      return raw
        .flatMap((x) => String(x).split(','))
        .map((x) => x.trim())
        .filter(Boolean);
    },
    z.array(item).max(CSV_ARRAY_MAX, `최대 ${CSV_ARRAY_MAX}개까지 선택할 수 있습니다.`).optional(),
  );
}

export const queryBoolean = z.preprocess((v) => {
  if (v === 'true' || v === '1' || v === true) return true;
  if (v === 'false' || v === '0' || v === false) return false;
  return v === '' ? undefined : v;
}, z.boolean().optional());

export const queryInt = (min = 0, max = Number.MAX_SAFE_INTEGER) =>
  z.coerce.number().int().min(min).max(max).optional();

export const queryNumber = (min = 0, max = Number.MAX_SAFE_INTEGER) =>
  z.coerce.number().min(min).max(max).optional();

// ---------- pagination ----------

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(PAGINATION.DEFAULT_PAGE),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.MAX_PAGE_SIZE)
    .default(PAGINATION.DEFAULT_PAGE_SIZE),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Cursor pagination for feeds (notifications, logs). Cursor is an opaque string. */
export const cursorQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.MAX_PAGE_SIZE)
    .default(PAGINATION.DEFAULT_PAGE_SIZE),
});
export type CursorQuery = z.infer<typeof cursorQuerySchema>;

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export const sortDirSchema = z.enum(['asc', 'desc']);

// ---------- map ----------

/** bbox as "swLng,swLat,neLng,neLat" (query) — validated and span-limited. */
export const bboxSchema = z
  .string()
  .transform((s, ctx) => {
    const parts = s.split(',').map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
      ctx.addIssue({ code: 'custom', message: 'bbox 형식은 swLng,swLat,neLng,neLat 입니다.' });
      return z.NEVER;
    }
    const [swLng, swLat, neLng, neLat] = parts as [number, number, number, number];
    return { swLng, swLat, neLng, neLat };
  })
  .refine((b) => b.swLng < b.neLng && b.swLat < b.neLat, '잘못된 지도 영역입니다.')
  .refine(
    (b) => b.neLng - b.swLng <= MAP_MAX_BBOX_SPAN_DEG && b.neLat - b.swLat <= MAP_MAX_BBOX_SPAN_DEG,
    '지도 영역이 너무 넓습니다.',
  );
export type Bbox = z.infer<typeof bboxSchema>;

export const zoomSchema = z.coerce.number().min(MAP_ZOOM.MIN).max(MAP_ZOOM.MAX);
