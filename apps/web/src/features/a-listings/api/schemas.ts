import {
  AssetType,
  BuildingUse,
  DealType,
  Direction,
  DirectionBasis,
  FloorClass,
  FloorDisplay,
  ListingOption,
  ListingStatus,
  MaintenanceFeeBillingType,
  MaintenanceFeeKind,
  MoveInType,
  VerificationMethod,
} from '@house/shared';
import { z } from 'zod';

/*
 * Response shapes of the broker-side listings API (`/api/v1/agency/listings/**`) as the console
 * consumes them. The backend answers with `AgencyListingDetail` / `ListingSummary`
 * (packages/shared/src/listings/types.ts); `preprocess` maps those onto the console's view (photo
 * URLs, `isPrimaryAgency`, the 읍면동 name …) so the components keep one stable shape. The mock
 * fixtures follow the backend shape.
 */

type Raw = Record<string, unknown>;
const isRecord = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const strOf = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/** Prisma `Decimal` columns may arrive as strings ("84.98") — accept both. */
const decimal = z.coerce.number();

function paginated<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  });
}

// ---- editor payload -------------------------------------------------------------------------------

/** Backend `PhotoUrls` (`thumbUrl` / `mediumUrl` / `largeUrl`) → `{ url, thumbUrl }`. */
function photoInput(v: unknown): unknown {
  if (!isRecord(v) || typeof v.url === 'string') return v;
  return { ...v, url: strOf(v.mediumUrl) ?? strOf(v.largeUrl) ?? strOf(v.thumbUrl) ?? '' };
}

export const agencyListingPhotoSchema = z.preprocess(
  photoInput,
  z.object({
    /** ListingPhoto id (absent for photos that were just uploaded and not saved yet). */
    id: z.string().nullish(),
    mediaId: z.string(),
    /** Display-size media URL. */
    url: z.string(),
    thumbUrl: z.string().nullish(),
    caption: z.string().nullish(),
    isCover: z.boolean().default(false),
  }),
);
export type AgencyListingPhoto = z.infer<typeof agencyListingPhotoSchema>;

export const agencyListingVerificationSchema = z.object({
  id: z.string(),
  method: z.enum(VerificationMethod),
  /** ISO datetime or YYYY-MM-DD. */
  verifiedAt: z.string(),
  note: z.string().nullish(),
  /** Member who recorded it (display only). */
  verifiedByName: z.string().nullish(),
  /** Recorded by the operator (admin) instead of the office. */
  byAdmin: z.boolean().nullish(),
});
export type AgencyListingVerification = z.infer<typeof agencyListingVerificationSchema>;

/** Co-brokering office incl. the 표시·광고 명시사항 of the office (명칭·소재지·연락처·등록번호·대표). */
export const agencyListingAgencySchema = z.object({
  agencyId: z.string(),
  isPrimary: z.boolean().default(false),
  name: z.string(),
  representativeName: z.string(),
  registrationNumber: z.string(),
  phone: z.string(),
  roadAddress: z.string(),
  addressDetail: z.string().nullish(),
  logoUrl: z.string().nullish(),
  contactName: z.string().nullish(),
  contactPhone: z.string().nullish(),
  joinedAt: z.string().nullish(),
  /** ListingAgency status (ACTIVE, PENDING co-broker request …). */
  status: z.string().nullish(),
});
export type AgencyListingAgency = z.infer<typeof agencyListingAgencySchema>;

export const agencyListingPropertySchema = z.object({
  assetType: z.enum(AssetType),
  complexId: z.string().nullish(),
  areaTypeId: z.string().nullish(),
  roadAddress: z.string(),
  jibunAddress: z.string().nullish(),
  buildingName: z.string().nullish(),
  dong: z.string().nullish(),
  /** 호 — PRIVATE: only this members-only endpoint returns it. */
  ho: z.string().nullish(),
  emdCode: z.string().nullish(),
  emdName: z.string().nullish(),
  lat: z.number(),
  lng: z.number(),
  floor: z.number().nullish(),
  totalFloors: z.number().nullish(),
  exclusiveArea: decimal.nullish(),
  supplyArea: decimal.nullish(),
  landArea: decimal.nullish(),
  totalFloorArea: decimal.nullish(),
  rooms: z.number().nullish(),
  baths: z.number().nullish(),
  direction: z.enum(Direction).nullish(),
  directionBasis: z.enum(DirectionBasis).nullish(),
  approvalDate: z.string().nullish(),
  parkingSpaces: z.number().nullish(),
  /** 건축물 용도 (건축물대장) — the 「중개대상물 종류」 of the ad; implied for 아파트·오피스텔. */
  buildingUse: z.enum(BuildingUse).nullish(),
});
export type AgencyListingProperty = z.infer<typeof agencyListingPropertySchema>;

