"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LISTING_AGENCY_ROW_SELECT = exports.LISTING_AGENCY_DETAIL_SELECT = exports.LISTING_PUBLIC_DETAIL_SELECT = exports.LISTING_SUMMARY_SELECT = exports.PUBLIC_PRIMARY_AGENCY_WHERE = exports.DISCLOSABLE_AGENCY_WHERE = void 0;
const shared_1 = require("@house/shared");
/**
 * Explicit Prisma selects. PUBLIC selects never include Property.ho, Listing.hiddenReason
 * or member ids; only AGENCY_* selects do (served to agency members only).
 */
/** An agency that may appear in public listing data (approved, not deleted). */
exports.DISCLOSABLE_AGENCY_WHERE = {
    status: shared_1.AgencyStatus.APPROVED,
    deletedAt: null,
};
/**
 * Publicly visible listings also need a disclosable primary agency: without it the 명시사항
 * (명칭·등록번호·대표 성명) could not be shown. Mirrors the SQL rule in listing-search.repository.
 */
exports.PUBLIC_PRIMARY_AGENCY_WHERE = {
    primaryAgency: exports.DISCLOSABLE_AGENCY_WHERE,
};
const mediaRef = { select: { storageKey: true, variants: true } };
exports.LISTING_SUMMARY_SELECT = {
    id: true,
    listingNo: true,
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
    roomType: true,
    landZone: true,
    landCategory: true,
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
};
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
    roomType: true,
    baths: true,
    direction: true,
    directionBasis: true,
    approvalDate: true,
    parkingSpaces: true,
    heatingType: true,
    zoning: true,
    landCategory: true,
    buildingUse: true,
};
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
};
const DETAIL_EXTRA = {
    description: true,
    maintenanceFee: true,
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
};
exports.LISTING_PUBLIC_DETAIL_SELECT = {
    ...exports.LISTING_SUMMARY_SELECT,
    ...DETAIL_EXTRA,
    agencies: {
        where: { status: shared_1.ListingAgencyStatus.ACTIVE },
        orderBy: [{ isPrimary: 'desc' }, { joinedAt: 'asc' }],
        select: {
            agencyId: true,
            isPrimary: true,
            status: true,
            contactName: true,
            contactPhone: true,
            agency: { select: AGENCY_DISCLOSURE_SELECT },
        },
    },
};
exports.LISTING_AGENCY_DETAIL_SELECT = {
    ...exports.LISTING_SUMMARY_SELECT,
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
};
/**
 * Rows of the console list (GET /agency/listings): the summary plus the agency-private columns.
 * Served to members of a participating agency only (ho / hiddenReason are blanked for co-brokers
 * by the mapper).
 */
exports.LISTING_AGENCY_ROW_SELECT = {
    ...exports.LISTING_SUMMARY_SELECT,
    hiddenReason: true,
    expiresAt: true,
    updatedAt: true,
    property: {
        select: { ...exports.LISTING_SUMMARY_SELECT.property.select, ho: true, landArea: true },
    },
};
//# sourceMappingURL=listing.selects.js.map