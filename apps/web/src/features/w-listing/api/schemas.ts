import {
  AssetType,
  DealType,
  Direction,
  DirectionBasis,
  FloorClass,
  FloorDisplay,
  ListingOption,
  ListingStatus,
  MAINTENANCE_FEE_KIND_LABEL,
  MaintenanceFeeBillingType,
  MaintenanceFeeKind,
  MoveInType,
  TradeDealType,
  VerificationMethod,
} from '@house/shared';
import { z } from 'zod';
import { statsMonthsOf } from '@/features/w-complex/api/schemas';
import { listingSummarySchema } from '@/lib/api/schemas/listing';

/**
 * Response schemas of the listing-detail page group. `GET /listings/:id` answers the shared
 * `ListingDetail` (listings module); `listingDetailFromWire()` maps it onto the shape the page
 * reads (photo URLs, coordinates inside `property`, verification list, 관리비 항목 labels).
 */

/** Prisma `Decimal` columns may arrive as strings — accept both. */
const decimal = z.coerce.number();
const nullish = <T extends z.ZodType>(schema: T) => schema.nullish();

export const listingPhotoSchema = z.object({
  id: z.string(),
  /** Display-size media URL (`/media/...` or absolute). */
  url: z.string(),
  thumbUrl: nullish(z.string()),
  caption: nullish(z.string()),
  isCover: z.boolean().default(false),
});
export type ListingPhoto = z.infer<typeof listingPhotoSchema>;

/** 공동중개 사무소 + 공인중개사법 표시·광고 명시사항 (명칭, 소재지, 연락처, 등록번호, 대표 성명). */
export const listingAgencySchema = z.object({
  agencyId: z.string(),
  isPrimary: z.boolean().default(false),
  name: z.string(),
  representativeName: z.string(),
  registrationNumber: z.string(),
  phone: z.string(),
  roadAddress: z.string(),
  addressDetail: nullish(z.string()),
  logoUrl: nullish(z.string()),
  /** Short specialty line, e.g. "단지 전문". */
  specialtyTag: nullish(z.string()),
  activeListingCount: nullish(z.number()),
  avgResponseMinutes: nullish(z.number()),
  /** Per-listing contact (ListingAgency.contactName / contactPhone). */
  contactName: nullish(z.string()),
  contactPhone: nullish(z.string()),
});
export type ListingAgency = z.infer<typeof listingAgencySchema>;

export const listingVerificationSchema = z.object({
  method: z.enum(VerificationMethod),
  verifiedAt: z.string(),
  note: nullish(z.string()),
});
export type ListingVerification = z.infer<typeof listingVerificationSchema>;

export const NearbyCategory = {
  SCHOOL: 'SCHOOL',
  PARK: 'PARK',
  MART: 'MART',
  LANDMARK: 'LANDMARK',
  TRANSIT: 'TRANSIT',
  HOSPITAL: 'HOSPITAL',
} as const;
export type NearbyCategory = (typeof NearbyCategory)[keyof typeof NearbyCategory];
export const NEARBY_CATEGORY_LABEL: Record<NearbyCategory, string> = {
  SCHOOL: '학교',
  PARK: '공원',
  MART: '마트',
  LANDMARK: '명소',
  TRANSIT: '교통',
  HOSPITAL: '병원',
};

export const nearbyPlaceSchema = z.object({
  category: z.enum(NearbyCategory),
  name: z.string(),
  /** Straight-line distance in metres. */
  distanceM: z.number(),
  /** "도보 5분", "차로 12분" … */
  note: nullish(z.string()),
  lat: nullish(z.number()),
  lng: nullish(z.number()),
});
export type NearbyPlace = z.infer<typeof nearbyPlaceSchema>;

export const complexAreaTypeSchema = z.object({
  id: z.string(),
  exclusiveArea: decimal,
  supplyArea: nullish(decimal),
  pyeongLabel: nullish(z.string()),
});
export type ComplexAreaType = z.infer<typeof complexAreaTypeSchema>;

export const listingComplexSchema = z.object({
  id: z.string(),
  name: z.string(),
  emdName: nullish(z.string()),
  households: nullish(z.number()),
  builtYear: nullish(z.number()),
  approvalDate: nullish(z.string()),
  parkingPerHousehold: nullish(decimal),
  heatingType: nullish(z.string()),
  /** Average asking price per 평 in 만원 (complex-wide). */
  avgPricePerPyeong: nullish(z.number()),
  areaTypes: z.array(complexAreaTypeSchema).default([]),
  /** Latest 실거래 of this listing's 평형 for the same deal type. */
  latestTrade: nullish(
    z.object({
      price: z.number(),
      dealDate: z.string(),
      floor: nullish(z.number()),
      pyeongLabel: nullish(z.string()),
    }),
  ),
});
export type ListingComplex = z.infer<typeof listingComplexSchema>;