/** 관리비 부과방식 + 항목별 내역 (shared `maintenanceFeeSchema`, read leniently). */
export const maintenanceFeeViewSchema = z.object({
  billingType: z.enum(MaintenanceFeeBillingType),
  items: z
    .array(
      z.object({
        kind: z.enum(MaintenanceFeeKind),
        included: z.boolean(),
        amountWon: z.number().nullish(),
      }),
    )
    .default([]),
  unavailableReason: z.string().nullish(),
});
export type MaintenanceFeeView = z.infer<typeof maintenanceFeeViewSchema>;

/**
 * Backend `AgencyListingDetail` → console view: `isPrimaryAgency` → `isPrimary`, the summary's
 * `emdName` onto the property, `latestVerification.verifiedAt` → `verifiedAt`.
 */
function listingInput(v: unknown): unknown {
  if (!isRecord(v)) return v;
  const out: Raw = { ...v };
  if (typeof v.isPrimaryAgency === 'boolean' && v.isPrimary === undefined) {
    out.isPrimary = v.isPrimaryAgency;
  }
  if (isRecord(v.property) && v.property.emdName === undefined && v.emdName !== undefined) {
    out.property = { ...v.property, emdName: v.emdName };
  }
  if (v.verifiedAt === undefined && isRecord(v.latestVerification)) {
    out.verifiedAt = v.latestVerification.verifiedAt;
  }
  return out;
}

/** GET /agency/listings/:id (and the response of POST / PATCH / publish / status …). */
export const agencyListingSchema = z.preprocess(
  listingInput,
  z.object({
    id: z.string(),
    /** Human-friendly number ("26-0412"). */
    listingNo: z.string().nullish(),
    status: z.enum(ListingStatus),
    dealType: z.enum(DealType),
    title: z.string().nullish(),
    description: z.string().nullish(),
    salePrice: z.number().nullish(),
    deposit: z.number().nullish(),
    monthlyRent: z.number().nullish(),
    presalePrice: z.number().nullish(),
    premium: z.number().nullish(),
    maintenanceFeeWon: z.number().nullish(),
    maintenanceFee: maintenanceFeeViewSchema.nullish(),
    moveInType: z.enum(MoveInType).nullish(),
    moveInDate: z.string().nullish(),
    floorDisplay: z.enum(FloorDisplay).default(FloorDisplay.EXACT),
    options: z.array(z.enum(ListingOption)).default([]),
    publishedAt: z.string().nullish(),
    expiresAt: z.string().nullish(),
    closedAt: z.string().nullish(),
    /** Set when the listing was hidden by the operator (report / policy) — the broker cannot re-open it. */
    hiddenReason: z.string().nullish(),
    verifiedAt: z.string().nullish(),
    /** Date by which the 실매물 확인 must be renewed. */
    verificationDueAt: z.string().nullish(),
    viewCount: z.number().default(0),
    favoriteCount: z.number().default(0),
    inquiryCount: z.number().default(0),
    createdAt: z.string().nullish(),
    updatedAt: z.string().nullish(),
    /** True when the caller's agency is the primary (최초 등록) office. */
    isPrimary: z.boolean().default(true),
    property: agencyListingPropertySchema,
    complex: z
      .object({ id: z.string(), name: z.string(), emdName: z.string().nullish() })
      .nullish(),
    photos: z.array(agencyListingPhotoSchema).default([]),
    verifications: z.array(agencyListingVerificationSchema).default([]),
    agencies: z.array(agencyListingAgencySchema).default([]),
    /** Optimistic-concurrency token; sent back as `version` on PATCH. */
    version: z.number().int().nullish(),
  }),
);
export type AgencyListing = z.infer<typeof agencyListingSchema>;

/** PUT /agency/listings/:id/photos → the saved, ordered photos (`PhotoUrls[]`). */
export const listingPhotoListSchema = z.array(agencyListingPhotoSchema);

