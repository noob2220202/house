// Owned by the listings module team.
import { z } from 'zod';
import { MAX_LISTING_PHOTOS } from '../constants/media';
import { canonicalRegionCode } from '../constants/region';
import {
  AssetType,
  BuildingUse,
  DealType,
  Direction,
  DirectionBasis,
  FloorClass,
  FloorDisplay,
  ListingOption,
  ListingSort,
  ListingStatus,
  MaintenanceFeeBillingType,
  MaintenanceFeeKind,
  MoveInType,
  RecentViewTarget,
  VerificationMethod,
} from '../enums/listing';
import { AGENCY_SETTABLE_STATUSES } from '../listings/rules';
import {
  areaSqmSchema,
  bboxSchema,
  contactPhoneSchema,
  csvArray,
  dateOnlySchema,
  idSchema,
  latSchema,
  lngSchema,
  manwonSchema,
  paginationQuerySchema,
  queryBoolean,
  queryInt,
  queryNumber,
  regionCodeSchema,
  zoomSchema,
} from './common';

/** Deepest offset the public list serves (page × pageSize); deeper browsing should filter. */
export const LISTING_LIST_MAX_OFFSET = 10_000;

// ---------------------------------------------------------------------------------------------
// Search (public map + list)
// ---------------------------------------------------------------------------------------------

/** Filters shared by the map and list search endpoints. Prices in 만원, areas in ㎡. */
export const listingFilterSchema = z.object({
  assetTypes: csvArray(z.enum(AssetType)),
  dealTypes: csvArray(z.enum(DealType)),
  /** 매매가 / 분양가+프리미엄 (applies to 매매·분양권 rows only). */
  priceMin: queryInt(),
  priceMax: queryInt(),
  /** 보증금·전세금 (applies to 전세·월세 rows only). */
  depositMin: queryInt(),
  depositMax: queryInt(),
  /** 월세 (applies to 월세 rows only). */
  rentMin: queryInt(),
  rentMax: queryInt(),
  areaMin: queryNumber(),
  areaMax: queryNumber(),
  roomsMin: queryInt(0, 20),
  bathsMin: queryInt(0, 20),
  directions: csvArray(z.enum(Direction)),
  floorClasses: csvArray(z.enum(FloorClass)),
  builtYearMin: queryInt(1900, 2100),
  builtYearMax: queryInt(1900, 2100),
  /** Listing must have every option given. */
  options: csvArray(z.enum(ListingOption)),
  verifiedOnly: queryBoolean,
  complexId: idSchema.optional(),
  agencyId: idSchema.optional(),
  /** 법정동 code prefix (5 = 시군구, 8 = 읍면동, 10 = full). */
  emdCode: regionCodeSchema.optional(),
});
export type ListingFilter = z.infer<typeof listingFilterSchema>;

const RANGES = [
  ['priceMin', 'priceMax'],
  ['depositMin', 'depositMax'],
  ['rentMin', 'rentMax'],
  ['areaMin', 'areaMax'],
  ['builtYearMin', 'builtYearMax'],
] as const;

function checkRanges(f: ListingFilter, ctx: z.RefinementCtx): void {
  for (const [lo, hi] of RANGES) {
    const a = f[lo];
    const b = f[hi];
    if (a !== undefined && b !== undefined && a > b) {
      ctx.addIssue({ code: 'custom', path: [lo], message: '최솟값이 최댓값보다 큽니다.' });
    }
  }
}

export const mapSearchQuerySchema = listingFilterSchema
  .extend({ bbox: bboxSchema, zoom: zoomSchema })
  .superRefine(checkRanges);
export type MapSearchQuery = z.infer<typeof mapSearchQuerySchema>;

export const listingListQuerySchema = listingFilterSchema
  .extend({
    ...paginationQuerySchema.shape,
    bbox: bboxSchema.optional(),
    sort: z.enum(ListingSort).default(ListingSort.LATEST),
  })
  .superRefine(checkRanges)
  .refine((q) => (q.page - 1) * q.pageSize < LISTING_LIST_MAX_OFFSET, {
    path: ['page'],
    message: '더 이상 페이지를 넘길 수 없습니다. 검색 조건을 좁혀 주세요.',
  });
