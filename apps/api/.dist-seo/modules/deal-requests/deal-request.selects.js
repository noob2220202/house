"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationSelect = exports.proposalAgencySelect = exports.proposalOwnerSelect = exports.dealRequestAdminSelect = exports.dealRequestContactSelect = exports.dealRequestOwnerSelect = exports.dealRequestBaseSelect = void 0;
exports.dealRequestAgencySelect = dealRequestAgencySelect;
/**
 * Prisma selects per audience. The base select never loads contact, 동·호 or the requester id, so
 * an agency/public code path cannot leak them by accident; those are added only by the owner and
 * admin selects, or loaded separately for agencies holding an active contact grant.
 */
exports.dealRequestBaseSelect = {
    id: true,
    type: true,
    status: true,
    assetType: true,
    dealTypes: true,
    visibility: true,
    sggCode: true,
    emdCode: true,
    roadAddress: true,
    complex: { select: { id: true, name: true } },
    lat: true,
    lng: true,
    exclusiveArea: true,
    floor: true,
    desiredSalePrice: true,
    desiredDeposit: true,
    desiredMonthlyRent: true,
    regionCodes: true,
    complexIds: true,
    priceMin: true,
    priceMax: true,
    depositMin: true,
    depositMax: true,
    rentMin: true,
    rentMax: true,
    areaMin: true,
    areaMax: true,
    roomsMin: true,
    moveInDate: true,
    description: true,
    photos: {
        select: { media: { select: { id: true, storageKey: true, variants: true } } },
        orderBy: { sortOrder: 'asc' },
    },
    proposalCount: true,
    expiresAt: true,
    closedAt: true,
    createdAt: true,
};
exports.dealRequestOwnerSelect = {
    ...exports.dealRequestBaseSelect,
    contactName: true,
    contactPhone: true,
    addressDetail: true,
    closeReason: true,
    extensionCount: true,
    targets: { select: { agencyId: true }, orderBy: { createdAt: 'asc' } },
    contactGrants: {
        where: { revokedAt: null },
        select: { agencyId: true, grantedAt: true, agency: { select: { name: true } } },
        orderBy: { grantedAt: 'asc' },
    },
};
/** Agency audience: base + this agency's own relation rows (no contact). */
function dealRequestAgencySelect(agencyId) {
    return {
        ...exports.dealRequestBaseSelect,
        contactScrubbedAt: true,
        targets: { where: { agencyId }, select: { agencyId: true } },
        proposals: { where: { agencyId }, select: { id: true, status: true, createdAt: true } },
        contactGrants: { where: { agencyId, revokedAt: null }, select: { agencyId: true } },
    };
}
exports.dealRequestContactSelect = {
    id: true,
    contactName: true,
    contactPhone: true,
    addressDetail: true,
};
exports.dealRequestAdminSelect = {
    ...exports.dealRequestBaseSelect,
    userId: true,
    contactName: true,
    contactPhone: true,
    closeReason: true,
    contactScrubbedAt: true,
    spamFlaggedAt: true,
    spamReason: true,
    deletedAt: true,
    targets: { select: { agencyId: true }, orderBy: { createdAt: 'asc' } },
};
/** A proposal as the requester sees it (agency disclosure is joined via AgenciesService). */
exports.proposalOwnerSelect = {
    id: true,
    dealRequestId: true,
    agencyId: true,
    status: true,
    message: true,
    suggestedPrice: true,
    suggestedDeposit: true,
    suggestedMonthlyRent: true,
    viewedAt: true,
    respondedAt: true,
    createdAt: true,
    member: { select: { displayName: true, phone: true, status: true } },
    listings: {
        select: {
            listing: {
                select: {
                    id: true,
                    title: true,
                    assetType: true,
                    dealType: true,
                    status: true,
                    salePrice: true,
                    deposit: true,
                    monthlyRent: true,
                    presalePrice: true,
                    premium: true,
                    exclusiveArea: true,
                    deletedAt: true,
                },
            },
        },
    },
};
exports.proposalAgencySelect = {
    id: true,
    dealRequestId: true,
    memberId: true,
    status: true,
    message: true,
    suggestedPrice: true,
    suggestedDeposit: true,
    suggestedMonthlyRent: true,
    viewedAt: true,
    respondedAt: true,
    createdAt: true,
    listings: { select: { listingId: true } },
    dealRequest: { select: { type: true, status: true, assetType: true, dealTypes: true } },
};
exports.notificationSelect = {
    id: true,
    type: true,
    title: true,
    body: true,
    data: true,
    readAt: true,
    createdAt: true,
};
//# sourceMappingURL=deal-request.selects.js.map