// ---- table rows -----------------------------------------------------------------------------------

/**
 * Backend `ListingSummary` → console row: name from the complex / building / address,
 * `coverPhoto.thumbUrl`, the primary office's name. Rows the console mock builds already have the
 * console fields and pass through unchanged.
 */
function listingItemInput(v: unknown): unknown {
  if (!isRecord(v) || typeof v.name === 'string') return v;
  const complex = isRecord(v.complex) ? v.complex : null;
  const cover = isRecord(v.coverPhoto) ? v.coverPhoto : null;
  const primary = isRecord(v.primaryAgency) ? v.primaryAgency : null;
  return {
    ...v,
    name:
      strOf(complex?.name) ??
      strOf(v.buildingName) ??
      strOf(v.roadAddress)?.replace(/^(전라남도|전남광주통합특별시)\s*/, '') ??
      '',
    coverPhotoUrl: strOf(cover?.thumbUrl) ?? strOf(cover?.mediumUrl),
    primaryAgencyName: strOf(primary?.name),
    primaryAgencyId: strOf(primary?.id),
  };
}

/** Row of GET /agency/listings. */
export const agencyListingItemSchema = z.preprocess(
  listingItemInput,
  z.object({
    id: z.string(),
    listingNo: z.string().nullish(),
    status: z.enum(ListingStatus),
    dealType: z.enum(DealType),
    assetType: z.enum(AssetType),
    /** Complex / building name, or the address for land. */
    name: z.string(),
    dong: z.string().nullish(),
    /** 호 — members only. */
    ho: z.string().nullish(),
    title: z.string().nullish(),
    salePrice: z.number().nullish(),
    deposit: z.number().nullish(),
    monthlyRent: z.number().nullish(),
    presalePrice: z.number().nullish(),
    premium: z.number().nullish(),
    exclusiveArea: decimal.nullish(),
    supplyArea: decimal.nullish(),
    landArea: decimal.nullish(),
    floor: z.number().nullish(),
    totalFloors: z.number().nullish(),
    floorClass: z.enum(FloorClass).nullish(),
    direction: z.enum(Direction).nullish(),
    coverPhotoUrl: z.string().nullish(),
    photoCount: z.number().default(0),
    verifiedAt: z.string().nullish(),
    verificationDueAt: z.string().nullish(),
    publishedAt: z.string().nullish(),
    expiresAt: z.string().nullish(),
    updatedAt: z.string().nullish(),
    hiddenReason: z.string().nullish(),
    viewCount: z.number().default(0),
    favoriteCount: z.number().default(0),
    inquiryCount: z.number().default(0),
    /** Number of ACTIVE co-brokering offices (incl. the caller's). */
    agencyCount: z.number().default(1),
    isPrimary: z.boolean().default(true),
    /** Name of the primary office when the caller only co-brokers. */
    primaryAgencyName: z.string().nullish(),
    /** Primary office id (real API); `markPrimary` derives `isPrimary` from it. */
    primaryAgencyId: z.string().nullish(),
    /** DRAFT only: number of 명시사항 still missing. */
    missingCount: z.number().nullish(),
  }),
);
export type AgencyListingItem = z.infer<typeof agencyListingItemSchema>;

export const agencyListingPageSchema = paginated(agencyListingItemSchema);
export type AgencyListingPage = z.infer<typeof agencyListingPageSchema>;

/** GET /agency/listings/summary — counters for the status tabs and reminder chips. */
export const agencyListingSummarySchema = z.object({
  total: z.number(),
  byStatus: z.object({
    DRAFT: z.number().default(0),
    ACTIVE: z.number().default(0),
    RESERVED: z.number().default(0),
    CLOSED: z.number().default(0),
    HIDDEN: z.number().default(0),
  }),
  verificationDue: z.number().default(0),
  expiringSoon: z.number().default(0),
  coBrokered: z.number().default(0),
});
export type AgencyListingSummary = z.infer<typeof agencyListingSummarySchema>;

// ---- co-brokerage ---------------------------------------------------------------------------------