export type ListingListQuery = z.infer<typeof listingListQuerySchema>;

// ---------------------------------------------------------------------------------------------
// Agency write side
// ---------------------------------------------------------------------------------------------

const text = (max: number) => z.string().trim().min(1).max(max);
const intRange = (min: number, max: number) => z.int().min(min).max(max);

const propertyShape = {
  assetType: z.enum(AssetType),
  complexId: idSchema,
  areaTypeId: idSchema,
  roadAddress: text(200),
  jibunAddress: text(200),
  buildingName: text(100),
  /** 동 — shown publicly. */
  dong: text(20),
  /** 호 — PRIVATE, never returned by public endpoints. */
  ho: text(20),
  /**
   * 10-digit 법정동코드 from the address lookup (Kakao postcode `bcode`); must be inside the
   * service region. A legacy 46150… code is canonicalized to 12150….
   */
  emdCode: z
    .string()
    .regex(/^\d{10}$/, '법정동코드는 10자리 숫자입니다.')
    .transform(canonicalRegionCode),
  lat: latSchema,
  lng: lngSchema,
  /** Negative = basement (B1 = -1); there is no 0층. Must not exceed totalFloors. */
  floor: intRange(-10, 200).refine((v) => v !== 0, '0층은 입력할 수 없습니다.'),
  totalFloors: intRange(1, 200),
  exclusiveArea: areaSqmSchema,
  supplyArea: areaSqmSchema,
  landArea: areaSqmSchema,
  totalFloorArea: areaSqmSchema,
  rooms: intRange(0, 50),
  baths: intRange(0, 50),
  direction: z.enum(Direction),
  directionBasis: z.enum(DirectionBasis),
  /** 사용승인일 */
  approvalDate: dateOnlySchema,
  /** 주차대수 (0 = 주차 불가) */
  parkingSpaces: intRange(0, 100_000),
  heatingType: text(50),
  zoning: text(50),
  landCategory: text(20),
  /** 건축물 용도 (건축물대장, 건축법 시행령 별표1) — 표시·광고의 「중개대상물 종류」. */
  buildingUse: z.enum(BuildingUse),
};
const REQUIRED_PROPERTY_KEYS = ['assetType', 'roadAddress', 'lat', 'lng'] as const;
type PropertyShape = typeof propertyShape;
type PropertyKey = keyof PropertyShape;

/** Everything optional except the keys needed to place the property on the map. */
export const propertyInputSchema = z.object(
  Object.fromEntries(
    (Object.keys(propertyShape) as PropertyKey[]).map((k) => [
      k,
      (REQUIRED_PROPERTY_KEYS as readonly string[]).includes(k)
        ? propertyShape[k]
        : propertyShape[k].optional(),
    ]),
  ) as {
    [K in PropertyKey]: K extends (typeof REQUIRED_PROPERTY_KEYS)[number]
      ? PropertyShape[K]
      : z.ZodOptional<PropertyShape[K]>;
  },
);
export type PropertyInput = z.infer<typeof propertyInputSchema>;

/** PATCH: omitted = unchanged, null = clear (required keys can only be replaced). */
export const propertyUpdateSchema = z.object(
  Object.fromEntries(
    (Object.keys(propertyShape) as PropertyKey[]).map((k) => [
      k,
      (REQUIRED_PROPERTY_KEYS as readonly string[]).includes(k)
        ? propertyShape[k].optional()
        : propertyShape[k].nullable().optional(),
    ]),
  ) as {
    [K in PropertyKey]: K extends (typeof REQUIRED_PROPERTY_KEYS)[number]
      ? z.ZodOptional<PropertyShape[K]>
      : z.ZodOptional<z.ZodNullable<PropertyShape[K]>>;
  },
);
export type PropertyUpdateInput = z.infer<typeof propertyUpdateSchema>;

/**
 * The acting agency's contact person for this listing (shown publicly). 공인중개사법 제18조의2①
 * forbids showing a 중개보조원 in an ad, so the contact is always a licensed member (개업·소속
 * 공인중개사) of the agency; the name comes from that member, never from free text.
 */
