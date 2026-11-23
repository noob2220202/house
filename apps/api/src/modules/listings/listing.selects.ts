import { AgencyStatus, ListingAgencyStatus } from '@house/shared';
import type { Prisma } from '@prisma/client';

/**
 * Explicit Prisma selects. PUBLIC selects never include Property.ho, Listing.hiddenReason
 * or member ids; only AGENCY_* selects do (served to agency members only).
 */

/** An agency that may appear in public listing data (approved, not deleted). */
export const DISCLOSABLE_AGENCY_WHERE = {
  status: AgencyStatus.APPROVED,
  deletedAt: null,
} as const satisfies Prisma.AgencyWhereInput;

/**
 * Publicly visible listings also need a disclosable primary agency: without it the 명시사항
 * (명칭·등록번호·대표 성명) could not be shown. Mirrors the SQL rule in listing-search.repository.
 */
export const PUBLIC_PRIMARY_AGENCY_WHERE = {
  primaryAgency: DISCLOSABLE_AGENCY_WHERE,
} as const satisfies Prisma.ListingWhereInput;

const mediaRef = { select: { storageKey: true, variants: true } } as const;

export const LISTING_SUMMARY_SELECT = {
  id: true,
  dealType: true,
  assetType: true,
  status: true,
  title: true,
  salePrice: true,
  deposit: true,
  monthlyRent: true,
  presalePrice: true,
  premium: true,
  priceSort: true,
  maintenanceFeeWon: true,
  exclusiveArea: true,
  rooms: true,
  baths: true,
  direction: true,
  floorClass: true,
  floorDisplay: true,
  builtYear: true,
  emdCode: true,
  lat: true,
  lng: true,
  photoCount: true,
  options: true,
  verifiedAt: true,
  publishedAt: true,
  viewCount: true,
  favoriteCount: true,
  primaryAgencyId: true,
  property: {
    select: {
      roadAddress: true,
      buildingName: true,
      dong: true,
      floor: true,
      totalFloors: true,
      supplyArea: true,
    },
  },
  complex: { select: { id: true, name: true } },
  primaryAgency: { select: { id: true, name: true } },
  photos: {
    where: { isCover: true },
    take: 1,
    select: { mediaId: true, caption: true, isCover: true, media: mediaRef },
  },
  _count: {
    select: {
      agencies: {
        where: { status: ListingAgencyStatus.ACTIVE, agency: DISCLOSABLE_AGENCY_WHERE },
      },
    },
  },
} as const satisfies Prisma.ListingSelect;
export type ListingSummaryRow = Prisma.ListingGetPayload<{ select: typeof LISTING_SUMMARY_SELECT }>;

const PUBLIC_PROPERTY_SELECT = {
  assetType: true,
  roadAddress: true,
  jibunAddress: true,
  buildingName: true,
  dong: true,
  floor: true,
  totalFloors: true,
  exclusiveArea: true,
  supplyArea: true,
  landArea: true,
  totalFloorArea: true,
  rooms: true,
  baths: true,
  direction: true,
  directionBasis: true,
  approvalDate: true,
  parkingSpaces: true,
  heatingType: true,
  zoning: true,
  landCategory: true,
  buildingUse: true,
} as const satisfies Prisma.PropertySelect;

const AGENCY_DISCLOSURE_SELECT = {
  id: true,
  name: true,
  roadAddress: true,
  addressDetail: true,
  phone: true,
  registrationNumber: true,
  representativeName: true,
  status: true,
  deletedAt: true,
  logo: mediaRef,
} as const satisfies Prisma.AgencySelect;

const DETAIL_EXTRA = {
  description: true,
  maintenanceFeeItems: true,
  moveInType: true,
  moveInDate: true,
  property: { select: PUBLIC_PROPERTY_SELECT },
  complex: { select: { id: true, name: true, households: true, builtYear: true } },
  photos: {
    orderBy: { sortOrder: 'asc' },
    select: { mediaId: true, caption: true, isCover: true, media: mediaRef },
  },
  verifications: {
    orderBy: { verifiedAt: 'desc' },
    take: 1,
    select: { method: true, verifiedAt: true },
  },
} as const satisfies Prisma.ListingSelect;

export const LISTING_PUBLIC_DETAIL_SELECT = {
  ...LISTING_SUMMARY_SELECT,
  ...DETAIL_EXTRA,
  agencies: {
    where: { status: ListingAgencyStatus.ACTIVE },
    orderBy: [{ isPrimary: 'desc' }, { joinedAt: 'asc' }],
    select: {
      agencyId: true,
      isPrimary: true,
      contactName: true,
      contactPhone: true,
      agency: { select: AGENCY_DISCLOSURE_SELECT },
    },
  },
} as const satisfies Prisma.ListingSelect;
export type ListingPublicDetailRow = Prisma.ListingGetPayload<{
  select: typeof LISTING_PUBLIC_DETAIL_SELECT;
}>;

export const LISTING_AGENCY_DETAIL_SELECT = {
  ...LISTING_SUMMARY_SELECT,
  ...DETAIL_EXTRA,
  hiddenReason: true,
  closedAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  property: {
    select: {
      ...PUBLIC_PROPERTY_SELECT,
      id: true,
      ho: true,
      emdCode: true,
      complexId: true,
      areaTypeId: true,
    },
  },
  verifications: {
    orderBy: { verifiedAt: 'desc' },
    select: { id: true, method: true, verifiedAt: true, note: true, verifiedByAdminId: true },
  },
  agencies: {
    orderBy: [{ isPrimary: 'desc' }, { joinedAt: 'asc' }],
    select: {
      agencyId: true,
      isPrimary: true,
      status: true,
      contactMemberId: true,
      contactName: true,
      contactPhone: true,
      joinedAt: true,
      agency: { select: AGENCY_DISCLOSURE_SELECT },
    },
  },
} as const satisfies Prisma.ListingSelect;
export type ListingAgencyDetailRow = Prisma.ListingGetPayload<{
  select: typeof LISTING_AGENCY_DETAIL_SELECT;
}>;
