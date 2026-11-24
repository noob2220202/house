import { AssetType, DealType, MapResultKind } from '@house/shared';
import { z } from 'zod';
import { pageSchema } from '@/lib/api/schemas/listing';

/**
 * Response schemas of the endpoints used by the map search pages (/map/[assetType]). Query
 * parameters mirror `mapSearchQuerySchema` / `listingListQuerySchema` from @house/shared;
 * `GET /map/search` answers `MapSearchResult` and is mapped by `mapSearchFromWire()`. See
 * docs/frontend-integration/w-map.md.
 */

const nullish = <T extends z.ZodType>(schema: T) => schema.nullish();
/**
 * For fields whose values are ASSUMED (enums that are not in @house/shared yet, optional
 * aggregates): an unexpected value reads as "unknown" instead of failing the whole response — one
 * odd row must never turn the list or the map into an error state.
 */
const lenient = <T extends z.ZodType>(schema: T) => schema.nullish().catch(null);
/** Prisma `Decimal` columns may arrive as strings ("84.98") — accept both. */
const decimal = z.coerce.number();

export {
  LAND_CATEGORY_LABEL,
  LAND_ZONE_LABEL,
  LandCategory,
  LandZone,
  ROOM_TYPE_LABEL,
  RoomType,
  listingPageSchema,
  listingSummarySchema,
  pageSchema,
  type ListingPage,
  type ListingSummary,
} from '@/lib/api/schemas/listing';

// ---- shared pieces ------------------------------------------------------------------------------

export const dealCountsSchema = z.object({
  presale: z.number().int().default(0),
  sale: z.number().int().default(0),
  jeonse: z.number().int().default(0),
  monthly: z.number().int().default(0),
});
export type DealCounts = z.infer<typeof dealCountsSchema>;

const priceRangeSchema = z.object({ min: z.number(), max: z.number() });

// ---- complexes ----------------------------------------------------------------------------------

/**
 * Complex card payload: `GET /complexes/popular`, `GET /complexes?q`, `GET /me/favorites/complexes`
 * and the COMPLEX markers of `GET /map/search` (same fields + marker extras).
 * Field names follow the favourite-complex shape already used by the my-page group.
 */
const complexSummaryObject = z.object({
  id: z.string(),
  name: z.string(),
  assetType: z.enum(AssetType).default(AssetType.APT),
  /** 법정동 ("해룡면 신대리"). */
  emdName: nullish(z.string()),
  /** 생활권 이름 ("신대지구") — optional display helper. */
  districtName: nullish(z.string()),
  lat: nullish(z.number()),
  lng: nullish(z.number()),
  households: nullish(z.number()),
  builtYear: nullish(z.number()),
  /** "2027.03" for complexes that are not completed yet (분양 단지). */
  moveInYm: nullish(z.string()),
  pyeongLabels: z.array(z.string()).default([]),
  /** Active listing price ranges per deal type (만원). */
  salePrice: nullish(priceRangeSchema),
  jeonsePrice: nullish(priceRangeSchema),
  presalePrice: nullish(priceRangeSchema),
  counts: dealCountsSchema.default({ presale: 0, sale: 0, jeonse: 0, monthly: 0 }),
  /** Average asking price per 평 (만원). */
  pricePerPyeong: nullish(z.number()),
  /** Latest 실거래 (매매) of the most traded 평형. */
  latestTrade: nullish(
    z.object({
      price: z.number(),
      /** "34" */
      pyeongLabel: nullish(z.string()),
      /** YYYYMM */
      dealYm: nullish(z.number()),
      /** Difference to the previous trade of the same 평형 (만원). */
      delta: nullish(z.number()),
    }),
  ),
  coverPhotoUrl: nullish(z.string()),
});
export type ComplexSummary = z.infer<typeof complexSummaryObject>;

/**
 * Accepts the backend complex rows (`ComplexSummary`, `PopularComplexItem`, `FavoriteComplexItem`)
 * and the older card names (`dealCounts`, `salePriceMin/Max`, `latestTrade.areaLabel`).
 */
