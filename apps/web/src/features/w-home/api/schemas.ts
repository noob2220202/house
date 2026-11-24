import { AssetType } from '@house/shared';
import { z } from 'zod';
import { servedBannerSchema, type ServedBanner } from '@/lib/ads/schemas';
import { listingSummarySchema } from '@/lib/api/schemas/listing';

/**
 * Response schemas of the endpoints the home page reads. Banners, popups, popular complexes,
 * listings, videos, agencies and site settings follow the real controllers (mapped where the
 * names differ); `/home/summary` and `/home/popular-regions` are the frontend's contract the
 * backend implements (docs/frontend-integration/w-home.md). Deliberately lenient (optional /
 * nullable extras, defaults) so a missing field never blanks the home page.
 */

const nullish = <T extends z.ZodType>(schema: T) => schema.nullable().optional();

/** Non-paginated lists may answer with a bare array or `{ items }` — accept both. */
export function listOf<T extends z.ZodType>(item: T) {
  return z
    .union([z.array(item), z.object({ items: z.array(item), updatedAt: nullish(z.string()) })])
    .transform((v) =>
      Array.isArray(v)
        ? { items: v, updatedAt: null }
        : { items: v.items, updatedAt: v.updatedAt ?? null },
    );
}

/** Backend pagination envelope `{ items, page, pageSize, total, totalPages }`. */
export function pageOf<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().default(1),
    pageSize: z.number().default(20),
    total: z.number().default(0),
    totalPages: z.number().default(1),
  });
}

// ---- deal counts (분양 / 매매 / 전세 / 월세) ---------------------------------------------------------

export const dealCountsSchema = z.object({
  presale: z.number().default(0),
  sale: z.number().default(0),
  jeonse: z.number().default(0),
  monthly: z.number().default(0),
});
export type DealCountsDto = z.infer<typeof dealCountsSchema>;
const ZERO_COUNTS: DealCountsDto = { presale: 0, sale: 0, jeonse: 0, monthly: 0 };

// ---- banners & popups (ads module) ---------------------------------------------------------------

/** `GET /banners?slot=` item — the shared served-banner contract (`@/lib/ads`). */
export const bannerSchema = servedBannerSchema;
export type Banner = ServedBanner;
export const bannerListSchema = listOf(bannerSchema);

/**
 * `GET /popups?page=` item (`PublicPopupView`). `updatedAt` is the popup version for "N일 동안
 * 보지 않기"; the backend sends no `updatedAt`, so its `endAt` stands in (a re-scheduled popup shows
 * again).
 */
export const popupSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    imageUrl: z.string(),
    linkUrl: nullish(z.string()),
    newWindow: z.boolean().default(false),
    /** 0 = no "보지 않기" option. */
    dismissDays: z.number().int().min(0).default(1),
    updatedAt: nullish(z.string()),
    endAt: nullish(z.string()),
  })
  .transform(({ endAt, ...p }) => ({ ...p, updatedAt: p.updatedAt ?? endAt ?? null }));
export type Popup = z.infer<typeof popupSchema>;
export const popupListSchema = listOf(popupSchema);

// ---- home aggregates (ASSUMED endpoints) ---------------------------------------------------------

export const homeRegionSchema = z.object({
  code: z.string(),
  /** Display name (지구 or 법정동): "신대지구". */
  name: z.string(),
  emdName: nullish(z.string()),
  lat: z.number(),
  lng: z.number(),
  listingCount: z.number().default(0),
  /** 만원 / 평 */
  avgPricePerPyeong: nullish(z.number()),
});
export type HomeRegion = z.infer<typeof homeRegionSchema>;

/** `GET /home/summary` */
export const homeSummarySchema = z.object({
  regionName: nullish(z.string()),
  listingCount: nullish(z.number()),
  agencyCount: nullish(z.number()),
  verifiedTodayCount: nullish(z.number()),
  /** Active listings keyed by AssetType. */
  assetTypeCounts: z.record(z.string(), z.number()).default({}),
  regions: z.array(homeRegionSchema).default([]),
  updatedAt: nullish(z.string()),
});
export type HomeSummary = z.infer<typeof homeSummarySchema>;

/** `GET /home/popular-regions?assetTypes&limit` item. */
export const popularRegionSchema = homeRegionSchema.extend({
  rank: z.number().optional(),
  /** + moved up, − moved down, 0 flat, null = new entry. */
  rankDelta: nullish(z.number()),
  dealCounts: dealCountsSchema.default(ZERO_COUNTS),
  weeklyViewCount: nullish(z.number()),
});
export type PopularRegion = z.infer<typeof popularRegionSchema>;
export const popularRegionListSchema = listOf(popularRegionSchema);

// ---- complexes ----------------------------------------------------------------------------------

/**
 * Backend `PopularComplexItem` (ComplexSummary + rank, score, listingCounts { total, byDealType })
 * → `dealCounts`. The backend has no rank movement or price columns; those cells stay empty.
 */
function popularFromWire(v: unknown): unknown {
  if (typeof v !== 'object' || v === null) return v;
  const raw = v as Record<string, unknown>;
  const lc = raw.listingCounts as { byDealType?: Record<string, unknown> } | undefined;
  if (raw.dealCounts !== undefined || !lc || typeof lc !== 'object') return v;
  const by = lc.byDealType ?? {};
  const n = (k: string) => (typeof by[k] === 'number' ? by[k] : 0);
  return {
    ...raw,
    dealCounts: {
      presale: n('PRESALE'),
      sale: n('SALE'),
      jeonse: n('JEONSE'),
      monthly: n('MONTHLY'),
    },
  };
}

const popularComplexObjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  assetType: z.enum(AssetType).optional(),
  emdName: nullish(z.string()),
  lat: nullish(z.number()),
  lng: nullish(z.number()),
  households: nullish(z.number()),
  builtYear: nullish(z.number()),
  rank: z.number().optional(),
  rankDelta: nullish(z.number()),
  rankStreakWeeks: nullish(z.number()),
  weeklyViewCount: nullish(z.number()),
  dealCounts: dealCountsSchema.default(ZERO_COUNTS),
  activeListingCount: nullish(z.number()),
  /** 매매 호가 range of the representative 평형 (만원). */
  salePriceMin: nullish(z.number()),
  salePriceMax: nullish(z.number()),
  representativeAreaLabel: nullish(z.string()),
  pricePerPyeong: nullish(z.number()),
  latestTrade: nullish(
    z.object({
      price: z.number(),
      areaLabel: nullish(z.string()),
      /** "분양권" · "분양가" when the reference is not a completed trade. */
      note: nullish(z.string()),
    }),
  ),
});
/** `GET /complexes/popular?limit` item ("사람들이 자주 찾는 단지"). */
export const popularComplexSchema = z.preprocess(popularFromWire, popularComplexObjectSchema);
export type PopularComplex = z.infer<typeof popularComplexObjectSchema>;
export const popularComplexListSchema = listOf(popularComplexSchema);

// ---- listings -----------------------------------------------------------------------------------

/**
 * `GET /listings` item — the shared listing-summary contract (public card fields only, never
 * 호수 or owner contact). Names render through `listingDisplayName()`.
 */
export {
  listingSummarySchema as listingItemSchema,
  type ListingSummary as ListingItem,
} from '@/lib/api/schemas/listing';
export const listingPageSchema = pageOf(listingSummarySchema);
export type ListingPage = z.infer<typeof listingPageSchema>;

// ---- agencies -----------------------------------------------------------------------------------

/** `GET /agencies` item — only what the home strip shows. */
export const agencyItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  representativeName: nullish(z.string()),
  specialties: z.array(z.string()).default([]),
  /** One-line specialty tag ("신대 레이크파크 단지 전문") — optional extra, not in the model yet. */
  tagline: nullish(z.string()),
  activeListingCount: z.number().default(0),
  /**
   * Optional activity stats — same object as the agency detail (`stats`, see w-agencies):
   * deals closed in the last 30 days and the average first-response time in minutes.
   */
  stats: nullish(
    z.object({ deals30d: nullish(z.number()), avgResponseMinutes: nullish(z.number()) }),
  ),
  /** Flat aliases of the two stats (accepted, `stats` wins). */
  recentDealCount: nullish(z.number()),
  avgResponseMinutes: nullish(z.number()),
  logoUrl: nullish(z.string()),
});
export type AgencyItem = z.infer<typeof agencyItemSchema>;

/** The two optional stats of an agency card, whichever way the API sent them. */
export function agencyStats(
  a: Pick<AgencyItem, 'stats' | 'recentDealCount' | 'avgResponseMinutes'>,
): {
  deals30d: number | null;
  avgResponseMinutes: number | null;
} {
  return {
    deals30d: a.stats?.deals30d ?? a.recentDealCount ?? null,
    avgResponseMinutes: a.stats?.avgResponseMinutes ?? a.avgResponseMinutes ?? null,
  };
}
export const agencyPageSchema = pageOf(agencyItemSchema);

// ---- videos (admin module: local_videos) ---------------------------------------------------------

export const videoItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  youtubeUrl: nullish(z.string()),
  youtubeVideoId: nullish(z.string()),
  thumbnailUrl: nullish(z.string()),
  publishedAt: nullish(z.string()),
  /** Optional extras synced from YouTube. */
  durationSeconds: nullish(z.number()),
  viewCount: nullish(z.number()),
  channelName: nullish(z.string()),
});
export type VideoItem = z.infer<typeof videoItemSchema>;
export const videoPageSchema = pageOf(videoItemSchema);

// ---- search suggestions (ASSUMED, owned by w-content) --------------------------------------------

export const suggestionSchema = z.object({
  /** REGION | COMPLEX | AGENCY (unknown types are ignored by the UI). */
  type: z.string(),
  id: z.string(),
  label: z.string(),
  description: nullish(z.string()),
  lat: nullish(z.number()),
  lng: nullish(z.number()),
});
export type Suggestion = z.infer<typeof suggestionSchema>;
export const suggestResponseSchema = z.object({
  items: z.array(suggestionSchema).default([]),
});

// ---- app band (site settings) --------------------------------------------------------------------

/**
 * Keys of `GET /site-settings/public` read by the home page (D9): HOME_LAYOUT (section order +
 * visibility, validated by `resolveHomeLayout`) and APP_LINKS (store links of the app band).
 */
export const appSettingsSchema = z.object({
  HOME_LAYOUT: z.unknown().optional(),
  APP_LINKS: z
    .object({ iosUrl: nullish(z.string()), androidUrl: nullish(z.string()) })
    .nullish()
    .catch(null),
});
