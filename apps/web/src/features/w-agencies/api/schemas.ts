import { AssetType } from '@house/shared';
import { z } from 'zod';
import { listingSummarySchema } from '@/lib/api/schemas/listing';

/**
 * Response shapes of the public agencies API.
 *
 * The backend module (`apps/api/src/modules/agencies`) only has its README + Prisma model so far, so
 * these shapes are ASSUMED from the `Agency` model and the Agents design. Every field the design
 * needs but the model does not have yet is optional/nullable, so the pages degrade gracefully.
 * See docs/frontend-integration/w-agencies.md — fix the schema and the mock fixture together.
 */

const nullish = <T extends z.ZodType>(schema: T) => schema.nullish();

/** `{ mon: { open: "09:00", close: "18:00" }, … }` — a missing / null day is closed (Agency.businessHours). */
export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const dayHoursSchema = z.object({ open: hhmm, close: hhmm });
export type DayHours = z.infer<typeof dayHoursSchema>;

export const businessHoursSchema = z.object({
  mon: nullish(dayHoursSchema),
  tue: nullish(dayHoursSchema),
  wed: nullish(dayHoursSchema),
  thu: nullish(dayHoursSchema),
  fri: nullish(dayHoursSchema),
  sat: nullish(dayHoursSchema),
  sun: nullish(dayHoursSchema),
});
export type BusinessHours = z.infer<typeof businessHoursSchema>;

/** 분양 / 매매 / 전세 / 월세 — active listings by deal type (co-brokered listings count once). */
export const dealCountsSchema = z.object({
  presale: z.number().int().nonnegative(),
  sale: z.number().int().nonnegative(),
  jeonse: z.number().int().nonnegative(),
  monthly: z.number().int().nonnegative(),
});
export type AgencyDealCounts = z.infer<typeof dealCountsSchema>;

/** List / map item of `GET /agencies`. */
export const agencySummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  representativeName: z.string(),
  registrationNumber: z.string(),
  /** 대표번호 (digits or formatted). */
  phone: z.string(),
  roadAddress: z.string(),
  addressDetail: nullish(z.string()),
  emdCode: nullish(z.string()),
  emdName: nullish(z.string()),
  lat: z.number(),
  lng: z.number(),
  specialties: z.array(z.enum(AssetType)).default([]),
  activeListingCount: z.number().int().nonnegative().default(0),
  /** Public logo URL (Agency.logoMediaId). */
  logoUrl: nullish(z.string()),
  /** One-line specialty tag: "연향·조례 아파트 전문" (not in the model yet). */
  tagline: nullish(z.string()),
  /** Complexes this office lists the most — "전문 단지" chips (derived, optional). */
  topComplexes: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
  /** Has at least one active 분양권 listing. */
  handlesPresale: nullish(z.boolean()),
  businessHours: nullish(businessHoursSchema),
});
export type AgencySummary = z.infer<typeof agencySummarySchema>;

export const agencyPageSchema = z.object({
  items: z.array(agencySummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});
export type AgencyPage = z.infer<typeof agencyPageSchema>;

/**
 * Listing card item = one row of `GET /listings?agencyId=` — the shared listing-summary contract
 * (`@/lib/api/schemas/listing`), so one backend serializer feeds the map, home and agency pages.
 */
export {
  listingSummarySchema as agencyListingSchema,
  type ListingSummary as AgencyListing,
} from '@/lib/api/schemas/listing';

export const agencyListingPageSchema = z.object({
  items: z.array(listingSummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});
export type AgencyListingPage = z.infer<typeof agencyListingPageSchema>;

/** `GET /agencies/:id` */
export const agencyDetailSchema = agencySummarySchema.extend({
  mobile: nullish(z.string()),
  jibunAddress: nullish(z.string()),
  intro: nullish(z.string()),
  coverUrl: nullish(z.string()),
  /** 승인일 — "등록 확인" badge is shown for every approved office. */
  approvedAt: nullish(z.string()),
  /** Active listings by deal type. */
  listingCounts: dealCountsSchema.default({ presale: 0, sale: 0, jeonse: 0, monthly: 0 }),
  /** Active listings per asset type (tabs on the agency page). */
  listingCountsByAsset: z
    .partialRecord(z.enum(AssetType), z.number().int().nonnegative())
    .default({}),
  stats: nullish(
    z.object({
      /** 최근 30일 거래 완료 건수. */
      deals30d: nullish(z.number().int().nonnegative()),
      /** 평균 응답 시간 (분). */
      avgResponseMinutes: nullish(z.number().nonnegative()),
    }),
  ),
  /** 대표 매물 (up to 4). */
  featuredListings: z.array(listingSummarySchema).default([]),
  /** 소속 공인중개사 / 중개보조원 (공인중개사법상 표시 대상). */
  members: z
    .array(
      z.object({
        displayName: z.string(),
        title: nullish(z.string()),
        isLicensed: z.boolean().default(false),
        role: nullish(z.enum(['OWNER', 'AGENT'])),
      }),
    )
    .default([]),
});
export type AgencyDetail = z.infer<typeof agencyDetailSchema>;

/** `GET /agencies/regions` — 읍면동 facet for the 지역 filter. */
export const agencyRegionSchema = z.object({
  emdCode: z.string(),
  name: z.string(),
  count: z.number().int().nonnegative(),
  lat: nullish(z.number()),
  lng: nullish(z.number()),
});
export type AgencyRegion = z.infer<typeof agencyRegionSchema>;
export const agencyRegionsSchema = z.object({
  /** All approved offices in the service area. */
  total: z.number().int().nonnegative(),
  items: z.array(agencyRegionSchema),
});
export type AgencyRegions = z.infer<typeof agencyRegionsSchema>;

/** Sort of the office list (query `sort`, assumed). */
export const AGENCY_SORTS = ['LISTINGS', 'RECENT', 'NAME'] as const;
export type AgencySort = (typeof AGENCY_SORTS)[number];
export const AGENCY_SORT_LABEL: Record<AgencySort, string> = {
  LISTINGS: '보유 매물순',
  RECENT: '최근 등록순',
  NAME: '가나다순',
};