function normalizeComplex(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value;
  let raw = value as Record<string, unknown>;
  // `GET /me/favorites/complexes` rows: { favoritedAt, complex: ComplexSummary }.
  if (typeof raw.complex === 'object' && raw.complex !== null && raw.id === undefined) {
    raw = { ...(raw.complex as Record<string, unknown>), favoritedAt: raw.favoritedAt };
  }
  const out: Record<string, unknown> = { ...raw };
  // `GET /complexes/popular` rows: listingCounts { total, byDealType: Record<DealType, number> }.
  const lc = raw.listingCounts;
  if (out.counts === undefined && typeof lc === 'object' && lc !== null) {
    const by = ((lc as Record<string, unknown>).byDealType ?? {}) as Record<string, unknown>;
    const n = (k: string) => (typeof by[k] === 'number' ? by[k] : 0);
    out.counts = {
      presale: n('PRESALE'),
      sale: n('SALE'),
      jeonse: n('JEONSE'),
      monthly: n('MONTHLY'),
    };
  }
  if (out.counts === undefined && raw.dealCounts !== undefined) out.counts = raw.dealCounts;
  if (
    out.salePrice === undefined &&
    typeof raw.salePriceMin === 'number' &&
    typeof raw.salePriceMax === 'number'
  ) {
    out.salePrice = { min: raw.salePriceMin, max: raw.salePriceMax };
  }
  const trade = raw.latestTrade;
  if (typeof trade === 'object' && trade !== null) {
    const t = trade as Record<string, unknown>;
    if (t.pyeongLabel === undefined && typeof t.areaLabel === 'string') {
      out.latestTrade = { ...t, pyeongLabel: t.areaLabel.replace('평', '') };
    }
  }
  return out;
}
export const complexSummarySchema = z.preprocess(normalizeComplex, complexSummaryObject);

/** `GET /complexes/popular?limit` — accepts a bare array or `{ items }`. */
export const complexListSchema = z
  .union([z.array(complexSummarySchema), z.object({ items: z.array(complexSummarySchema) })])
  .transform((v) => (Array.isArray(v) ? v : v.items));

export const complexPageSchema = pageSchema(complexSummarySchema);

// ---- listings -----------------------------------------------------------------------------------

// ---- map search ---------------------------------------------------------------------------------

export const mapClusterSchema = z.object({
  /** Region code (REGION_CLUSTERS) or grid cell key (GRID_CLUSTERS). */
  id: z.string(),
  /** 읍면동 / 지구 name — only for region clusters. */
  name: nullish(z.string()),
  regionCode: nullish(z.string()),
  lat: z.number(),
  lng: z.number(),
  count: z.number().int(),
});
export type MapCluster = z.infer<typeof mapClusterSchema>;

export const mapComplexMarkerSchema = complexSummaryObject.extend({
  type: z.literal('COMPLEX'),
  lat: z.number(),
  lng: z.number(),
  /** Listings of this complex that match the filters. */
  count: z.number().int(),
  /** Representative 평형 + price for the marker label ("34평 4.4억"). */
  representative: nullish(
    z.object({
      pyeongLabel: nullish(z.string()),
      /** ㎡ (공급) — lets the client print the label in ㎡ too. */
      supplyArea: nullish(decimal),
      price: nullish(z.number()),
      dealType: z.enum(DealType),
    }),
  ),
});
export type MapComplexMarker = z.infer<typeof mapComplexMarkerSchema>;

export const mapListingMarkerSchema = z.object({
  type: z.literal('LISTING'),
  /** Representative listing (cheapest match in the building). */
  id: z.string(),
  lat: z.number(),
  lng: z.number(),
  dealType: z.enum(DealType),
  salePrice: nullish(z.number()),
  deposit: nullish(z.number()),
  monthlyRent: nullish(z.number()),
  presalePrice: nullish(z.number()),
  premium: nullish(z.number()),
  /** Matching listings at this point (same building / parcel). */
  count: z.number().int().default(1),
  title: nullish(z.string()),
});
export type MapListingMarker = z.infer<typeof mapListingMarkerSchema>;

