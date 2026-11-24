"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingMapper = void 0;
exports.verificationDueAt = verificationDueAt;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const decimal_1 = require("../../common/utils/decimal");
const constants_1 = require("./constants");
const dates_1 = require("./domain/dates");
const listing_state_1 = require("./domain/listing-state");
const listing_media_port_1 = require("./ports/listing-media.port");
const iso = (d) => (d ? d.toISOString() : null);
/** Same rule as DISCLOSABLE_AGENCY_WHERE. */
const isDisclosable = (a) => a.status === shared_1.AgencyStatus.APPROVED && !a.deletedAt;
/**
 * KST date by which the 실매물 확인 must be renewed: the 확인일 (KST) + the ad period it keeps the
 * listing up for (LISTING_AD_TTL_DAYS). Null when never verified.
 */
function verificationDueAt(verifiedAt) {
    return verifiedAt ? (0, dates_1.addDaysToDateOnly)((0, dates_1.kstToday)(verifiedAt), constants_1.LISTING_AD_TTL_DAYS) : null;
}
/** Prisma rows → API responses with explicit field picking (PRIVATE fields only in agency views). */
let ListingMapper = class ListingMapper {
    constructor(media) {
        this.media = media;
    }
    photo(p) {
        return {
            mediaId: p.mediaId,
            caption: p.caption,
            isCover: p.isCover,
            ...this.media.urls(p.media),
        };
    }
    /**
     * `agencyCount`: disclosable ACTIVE agencies on the listing; `emdName`: 법정동 name of
     * row.emdCode (both page-scoped lookups, ListingSummariesService / ListingRegionNamesService).
     */
    summary(row, agencyCount, emdName) {
        const area = (0, decimal_1.decimalToNumber)(row.exclusiveArea);
        const cover = row.photos[0];
        return {
            id: row.id,
            listingNo: (0, shared_1.formatListingNo)(row.listingNo),
            dealType: row.dealType,
            assetType: row.assetType,
            status: row.status,
            title: row.title,
            // Rows written before prices were normalized per deal type may still carry stale fields.
            ...(0, shared_1.applicablePrices)(row.dealType, row),
            priceSort: row.priceSort,
            maintenanceFeeWon: row.maintenanceFeeWon,
            exclusiveArea: area,
            exclusiveAreaPyeong: area === null ? null : (0, shared_1.sqmToPyeong)(area),
            supplyArea: (0, decimal_1.decimalToNumber)(row.property.supplyArea),
            floorLabel: (0, shared_1.floorLabel)(row.property.floor, row.property.totalFloors, row.floorDisplay),
            floorClass: row.floorClass,
            rooms: row.rooms,
            baths: row.baths,
            roomType: row.roomType,
            landZone: row.landZone,
            landCategory: row.landCategory,
            direction: row.direction,
            builtYear: row.builtYear,
            roadAddress: row.property.roadAddress,
            buildingName: row.property.buildingName,
            dong: row.property.dong,
            emdCode: row.emdCode,
            emdName,
            lat: row.lat,
            lng: row.lng,
            complex: row.complex ? { id: row.complex.id, name: row.complex.name } : null,
            coverPhoto: cover ? this.photo(cover) : null,
            photoCount: row.photoCount,
            options: row.options,
            verifiedAt: iso(row.verifiedAt),
            publishedAt: iso(row.publishedAt),
            primaryAgency: { id: row.primaryAgency.id, name: row.primaryAgency.name },
            agencyCount,
            viewCount: row.viewCount,
            favoriteCount: row.favoriteCount,
        };
    }
    /**
     * Console list row (agency-private view): 호 and the hidden reason only for the primary agency;
     * `missingCount` is computed by the caller for drafts (null otherwise).
     */
    agencyRow(row, actingAgencyId, agencyCount, emdName, missingCount) {
        const isPrimary = row.primaryAgencyId === actingAgencyId;
        return {
            ...this.summary(row, agencyCount, emdName),
            ho: isPrimary ? row.property.ho : null,
            landArea: (0, decimal_1.decimalToNumber)(row.property.landArea),
            verificationDueAt: verificationDueAt(row.verifiedAt),
            expiresAt: iso(row.expiresAt),
            updatedAt: row.updatedAt.toISOString(),
            hiddenReason: isPrimary ? row.hiddenReason : null,
            missingCount,
        };
    }
    disclosure(a) {
        return {
            agencyId: a.agencyId,
            isPrimary: a.isPrimary,
            name: a.agency.name,
            roadAddress: a.agency.roadAddress,
            addressDetail: a.agency.addressDetail,
            phone: a.agency.phone,
            registrationNumber: a.agency.registrationNumber,
            representativeName: a.agency.representativeName,
            contactName: a.contactName,
            contactPhone: a.contactPhone,
            logoUrl: a.agency.logo ? this.media.urls(a.agency.logo).thumbUrl : null,
        };
    }
    detailBase(row, exactFloor, emdName) {
        const p = row.property;
        const latest = row.verifications[0];
        const cover = row.photos.find((ph) => ph.isCover) ?? null;
        const agencyCount = row.agencies.filter((a) => a.status === shared_1.ListingAgencyStatus.ACTIVE && isDisclosable(a.agency)).length;
        const base = this.summary({ ...row, photos: cover ? [cover] : [] }, agencyCount, emdName);
        return {
            ...base,
            complex: row.complex
                ? {
                    id: row.complex.id,
                    name: row.complex.name,
                    households: row.complex.households,
                    builtYear: row.complex.builtYear,
                }
                : null,
            description: row.description,
            maintenanceFee: (0, listing_state_1.maintenanceFeeFromJson)(row.maintenanceFee),
            moveInType: row.moveInType,
            moveInDate: (0, dates_1.dateToDateOnly)(row.moveInDate),
            floorDisplay: row.floorDisplay,
            property: {
                assetType: p.assetType,
                roadAddress: p.roadAddress,
                jibunAddress: p.jibunAddress,
                buildingName: p.buildingName,
                dong: p.dong,
                floor: exactFloor || row.floorDisplay === shared_1.FloorDisplay.EXACT ? p.floor : null,
                totalFloors: p.totalFloors,
                exclusiveArea: (0, decimal_1.decimalToNumber)(p.exclusiveArea),
                supplyArea: (0, decimal_1.decimalToNumber)(p.supplyArea),
                landArea: (0, decimal_1.decimalToNumber)(p.landArea),
                totalFloorArea: (0, decimal_1.decimalToNumber)(p.totalFloorArea),
                rooms: p.rooms,
                roomType: p.roomType,
                baths: p.baths,
                direction: p.direction,
                directionBasis: p.directionBasis,
                approvalDate: (0, dates_1.dateToDateOnly)(p.approvalDate),
                parkingSpaces: p.parkingSpaces,
                heatingType: p.heatingType,
                zoning: p.zoning,
                landCategory: p.landCategory,
                buildingUse: (0, shared_1.effectiveBuildingUse)(p.assetType, p.buildingUse),
            },
            photos: row.photos.map((ph) => this.photo(ph)),
            latestVerification: latest
                ? { method: latest.method, verifiedAt: latest.verifiedAt.toISOString() }
                : null,
        };
    }
    /** Public detail: never includes 호, hidden reason or member ids. */
    publicDetail(row, isFavorite, emdName) {
        return {
            ...this.detailBase(row, false, emdName),
            agencies: row.agencies.filter((a) => isDisclosable(a.agency)).map((a) => this.disclosure(a)),
            isFavorite,
        };
    }
    /**
     * Agency view. Co-brokers get the shared ad content only: no 호, no hidden reason, no other
     * agencies' pending/ended rows or member ids — those belong to the primary agency.
     */
    agencyDetail(row, actingAgencyId, emdName) {
        const p = row.property;
        const base = this.detailBase(row, true, emdName);
        const isPrimary = row.primaryAgencyId === actingAgencyId;
        return {
            ...base,
            property: {
                ...base.property,
                id: p.id,
                ho: isPrimary ? p.ho : null,
                emdCode: p.emdCode,
                complexId: p.complexId,
                areaTypeId: p.areaTypeId,
            },
            hiddenReason: isPrimary ? row.hiddenReason : null,
            closedAt: iso(row.closedAt),
            expiresAt: iso(row.expiresAt),
            verificationDueAt: verificationDueAt(row.verifiedAt),
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
            version: row.version,
            isPrimaryAgency: isPrimary,
            agencies: row.agencies
                .filter((a) => isPrimary || a.status === shared_1.ListingAgencyStatus.ACTIVE || a.agencyId === actingAgencyId)
                .map((a) => ({
                ...this.disclosure(a),
                status: a.status,
                contactMemberId: a.agencyId === actingAgencyId ? a.contactMemberId : null,
                joinedAt: a.joinedAt.toISOString(),
            })),
            verifications: row.verifications.map((v) => ({
                id: v.id,
                method: v.method,
                verifiedAt: v.verifiedAt.toISOString(),
                note: v.note,
                byAdmin: v.verifiedByAdminId !== null,
            })),
            isFavorite: false,
        };
    }
};
exports.ListingMapper = ListingMapper;
exports.ListingMapper = ListingMapper = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(listing_media_port_1.LISTING_MEDIA)),
    __metadata("design:paramtypes", [Object])
], ListingMapper);
//# sourceMappingURL=listing.mapper.js.map