export const listingPropertySchema = z.object({
  roadAddress: z.string(),
  jibunAddress: nullish(z.string()),
  buildingName: nullish(z.string()),
  /** 동 — public. 호 is PRIVATE and never part of this payload. */
  dong: nullish(z.string()),
  emdCode: nullish(z.string()),
  emdName: nullish(z.string()),
  lat: z.number(),
  lng: z.number(),
  /** Null when the broker chose `floorDisplay = CLASS`. */
  floor: nullish(z.number()),
  totalFloors: nullish(z.number()),
  exclusiveArea: nullish(decimal),
  supplyArea: nullish(decimal),
  landArea: nullish(decimal),
  totalFloorArea: nullish(decimal),
  areaTypeId: nullish(z.string()),
  rooms: nullish(z.number()),
  baths: nullish(z.number()),
  direction: nullish(z.enum(Direction)),
  directionBasis: nullish(z.enum(DirectionBasis)),
  approvalDate: nullish(z.string()),
  parkingSpaces: nullish(z.number()),
  heatingType: nullish(z.string()),
  zoning: nullish(z.string()),
  landCategory: nullish(z.string()),
  buildingUse: nullish(z.string()),
});
export type ListingProperty = z.infer<typeof listingPropertySchema>;

const maintenanceFeeViewSchema = z.object({
  billingType: z.enum(MaintenanceFeeBillingType).catch(MaintenanceFeeBillingType.UNKNOWN),
  items: z
    .array(
      z.object({
        kind: z.enum(MaintenanceFeeKind).catch(MaintenanceFeeKind.OTHER),
        included: z.boolean(),
        amountWon: nullish(z.number()),
      }),
    )
    .default([]),
  unavailableReason: nullish(z.string()),
});
export type MaintenanceFeeView = z.infer<typeof maintenanceFeeViewSchema>;

export const listingDetailObjectSchema = z.object({
  id: z.string(),
  /** Human-friendly listing number ("26-0412"); falls back to the id when absent. */
  listingNo: nullish(z.string()),
  status: z.enum(ListingStatus),
  dealType: z.enum(DealType),
  assetType: z.enum(AssetType),
  title: nullish(z.string()),
  description: nullish(z.string()),
  /** Short selling points shown as chips above the description. */
  highlights: z.array(z.string()).default([]),
  salePrice: nullish(z.number()),
  deposit: nullish(z.number()),
  monthlyRent: nullish(z.number()),
  presalePrice: nullish(z.number()),
  premium: nullish(z.number()),
  maintenanceFeeWon: nullish(z.number()),
  /** 관리비 포함 항목 labels ("일반관리비", "수도료") — derived from `maintenanceFee.items`. */
  maintenanceFeeItems: z.array(z.string()).default([]),
  /** Backend 관리비 breakdown (부과방식 + 항목). */
  maintenanceFee: nullish(maintenanceFeeViewSchema),
  moveInType: nullish(z.enum(MoveInType)),
  moveInDate: nullish(z.string()),
  floorDisplay: z.enum(FloorDisplay).default(FloorDisplay.EXACT),
  floorClass: nullish(z.enum(FloorClass)),
  options: z.array(z.enum(ListingOption)).default([]),
  publishedAt: nullish(z.string()),
  updatedAt: nullish(z.string()),
  verifiedAt: nullish(z.string()),
  viewCount: z.number().default(0),
  favoriteCount: z.number().default(0),
  property: listingPropertySchema,
  complex: nullish(listingComplexSchema),
  photos: z.array(listingPhotoSchema).default([]),
  verifications: z.array(listingVerificationSchema).default([]),
  agencies: z.array(listingAgencySchema).default([]),
  nearby: z.array(nearbyPlaceSchema).default([]),
});

type Raw = Record<string, unknown>;
const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null;
const KIND_LABEL = MAINTENANCE_FEE_KIND_LABEL as Record<string, string>;

/** 포함 항목 labels of the backend `maintenanceFee.items` ("일반관리비 7만원", "수도료"). */
export function maintenanceFeeLabels(fee: unknown): string[] {
  if (!isObject(fee) || !Array.isArray(fee.items)) return [];
  return fee.items.flatMap((item: unknown) => {
    if (!isObject(item) || item.included !== true || typeof item.kind !== 'string') return [];
    const label = KIND_LABEL[item.kind] ?? KIND_LABEL.OTHER!;
    const won = typeof item.amountWon === 'number' && item.amountWon > 0 ? item.amountWon : null;
    return [won ? `${label} ${Math.round(won / 10_000).toLocaleString('ko-KR')}만원` : label];
  });
}