type Raw = Record<string, unknown>;
const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null;
const DEAL_ORDER = [DealType.SALE, DealType.PRESALE, DealType.JEONSE, DealType.MONTHLY] as const;

/** `byDealType[deal]` of the backend marker → `{ min, max }` price range (만원) or null. */
function rangeOf(by: Raw, deal: DealType): { min: number; max: number } | null {
  const s = by[deal];
  if (!isObject(s) || typeof s.priceMin !== 'number' || typeof s.priceMax !== 'number') return null;
  return { min: s.priceMin, max: s.priceMax };
}
const countOf = (by: Raw, deal: DealType): number => {
  const s = by[deal];
  return isObject(s) && typeof s.count === 'number' ? s.count : 0;
};

/** Backend `MapComplexMarker` → the COMPLEX marker the map renders. */
function complexMarkerFromWire(c: Raw): Raw {
  const by = isObject(c.byDealType) ? c.byDealType : {};
  const deal = DEAL_ORDER.find((d) => countOf(by, d) > 0);
  const rep = deal ? rangeOf(by, deal) : null;
  return {
    type: 'COMPLEX',
    id: c.complexId,
    name: c.name,
    assetType: c.assetType,
    lat: c.lat,
    lng: c.lng,
    households: c.households ?? null,
    builtYear: c.builtYear ?? null,
    count: c.count,
    counts: {
      presale: countOf(by, DealType.PRESALE),
      sale: countOf(by, DealType.SALE),
      jeonse: countOf(by, DealType.JEONSE),
      monthly: countOf(by, DealType.MONTHLY),
    },
    salePrice: rangeOf(by, DealType.SALE),
    jeonsePrice: rangeOf(by, DealType.JEONSE),
    presalePrice: rangeOf(by, DealType.PRESALE),
    representative:
      deal && rep ? { pyeongLabel: null, supplyArea: null, price: rep.min, dealType: deal } : null,
  };
}

/**
 * Backend listing markers (one per listing) → one price pill per building: listings at the same
 * point merge into a marker with `count`, represented by the cheapest one.
 */
function listingMarkersFromWire(listings: unknown[]): Raw[] {
  const groups = new Map<string, Raw[]>();
  for (const l of listings) {
    if (!isObject(l) || typeof l.lat !== 'number' || typeof l.lng !== 'number') continue;
    const key = `${l.lat.toFixed(5)},${l.lng.toFixed(5)}`;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }
  return [...groups.values()].map((group) => {
    const price = (l: Raw) => (typeof l.priceSort === 'number' ? l.priceSort : Infinity);
    const rep = [...group].sort((a, b) => price(a) - price(b))[0]!;
    return {
      type: 'LISTING',
      id: rep.id,
      lat: rep.lat,
      lng: rep.lng,
      dealType: rep.dealType,
      salePrice: rep.salePrice ?? null,
      deposit: rep.deposit ?? null,
      monthlyRent: rep.monthlyRent ?? null,
      presalePrice: rep.presalePrice ?? null,
      premium: rep.premium ?? null,
      count: group.length,
      title: null,
    };
  });
}

/**
 * Backend `MapSearchResult` { clusters[key…], complexes[], listings[] } → `{ clusters[id…],
 * markers[] }`. The backend sends no summary aggregates (the pill hides them).
 */
export function mapSearchFromWire(value: unknown): unknown {
  if (!isObject(value) || Array.isArray(value.markers)) return value;
  const clusters = Array.isArray(value.clusters)
    ? (value.clusters as unknown[]).map((c): unknown =>
        isObject(c) && c.id === undefined ? { ...c, id: c.key } : c,
      )
    : [];
  const complexes = Array.isArray(value.complexes) ? value.complexes.filter(isObject) : [];
  const listings: unknown[] = Array.isArray(value.listings) ? value.listings : [];
  return {
    ...value,
    clusters,
    markers: [...complexes.map(complexMarkerFromWire), ...listingMarkersFromWire(listings)],
  };
}