export const listingContactSchema = z.object({
  /** AgencyMember id of a licensed contact person of the acting agency. */
  contactMemberId: idSchema.optional(),
  /** Overrides the member's phone (allowed only when the acting member is licensed). */
  contactPhone: contactPhoneSchema.optional(),
});
export type ListingContactInput = z.infer<typeof listingContactSchema>;

/**
 * 관리비 세부내역 (「중개대상물의 표시·광고 명시사항 세부기준」). Each kind appears at most once;
 * `included` = part of the monthly 관리비, `amountWon` = that item's monthly amount (원).
 */
export const maintenanceFeeItemSchema = z.object({
  kind: z.enum(MaintenanceFeeKind),
  included: z.boolean(),
  amountWon: z.int().min(0).max(100_000_000).nullable().optional(),
});
export type MaintenanceFeeItem = z.infer<typeof maintenanceFeeItemSchema>;

export const maintenanceFeeSchema = z
  .object({
    billingType: z.enum(MaintenanceFeeBillingType),
    items: z
      .array(maintenanceFeeItemSchema)
      .max(Object.keys(MaintenanceFeeKind).length)
      .refine((items) => new Set(items.map((i) => i.kind)).size === items.length, {
        message: '같은 관리비 항목이 중복되었습니다.',
      })
      .default([]),
    /** Why the breakdown cannot be shown (e.g. 임대인 미고지) — the rule allows stating that instead. */
    unavailableReason: text(200).nullable().optional(),
  })
  .refine((v) => v.billingType !== MaintenanceFeeBillingType.UNKNOWN || !!v.unavailableReason, {
    path: ['unavailableReason'],
    message: '관리비를 확인할 수 없는 사유를 입력해 주세요.',
  });
export type MaintenanceFee = z.infer<typeof maintenanceFeeSchema>;

const listingShape = {
  dealType: z.enum(DealType),
  title: text(80),
  description: text(5000),
  salePrice: manwonSchema,
  deposit: manwonSchema,
  monthlyRent: manwonSchema,
  presalePrice: manwonSchema,
  /** 프리미엄 (만원, 마이너스 프리미엄 가능) */
  premium: z.int().min(-10_000_000).max(10_000_000),
  /** 관리비 (원/월, 0 = 없음) */
  maintenanceFeeWon: z.int().min(0).max(100_000_000),
  /** 관리비 부과방식 + 항목별 내역. */
  maintenanceFee: maintenanceFeeSchema,
  moveInType: z.enum(MoveInType),
  moveInDate: dateOnlySchema,
  floorDisplay: z.enum(FloorDisplay),
  options: z.array(z.enum(ListingOption)).max(50),
};
type ListingShape = typeof listingShape;
type ListingKey = keyof ListingShape;

const moveInRefine = (v: { moveInType?: string | null; moveInDate?: string | null }) =>
  v.moveInType !== MoveInType.DATE || (v.moveInDate !== undefined && v.moveInDate !== null);
const MOVE_IN_ISSUE = { path: ['moveInDate'], message: '입주가능일을 입력해 주세요.' };

/** 해당 층 ≤ 총 층수 (basements are always valid). The update path re-checks the merged state. */
export function floorWithinBuilding(
  floor: number | null | undefined,
  totalFloors: number | null | undefined,
): boolean {
  return floor === null || floor === undefined || !totalFloors || floor <= totalFloors;
}
const FLOOR_ISSUE = { path: ['property', 'floor'], message: '해당 층이 총 층수보다 큽니다.' };

/** Draft input is permissive; the publish validator enforces 표시·광고 명시사항. */
export const listingDraftSchema = z
  .object({
    ...(Object.fromEntries(
      (Object.keys(listingShape) as ListingKey[])
        .filter((k) => k !== 'dealType')
        .map((k) => [k, listingShape[k].optional()]),
    ) as { [K in Exclude<ListingKey, 'dealType'>]: z.ZodOptional<ListingShape[K]> }),
    dealType: listingShape.dealType,
    floorDisplay: listingShape.floorDisplay.default(FloorDisplay.EXACT),
    options: listingShape.options.default([]),
    property: propertyInputSchema,
    contact: listingContactSchema.optional(),
  })
  .refine(moveInRefine, MOVE_IN_ISSUE)
  .refine((v) => floorWithinBuilding(v.property.floor, v.property.totalFloors), FLOOR_ISSUE);
