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
exports.DealRequestMapper = void 0;
exports.maskName = maskName;
exports.canSeeContact = canSeeContact;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const decimal_1 = require("../../common/utils/decimal");
const media_port_1 = require("./ports/media.port");
const iso = (d) => (d ? d.toISOString() : null);
const dateOnly = (d) => d ? d.toISOString().slice(0, 10) : null;
/** "홍길동" → "홍*동", "홍길" → "홍*"; empty (scrubbed) stays empty. */
function maskName(name) {
    const chars = [...name.trim()];
    if (chars.length === 0)
        return '';
    if (chars.length === 1)
        return '*';
    if (chars.length === 2)
        return `${chars[0]}*`;
    return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}
function jsonObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
/**
 * Row → response mapping with explicit field picking per audience. Contact and 동·호 appear only
 * in the owner view, and in the agency view when `contact` was loaded for an active grant.
 */
let DealRequestMapper = class DealRequestMapper {
    constructor(media) {
        this.media = media;
    }
    base(r) {
        return {
            id: r.id,
            type: r.type,
            status: r.status,
            assetType: r.assetType,
            dealTypes: r.dealTypes,
            visibility: r.visibility,
            sggCode: r.sggCode,
            emdCode: r.emdCode,
            roadAddress: r.roadAddress,
            complex: r.complex ? { id: r.complex.id, name: r.complex.name } : null,
            lat: r.lat,
            lng: r.lng,
            exclusiveArea: (0, decimal_1.decimalToNumber)(r.exclusiveArea),
            floor: r.floor,
            desiredSalePrice: r.desiredSalePrice,
            desiredDeposit: r.desiredDeposit,
            desiredMonthlyRent: r.desiredMonthlyRent,
            regionCodes: r.regionCodes,
            complexIds: r.complexIds,
            priceMin: r.priceMin,
            priceMax: r.priceMax,
            depositMin: r.depositMin,
            depositMax: r.depositMax,
            rentMin: r.rentMin,
            rentMax: r.rentMax,
            areaMin: (0, decimal_1.decimalToNumber)(r.areaMin),
            areaMax: (0, decimal_1.decimalToNumber)(r.areaMax),
            roomsMin: r.roomsMin,
            moveInDate: dateOnly(r.moveInDate),
            description: r.description,
            photos: r.photos.map((p) => ({
                mediaId: p.media.id,
                url: this.media.publicUrl(p.media, 'large'),
                thumbUrl: this.media.publicUrl(p.media, 'thumb'),
            })),
            proposalCount: r.proposalCount,
            expiresAt: iso(r.expiresAt),
            closedAt: iso(r.closedAt),
            createdAt: r.createdAt.toISOString(),
        };
    }
    owner(r) {
        return {
            ...this.base(r),
            contactName: r.contactName,
            contactPhone: r.contactPhone,
            addressDetail: r.addressDetail,
            targetAgencyIds: r.targets.map((t) => t.agencyId),
            closeReason: r.closeReason,
            extensionCount: r.extensionCount,
            contactGrants: r.contactGrants.map((g) => ({
                agencyId: g.agencyId,
                agencyName: g.agency.name,
                grantedAt: g.grantedAt.toISOString(),
            })),
        };
    }
    /** `contact` must only be passed when the agency holds an active grant (see canSeeContact). */
    agency(r, contact) {
        const proposal = r.proposals[0];
        return {
            ...this.base(r),
            targeted: r.targets.length > 0,
            myProposal: proposal
                ? { id: proposal.id, status: proposal.status, createdAt: proposal.createdAt.toISOString() }
                : null,
            contact: contact && canSeeContact(r) ? toContact(contact) : null,
        };
    }
    admin(r) {
        return {
            ...this.base(r),
            userId: r.userId,
            contactNameMasked: maskName(r.contactName),
            contactPhoneMasked: r.contactPhone ? (0, shared_1.maskPhone)(r.contactPhone) : '',
            targetAgencyIds: r.targets.map((t) => t.agencyId),
            closeReason: r.closeReason,
            contactScrubbedAt: iso(r.contactScrubbedAt),
            deletedAt: iso(r.deletedAt),
            spamFlaggedAt: iso(r.spamFlaggedAt),
            spamReason: r.spamFlaggedAt ? r.spamReason : null,
            spamSignalCount: 0,
            spamSignals: [],
        };
    }
    proposalForOwner(p, agency, contactShared) {
        return {
            id: p.id,
            dealRequestId: p.dealRequestId,
            status: p.status,
            message: p.message,
            suggestedPrice: p.suggestedPrice,
            suggestedDeposit: p.suggestedDeposit,
            suggestedMonthlyRent: p.suggestedMonthlyRent,
            agencyId: p.agencyId,
            agency,
            agent: p.member && p.member.status === shared_1.AgencyMemberStatus.ACTIVE
                ? { displayName: p.member.displayName, phone: p.member.phone }
                : null,
            listings: p.listings
                .map((l) => l.listing)
                .filter((l) => l.deletedAt === null)
                .map((l) => ({
                id: l.id,
                title: l.title,
                assetType: l.assetType,
                dealType: l.dealType,
                status: l.status,
                salePrice: l.salePrice,
                deposit: l.deposit,
                monthlyRent: l.monthlyRent,
                presalePrice: l.presalePrice,
                premium: l.premium,
                exclusiveArea: (0, decimal_1.decimalToNumber)(l.exclusiveArea),
            })),
            contactShared,
            viewedAt: iso(p.viewedAt),
            respondedAt: iso(p.respondedAt),
            createdAt: p.createdAt.toISOString(),
        };
    }
    proposalForAgency(p) {
        return {
            id: p.id,
            dealRequestId: p.dealRequestId,
            status: p.status,
            message: p.message,
            suggestedPrice: p.suggestedPrice,
            suggestedDeposit: p.suggestedDeposit,
            suggestedMonthlyRent: p.suggestedMonthlyRent,
            listingIds: p.listings.map((l) => l.listingId),
            memberId: p.memberId,
            viewedAt: iso(p.viewedAt),
            respondedAt: iso(p.respondedAt),
            createdAt: p.createdAt.toISOString(),
            dealRequest: {
                type: p.dealRequest.type,
                status: p.dealRequest.status,
                assetType: p.dealRequest.assetType,
                dealTypes: p.dealRequest.dealTypes,
            },
        };
    }
    notification(n) {
        return {
            id: n.id,
            type: n.type,
            title: n.title,
            body: n.body,
            data: jsonObject(n.data),
            readAt: iso(n.readAt),
            createdAt: n.createdAt.toISOString(),
        };
    }
};
exports.DealRequestMapper = DealRequestMapper;
exports.DealRequestMapper = DealRequestMapper = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(media_port_1.DEAL_REQUEST_MEDIA)),
    __metadata("design:paramtypes", [Object])
], DealRequestMapper);
/** Contact is visible to an agency with an active grant while the request is live or completed. */
function canSeeContact(r) {
    return (r.contactGrants.length > 0 &&
        r.contactScrubbedAt === null &&
        shared_1.DEAL_REQUEST_CONTACT_STATUSES.includes(r.status));
}
function toContact(c) {
    return { name: c.contactName, phone: c.contactPhone, addressDetail: c.addressDetail };
}
//# sourceMappingURL=deal-request.mapper.js.map