const mapSearchObjectSchema = z.object({
  kind: z.enum(MapResultKind),
  clusters: z.array(mapClusterSchema).default([]),
  markers: z
    .array(z.discriminatedUnion('type', [mapComplexMarkerSchema, mapListingMarkerSchema]))
    .default([]),
  /** Listings matching the filters inside the bbox. */
  total: z.number().int(),
  /** True when the marker list was cut at MAP_MAX_MARKERS. */
  truncated: z.boolean().default(false),
  /** Aggregates for the summary pill. Every field optional — the pill hides what is missing. */
  summary: lenient(
    z.object({
      /** Listings in the bbox for this asset type before the other filters. */
      listingCount: lenient(z.number()),
      complexCount: lenient(z.number()),
      /** 만원 / 평 (매매·분양권 asking prices). */
      avgPricePerPyeong: lenient(z.number()),
      avgDeposit: lenient(z.number()),
      avgMonthlyRent: lenient(z.number()),
    }),
  ),
});
export const mapSearchResponseSchema = z.preprocess(mapSearchFromWire, mapSearchObjectSchema);
export type MapSearchResponse = z.infer<typeof mapSearchObjectSchema>;

// ---- regions ------------------------------------------------------------------------------------

/**
 * `GET /regions` (default parent = the service 시군구) → `RegionView[]` of the complexes module:
 * the city's 읍면동 with a representative point. Entries without coordinates are dropped (the
 * map cannot place them).
 */
export const regionSchema = z.object({
  code: z.string(),
  name: z.string(),
  /** Parent 읍·면 for 리-level entries ("해룡면"); the backend sends `parentCode` only. */
  parentName: nullish(z.string()),
  lat: z.number(),
  lng: z.number(),
});
export type Region = z.infer<typeof regionSchema>;
const regionRowSchema = regionSchema.extend({ lat: nullish(z.number()), lng: nullish(z.number()) });
export const regionListSchema = z
  .union([z.array(regionRowSchema), z.object({ items: z.array(regionRowSchema) })])
  .transform((v): Region[] =>
    (Array.isArray(v) ? v : v.items).flatMap((r) =>
      typeof r.lat === 'number' && typeof r.lng === 'number'
        ? [{ ...r, lat: r.lat, lng: r.lng }]
        : [],
    ),
  );

// ---- banners (MAP_AD) ---------------------------------------------------------------------------

/** Serve shape of `GET /banners?slot=MAP_AD` — the shared served-banner contract (`@/lib/ads`). */
export type { ServedBanner as MapBanner } from '@/lib/ads/schemas';

/** `GET /agencies/:id` — only what the text-type map ad card prints; everything optional. */
export const adAgencySchema = z.object({
  id: z.string(),
  name: z.string(),
  representativeName: nullish(z.string()),
  phone: nullish(z.string()),
  roadAddress: nullish(z.string()),
  emdName: nullish(z.string()),
  tagline: nullish(z.string()),
  activeListingCount: nullish(z.number()),
  stats: nullish(
    z.object({
      /** 최근 30일 거래 완료 건수. */
      deals30d: nullish(z.number()),
      avgResponseMinutes: nullish(z.number()),
    }),
  ),
});
export type AdAgency = z.infer<typeof adAgencySchema>;

/** `GET /search/suggest?q` (assumed by the search page group) — autocomplete of the map search field. */
export const suggestItemSchema = z.object({
  type: z.string(),
  id: z.string(),
  label: z.string(),
  description: nullish(z.string()),
  lat: nullish(z.number()),
  lng: nullish(z.number()),
});
export type SuggestItem = z.infer<typeof suggestItemSchema>;
export const suggestResponseSchema = z.object({ items: z.array(suggestItemSchema).default([]) });

/** `GET /complexes/:id` — only the position is needed to fly to a favourite complex. */
export const complexPositionSchema = z.object({ id: z.string(), lat: z.number(), lng: z.number() });