export type ListingDraftInput = z.infer<typeof listingDraftSchema>;

/** PATCH /agency/listings/:id — omitted = unchanged, null = clear. */
export const listingUpdateSchema = z
  .object({
    ...(Object.fromEntries(
      (Object.keys(listingShape) as ListingKey[]).map((k) => [
        k,
        k === 'dealType' || k === 'floorDisplay' || k === 'options'
          ? listingShape[k].optional()
          : listingShape[k].nullable().optional(),
      ]),
    ) as {
      [K in ListingKey]: K extends 'dealType' | 'floorDisplay' | 'options'
        ? z.ZodOptional<ListingShape[K]>
        : z.ZodOptional<z.ZodNullable<ListingShape[K]>>;
    }),
    property: propertyUpdateSchema.optional(),
    contact: listingContactSchema.optional(),
    /** Optimistic concurrency: the `version` the client edited; a newer row answers 409. */
    version: z.int().min(0).optional(),
  })
  .refine(({ version: _version, ...v }) => Object.values(v).some((x) => x !== undefined), {
    message: '변경할 항목이 없습니다.',
  })
  .refine((v) => floorWithinBuilding(v.property?.floor, v.property?.totalFloors), FLOOR_ISSUE);
export type ListingUpdateInput = z.infer<typeof listingUpdateSchema>;

export const listingStatusChangeSchema = z.object({
  status: z.enum(AGENCY_SETTABLE_STATUSES),
});
export type ListingStatusChangeInput = z.infer<typeof listingStatusChangeSchema>;

export const listingVerificationSchema = z.object({
  method: z.enum(VerificationMethod),
  /** 확인일 (YYYY-MM-DD, not in the future). */
  verifiedAt: dateOnlySchema,
  note: text(500).optional(),
});
export type ListingVerificationInput = z.infer<typeof listingVerificationSchema>;

/** PUT /agency/listings/:id/photos — the full ordered set (array order = display order). */
export const listingPhotosSchema = z
  .object({
    photos: z
      .array(z.object({ mediaId: idSchema, caption: text(100).optional() }))
      .max(MAX_LISTING_PHOTOS, `사진은 최대 ${MAX_LISTING_PHOTOS}장까지 등록할 수 있습니다.`),
    /** Defaults to the first photo. */
    coverMediaId: idSchema.optional(),
  })
  .refine((v) => new Set(v.photos.map((p) => p.mediaId)).size === v.photos.length, {
    path: ['photos'],
    message: '같은 사진이 중복되었습니다.',
  })
  .refine((v) => !v.coverMediaId || v.photos.some((p) => p.mediaId === v.coverMediaId), {
    path: ['coverMediaId'],
    message: '대표 사진은 등록된 사진 중에서 선택해 주세요.',
  });
export type ListingPhotosInput = z.infer<typeof listingPhotosSchema>;

/** POST /agency/listings/:id/co-brokers — the acting agency joins as a co-broker. */
export const coBrokerJoinSchema = listingContactSchema;
export type CoBrokerJoinInput = z.infer<typeof coBrokerJoinSchema>;

export const coBrokerParamSchema = z.object({ id: idSchema, agencyId: idSchema });

export const agencyListingListQuerySchema = z.object({
  ...paginationQuerySchema.shape,
  statuses: csvArray(z.enum(ListingStatus)),
  dealTypes: csvArray(z.enum(DealType)),
  /** true = only listings where the acting agency is the primary (대표) agency. */
  primaryOnly: queryBoolean,
});
export type AgencyListingListQuery = z.infer<typeof agencyListingListQuerySchema>;

export const recentViewsQuerySchema = z.object({
  ...paginationQuerySchema.shape,
  targetType: z.enum(RecentViewTarget).default(RecentViewTarget.LISTING),
});
export type RecentViewsQuery = z.infer<typeof recentViewsQuerySchema>;

export const recentViewsClearQuerySchema = z.object({
  targetType: z.enum(RecentViewTarget).optional(),
});
export type RecentViewsClearQuery = z.infer<typeof recentViewsClearQuerySchema>;
