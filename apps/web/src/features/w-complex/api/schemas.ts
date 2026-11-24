import { AssetType, DealType, FloorDisplay, MoveInType, TradeDealType } from '@house/shared';
import { z } from 'zod';
import { listingSummarySchema } from '@/lib/api/schemas/listing';

/**
 * Response schemas of the complexes / listings / banners endpoints used by the complex panel and the
 * /complex/[id] page. The backend controllers do not exist yet (module READMEs + Prisma models only),
 * so field names mirror the Prisma models and every shape is recorded in
 * docs/frontend-integration/w-complex.md — fix the schema and the mock fixture together.
 */

/** Prisma `Decimal` columns may arrive as strings ("84.98") — accept both. */
const decimal = z.coerce.number();
const nullableDecimal = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.coerce.number().nullable(),
);
const nullableInt = z.number().int().nullable().default(null);
const nullableString = z.string().nullable().default(null);

function paginated<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  });
}

// ---- complex ------------------------------------------------------------------------------------

export const complexAreaTypeSchema = z.object({
  id: z.string(),
  /** 전용면적 ㎡ */
  exclusiveArea: decimal,
  /** 공급면적 ㎡ */
  supplyArea: nullableDecimal.default(null),
  /** "84A" */
  typeName: z.string().default(''),
  /** "34평" */
  pyeongLabel: nullableString,
  households: nullableInt,
  rooms: nullableInt,
  baths: nullableInt,
});
export type ComplexAreaType = z.infer<typeof complexAreaTypeSchema>;

export const complexPhotoSchema = z.object({
  id: z.string(),
  url: z.string(),
  caption: nullableString,
});

export const complexDetailSchema = z.object({
  id: z.string(),
  assetType: z.enum(AssetType).default(AssetType.APT),
  name: z.string(),
  roadAddress: nullableString,
  jibunAddress: nullableString,
  sggCode: z.string().default(''),
  emdCode: nullableString,
  /** 법정동명, e.g. "해룡면 신대리". */
  emdName: nullableString,
  /** 생활권 이름 (지구), e.g. "신대지구" — optional display helper. */
  districtName: nullableString,
  lat: z.number(),
  lng: z.number(),
  households: nullableInt,
  buildings: nullableInt,
  floorsMin: nullableInt,
  floorsMax: nullableInt,
  /** 사용승인일 YYYY-MM-DD */
  approvalDate: nullableString,
  builtYear: nullableInt,
  parkingTotal: nullableInt,
  parkingPerHousehold: nullableDecimal.default(null),
  /** 용적률 % */
  floorAreaRatio: nullableDecimal.default(null),
  /** 건폐율 % */
  buildingCoverageRatio: nullableDecimal.default(null),
  heatingType: nullableString,
  builder: nullableString,
  viewCount: z.number().int().default(0),
  favoriteCount: z.number().int().default(0),
  activeListingCount: z.number().int().default(0),
  /** Average 매매 평당가 of the complex in 만원 (optional). */
  avgPricePerPyeong: nullableInt,
  areaTypes: z.array(complexAreaTypeSchema).default([]),
  photos: z.array(complexPhotoSchema).default([]),
});
export type ComplexDetail = z.infer<typeof complexDetailSchema>;

// ---- trades -------------------------------------------------------------------------------------

/** One month of `ComplexTradeStat` (aggregate of one 평형 / deal type). */
export const tradeStatSchema = z.object({
  /** YYYYMM */
  yearMonth: z.number().int(),
  tradeCount: z.number().int(),
  /** SALE: 거래금액 · JEONSE/MONTHLY: 보증금 (만원) */
  medianPrice: z.number().int(),
  minPrice: nullableInt,
  maxPrice: nullableInt,
  avgPrice: nullableInt,
  medianMonthlyRent: nullableInt,
});
export type TradeStat = z.infer<typeof tradeStatSchema>;

export const tradeRecordSchema = z.object({
  id: z.string(),
  areaTypeId: nullableString,
  dealType: z.enum(TradeDealType),
  /** 계약일 YYYY-MM-DD */
  dealDate: z.string(),
  dealYm: z.number().int(),
  exclusiveArea: decimal,
  floor: nullableInt,
  /** 매매 거래금액 (만원) */
  price: nullableInt,
  /** 보증금 (만원) */
  deposit: nullableInt,
  /** 월세 (만원) */
  monthlyRent: nullableInt,
  /** 해제 여부 */
  cancelled: z.boolean().default(false),
  /** 신규 / 갱신 (전월세) */
  contractType: nullableString,
});
export type TradeRecord = z.infer<typeof tradeRecordSchema>;

export const tradePageSchema = paginated(tradeRecordSchema);
export type TradePage = z.infer<typeof tradePageSchema>;

/**
 * `GET /complexes/:id/stats?dealType&areaTypeId&fromYm&toYm` — monthly aggregates of ONE series
 * (same shape as the listing-detail group reads) plus the latest trade per 평형 and deal type.
 */
export const complexStatsSchema = z.object({
  dealType: z.enum(TradeDealType),
  areaTypeId: nullableString,
  months: z.array(tradeStatSchema).default([]),
  /** Latest (non-cancelled) trade of every 평형 × deal type. */
  latest: z.array(tradeRecordSchema).default([]),
});
export type ComplexStats = z.infer<typeof complexStatsSchema>;