/** Row of GET /agency/listings/co-broker-candidates — another office's public listing. */
export const coBrokerCandidateSchema = z.object({
  id: z.string(),
  listingNo: z.string().nullish(),
  status: z.enum(ListingStatus),
  dealType: z.enum(DealType),
  assetType: z.enum(AssetType),
  name: z.string(),
  dong: z.string().nullish(),
  salePrice: z.number().nullish(),
  deposit: z.number().nullish(),
  monthlyRent: z.number().nullish(),
  presalePrice: z.number().nullish(),
  premium: z.number().nullish(),
  exclusiveArea: decimal.nullish(),
  supplyArea: decimal.nullish(),
  floor: z.number().nullish(),
  totalFloors: z.number().nullish(),
  floorClass: z.enum(FloorClass).nullish(),
  direction: z.enum(Direction).nullish(),
  coverPhotoUrl: z.string().nullish(),
  verifiedAt: z.string().nullish(),
  publishedAt: z.string().nullish(),
  agencyCount: z.number().default(1),
  primaryAgencyName: z.string(),
  /** True when the caller's agency already co-brokers this listing. */
  joined: z.boolean().default(false),
});
export type CoBrokerCandidate = z.infer<typeof coBrokerCandidateSchema>;

export const coBrokerCandidatePageSchema = paginated(coBrokerCandidateSchema);

// ---- complexes ------------------------------------------------------------------------------------

export const complexAreaTypeSchema = z.object({
  id: z.string(),
  exclusiveArea: decimal,
  supplyArea: decimal.nullish(),
  typeName: z.string().nullish(),
  pyeongLabel: z.string().nullish(),
  rooms: z.number().nullish(),
  baths: z.number().nullish(),
});
export type ComplexAreaType = z.infer<typeof complexAreaTypeSchema>;

/** Row of GET /complexes?q= (search) — only what the picker shows. */
export const complexSearchItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  roadAddress: z.string().nullish(),
  emdName: z.string().nullish(),
  households: z.number().nullish(),
  builtYear: z.number().nullish(),
  emdCode: z.string().nullish(),
});
export type ComplexSearchItem = z.infer<typeof complexSearchItemSchema>;
export const complexSearchPageSchema = paginated(complexSearchItemSchema);

/** GET /complexes/:id — the fields the wizard pre-fills from. */
export const complexForListingSchema = z.object({
  id: z.string(),
  assetType: z.enum(AssetType).default(AssetType.APT),
  name: z.string(),
  roadAddress: z.string().nullish(),
  jibunAddress: z.string().nullish(),
  /** 읍면동 code (8 digits) of the complex — the listing's 법정동 when it is picked. */
  emdCode: z.string().nullish(),
  emdName: z.string().nullish(),
  lat: z.number(),
  lng: z.number(),
  households: z.number().nullish(),
  buildings: z.number().nullish(),
  floorsMin: z.number().nullish(),
  floorsMax: z.number().nullish(),
  approvalDate: z.string().nullish(),
  builtYear: z.number().nullish(),
  parkingTotal: z.number().nullish(),
  parkingPerHousehold: decimal.nullish(),
  heatingType: z.string().nullish(),
  avgPricePerPyeong: z.number().nullish(),
  areaTypes: z.array(complexAreaTypeSchema).default([]),
});
export type ComplexForListing = z.infer<typeof complexForListingSchema>;

// ---- geocode (GET /geo/geocode, shared with a-agency) ------------------------------------------------

export const geocodeItemSchema = z.object({
  roadAddress: z.string(),
  jibunAddress: z.string().nullish(),
  zipCode: z.string().nullish(),
  buildingName: z.string().nullish(),
  lat: z.number(),
  lng: z.number(),
  /** 10-digit 법정동코드 (canonical 12150…), null when the server could not resolve it. */
  emdCode: z.string().nullish(),
});
export type GeocodeItem = z.infer<typeof geocodeItemSchema>;
export const geocodeResultSchema = z.object({ items: z.array(geocodeItemSchema) });

// ---- media ----------------------------------------------------------------------------------------

const mediaVariantSchema = z.object({ url: z.string(), width: z.number(), height: z.number() });

/** MediaDto of @house/shared (schemas/media.ts). */
export const mediaSchema = z.object({
  id: z.string(),
  mimeType: z.string(),
  variants: z
    .object({
      thumb: mediaVariantSchema.optional(),
      medium: mediaVariantSchema.optional(),
      large: mediaVariantSchema.optional(),
    })
    .default({}),
});
export type Media = z.infer<typeof mediaSchema>;
