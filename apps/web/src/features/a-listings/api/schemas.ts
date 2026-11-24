import {
  AssetType,
  DealType,
  Direction,
  DirectionBasis,
  FloorClass,
  FloorDisplay,
  ListingOption,
  ListingStatus,
  MoveInType,
  VerificationMethod,
} from '@house/shared';
import { z } from 'zod';

/*
 * Response shapes of the broker-side listings API (`/api/v1/agency/listings/**`).
 * The listings controllers are not implemented yet (README + Prisma only), so these are ASSUMED
 * shapes derived from apps/api/prisma/schema/listings.prisma and packages/shared/src/schemas/listings.ts
 * — see docs/frontend-integration/a-listings.md. Fix the schema and the mock fixture together.
 */

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

export const agencyListingPhotoSchema = z.object({
  /** ListingPhoto id (absent for photos that were just uploaded and not saved yet). */
  id: z.string().nullish(),
  mediaId: z.string(),
  /** Display-size media URL. */
  url: z.string(),
  thumbUrl: z.string().nullish(),
  caption: z.string().nullish(),
  isCover: z.boolean().default(false),
});
export type AgencyListingPhoto = z.infer<typeof agencyListingPhotoSchema>;

export const agencyListingVerificationSchema = z.object({
  id: z.string(),
  method: z.enum(VerificationMethod),
  /** ISO datetime or YYYY-MM-DD. */
  verifiedAt: z.string(),
  note: z.string().nullish(),
  /** Member who recorded it (display only). */
  verifiedByName: z.string().nullish(),
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
  rooms: z.number().nullish(),
  baths: z.number().nullish(),
  direction: z.enum(Direction).nullish(),
  directionBasis: z.enum(DirectionBasis).nullish(),
  approvalDate: z.string().nullish(),
  parkingSpaces: z.number().nullish(),
});
export type AgencyListingProperty = z.infer<typeof agencyListingPropertySchema>;

/** GET /agency/listings/:id (and the response of POST / PATCH / publish / status …). */
export const agencyListingSchema = z.object({
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
  maintenanceFeeItems: z.array(z.string()).default([]),
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
  complex: z.object({ id: z.string(), name: z.string(), emdName: z.string().nullish() }).nullish(),
  photos: z.array(agencyListingPhotoSchema).default([]),
  verifications: z.array(agencyListingVerificationSchema).default([]),
  agencies: z.array(agencyListingAgencySchema).default([]),
});
export type AgencyListing = z.infer<typeof agencyListingSchema>;

// ---- table rows -----------------------------------------------------------------------------------

/** Row of GET /agency/listings. */
export const agencyListingItemSchema = z.object({
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
  /** DRAFT only: number of 명시사항 still missing. */
  missingCount: z.number().nullish(),
});
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

// ---- geocode (ASSUMED endpoint shared with a-agency) -------------------------------------------------

export const geocodeItemSchema = z.object({
  roadAddress: z.string(),
  jibunAddress: z.string().nullish(),
  zipCode: z.string().nullish(),
  buildingName: z.string().nullish(),
  lat: z.number(),
  lng: z.number(),
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
