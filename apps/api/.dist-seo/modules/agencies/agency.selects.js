"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.disclosureSelect = exports.agencyMemberSelect = exports.myAgencySelect = exports.agencyStatusHistorySelect = exports.agencyDocumentSelect = exports.agencyProfileSelect = exports.agencySummarySelect = void 0;
const constants_1 = require("./constants");
/** Logo / cover media: what the public URL needs (+ deletedAt, a deleted file has no URL). */
const logoSelect = { select: { storageKey: true, variants: true, deletedAt: true } };
exports.agencySummarySelect = {
    id: true,
    name: true,
    representativeName: true,
    registrationNumber: true,
    phone: true,
    roadAddress: true,
    addressDetail: true,
    emdCode: true,
    lat: true,
    lng: true,
    specialties: true,
    activeListingCount: true,
    logo: logoSelect,
};
exports.agencyProfileSelect = {
    ...exports.agencySummarySelect,
    cover: logoSelect,
    mobile: true,
    email: true,
    jibunAddress: true,
    intro: true,
    businessHours: true,
    approvedAt: true,
    warningCount: true,
};
exports.agencyDocumentSelect = {
    id: true,
    type: true,
    mediaId: true,
    createdAt: true,
    media: { select: { mimeType: true, sizeBytes: true, originalFilename: true } },
};
exports.agencyStatusHistorySelect = {
    id: true,
    fromStatus: true,
    toStatus: true,
    reason: true,
    createdAt: true,
    decidedBy: { select: { id: true, name: true } },
};
exports.myAgencySelect = {
    ...exports.agencySummarySelect,
    businessNumber: true,
    mobile: true,
    email: true,
    jibunAddress: true,
    zipCode: true,
    intro: true,
    businessHours: true,
    logoMediaId: true,
    coverMediaId: true,
    cover: logoSelect,
    status: true,
    statusReason: true,
    approvedAt: true,
    suspendedAt: true,
    createdAt: true,
    updatedAt: true,
    documents: { select: exports.agencyDocumentSelect, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
    statusHistory: {
        select: exports.agencyStatusHistorySelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: constants_1.STATUS_HISTORY_LIMIT,
    },
    _count: { select: { members: { where: { status: 'ACTIVE' } } } },
};
exports.agencyMemberSelect = {
    id: true,
    userId: true,
    role: true,
    status: true,
    displayName: true,
    title: true,
    phone: true,
    isLicensed: true,
    licenseNumber: true,
    joinedAt: true,
    removedAt: true,
};
exports.disclosureSelect = {
    id: true,
    name: true,
    roadAddress: true,
    addressDetail: true,
    phone: true,
    registrationNumber: true,
    representativeName: true,
};
//# sourceMappingURL=agency.selects.js.map