/**
 * Backend `ListingDetail` → page shape: `photos[]` (PhotoUrls) → `{ id, url, thumbUrl }`,
 * top-level `lat`/`lng`/`emdCode`/`emdName` copied into `property`, `latestVerification` →
 * `verifications[]`, `maintenanceFee.items` → `maintenanceFeeItems`. Keys already in the page
 * shape pass through unchanged.
 */
export function listingDetailFromWire(value: unknown): unknown {
  if (!isObject(value)) return value;
  const out: Raw = { ...value };
  if (Array.isArray(value.photos)) {
    out.photos = value.photos.map((p: unknown) =>
      isObject(p) && p.url === undefined && typeof p.mediaId === 'string'
        ? {
            id: p.mediaId,
            url: p.largeUrl ?? p.mediumUrl ?? p.thumbUrl,
            thumbUrl: p.thumbUrl ?? null,
            caption: p.caption ?? null,
            isCover: p.isCover === true,
          }
        : p,
    );
  }
  if (isObject(value.property)) {
    const prop: Raw = { ...value.property };
    for (const key of ['lat', 'lng', 'emdCode', 'emdName'] as const) {
      if (prop[key] === undefined && value[key] !== undefined) prop[key] = value[key];
    }
    out.property = prop;
  }
  if (out.verifications === undefined && isObject(value.latestVerification)) {
    out.verifications = [value.latestVerification];
  }
  if (out.maintenanceFeeItems === undefined && isObject(value.maintenanceFee)) {
    out.maintenanceFeeItems = maintenanceFeeLabels(value.maintenanceFee);
  }
  return out;
}

export const listingDetailSchema = z.preprocess(listingDetailFromWire, listingDetailObjectSchema);
export type ListingDetail = z.infer<typeof listingDetailObjectSchema>;

/** Card-sized listing (similar listings) — the shared listing-summary contract. */
export { listingSummarySchema, type ListingSummary } from '@/lib/api/schemas/listing';

export const SimilarGroupKey = {
  SAME_COMPLEX: 'SAME_COMPLEX',
  SAME_AREA: 'SAME_AREA',
  SAME_PRICE: 'SAME_PRICE',
} as const;
export type SimilarGroupKey = (typeof SimilarGroupKey)[keyof typeof SimilarGroupKey];

export const similarListingsSchema = z.object({
  /** "신대지구 · 매매 · 33~41평 · 4억~5억" */
  criteria: nullish(z.string()),
  regionName: nullish(z.string()),
  regionListingCount: nullish(z.number()),
  groups: z
    .array(
      z.object({
        key: z.enum(SimilarGroupKey),
        label: z.string(),
        total: z.number(),
        items: z.array(listingSummarySchema),
      }),
    )
    .default([]),
});
export type SimilarListings = z.infer<typeof similarListingsSchema>;
export const EMPTY_SIMILAR: SimilarListings = { groups: [] };

/**
 * GET /complexes/:id/stats — `ComplexStatsView`; `months` = the selected 평형's series (or the
 * all-평형 trend), see `statsMonthsOf` (w-complex).
 */
export const complexStatsSchema = z.preprocess(
  (v) => (isObject(v) ? { ...v, months: statsMonthsOf(v) } : v),
  z.object({
    dealType: z.enum(TradeDealType),
    areaTypeId: nullish(z.string()),
    months: z
      .array(
        z.object({
          /** YYYYMM */
          yearMonth: z.number(),
          tradeCount: z.number(),
          medianPrice: z.number(),
          minPrice: nullish(z.number()),
          maxPrice: nullish(z.number()),
          avgPrice: nullish(z.number()),
        }),
      )
      .default([]),
  }),
);
export type ComplexStats = z.output<typeof complexStatsSchema>;

/** GET /complexes/:id/trades — paginated TradeRecord rows. */
export const complexTradeSchema = z.object({
  id: z.string(),
  dealType: z.enum(TradeDealType),
  /** YYYY-MM-DD */
  dealDate: z.string(),
  exclusiveArea: nullish(decimal),
  floor: nullish(z.number()),
  price: nullish(z.number()),
  deposit: nullish(z.number()),
  monthlyRent: nullish(z.number()),
  cancelled: z.boolean().default(false),
});
export type ComplexTrade = z.infer<typeof complexTradeSchema>;

export const complexTradesPageSchema = z.object({
  items: z.array(complexTradeSchema),
  page: z.number().default(1),
  pageSize: z.number().default(20),
  total: z.number().default(0),
  totalPages: z.number().default(1),
});
export type ComplexTradesPage = z.infer<typeof complexTradesPageSchema>;

/** GET /banners?slot=… — currently live banners of a slot (the shared ads contract). */
export {
  servedBannerSchema,
  servedBannerListSchema as servedBannersSchema,
  type ServedBanner,
} from '@/lib/ads/schemas';

export const favoriteStateSchema = z
  .object({ favorited: z.boolean(), favoriteCount: z.number().optional() })
  .optional();