// ---- listings -----------------------------------------------------------------------------------

/** One office co-brokering a listing (public disclosure fields only). */
export const listingAgencySchema = z.object({
  agencyId: z.string(),
  name: z.string(),
  /** 대표 개업공인중개사 성명 */
  representativeName: nullableString,
  /** Public office phone. */
  phone: nullableString,
  /** 표시·광고 명시사항 shown in the 문의 dialog: 소재지 and 개설등록번호 (public, optional). */
  roadAddress: nullableString,
  registrationNumber: nullableString,
  logoUrl: nullableString,
  isPrimary: z.boolean().default(false),
  /** Short specialty tag, e.g. "단지 전문". */
  specialtyTag: nullableString,
  /** Active listings of this office in the same complex. */
  complexListingCount: nullableInt,
  /** Average first-response time in minutes. */
  avgResponseMinutes: nullableInt,
  /** This office's 호가 in 만원 (same meaning as the list's headline price). */
  price: nullableInt,
});
export type ListingAgency = z.infer<typeof listingAgencySchema>;

export const complexListingItemSchema = listingSummarySchema.extend({
  /** The complex endpoint only lists apartments, so the asset type may be left out. */
  assetType: z.enum(AssetType).default(AssetType.APT),
  /** Lowest / highest 호가 when co-brokering offices advertise different prices (optional). */
  priceMin: nullableInt,
  priceMax: nullableInt,
  floorDisplay: z.enum(FloorDisplay).default(FloorDisplay.CLASS),
  moveInType: z.enum(MoveInType).nullable().default(null),
  moveInDate: nullableString,
  /** The co-brokering offices (primary first) with their public disclosure fields. */
  agencies: z.array(listingAgencySchema).default([]),
});
export type ComplexListingItem = z.infer<typeof complexListingItemSchema>;

const dealSummarySchema = z.object({
  dealType: z.enum(DealType),
  count: z.number().int(),
  /** Headline price range in 만원 (월세: 보증금). */
  priceMin: nullableInt,
  priceMax: nullableInt,
  /** 월세 only: monthly rent range. */
  rentMin: nullableInt,
  rentMax: nullableInt,
});
export type DealSummary = z.infer<typeof dealSummarySchema>;

/** Active listing summary of the whole complex (not affected by the list filters). */
export const complexListingSummarySchema = z.object({
  total: z.number().int(),
  byDealType: z.array(dealSummarySchema).default([]),
  /** 동 names that currently have listings (for the 동 filter). */
  dongs: z.array(z.string()).default([]),
});
export type ComplexListingSummary = z.infer<typeof complexListingSummarySchema>;

/**
 * `GET /complexes/:id/listings?…filters&sort&page&pageSize` — the complex's active listings
 * (same filter / sort params as `GET /listings`, plus `dong`) and the per-deal-type summary.
 */
export const complexListingsSchema = paginated(complexListingItemSchema).extend({
  summary: complexListingSummarySchema,
});
export type ComplexListings = z.infer<typeof complexListingsSchema>;

/** `GET /complexes/:id/agencies` — offices with active listings in the complex. */
export const complexAgencySchema = z.object({
  agencyId: z.string(),
  name: z.string(),
  representativeName: nullableString,
  phone: nullableString,
  logoUrl: nullableString,
  /** Free-text specialty line, e.g. "레이크파크 단지 전문". */
  specialtyLabel: nullableString,
  /** Active listings of the office in this complex. */
  complexListingCount: z.number().int().default(0),
  avgResponseMinutes: nullableInt,
});
export type ComplexAgency = z.infer<typeof complexAgencySchema>;
export const complexAgenciesSchema = z.object({ items: z.array(complexAgencySchema) });

// ---- nearby -------------------------------------------------------------------------------------

export const nearbyComplexSchema = z.object({
  id: z.string(),
  name: z.string(),
  assetType: z.enum(AssetType).default(AssetType.APT),
  emdName: nullableString,
  lat: z.number(),
  lng: z.number(),
  /** Straight-line distance in metres. */
  distanceM: z.number(),
  households: nullableInt,
  builtYear: nullableInt,
  activeListingCount: z.number().int().default(0),
  dealCounts: z
    .object({
      presale: z.number().int().default(0),
      sale: z.number().int().default(0),
      jeonse: z.number().int().default(0),
      monthly: z.number().int().default(0),
    })
    .default({ presale: 0, sale: 0, jeonse: 0, monthly: 0 }),
  /** Representative 평형 + price (만원) for markers: "34평 4.4억". */
  representative: z
    .object({ pyeongLabel: nullableString, price: nullableInt, dealType: z.enum(DealType) })
    .nullable()
    .default(null),
});
export type NearbyComplex = z.infer<typeof nearbyComplexSchema>;

export const nearbyComplexesSchema = z.object({ items: z.array(nearbyComplexSchema) });

// ---- banners (COMPLEX_FEATURED_AGENCY) ----------------------------------------------------------

/** Served banner — the shared ads contract (`@/lib/ads`, `GET /banners?slot&complexId`). */
export {
  servedBannerSchema as bannerSchema,
  servedBannerListSchema as bannerListSchema,
  type ServedBanner as Banner,
} from '@/lib/ads/schemas';
