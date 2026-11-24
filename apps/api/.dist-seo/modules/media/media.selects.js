"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaRefSelect = exports.mediaViewSelect = exports.attachedWhere = exports.unattachedWhere = exports.referenceCountSelect = exports.MEDIA_REFERENCE_RELATIONS = void 0;
exports.orphanWhere = orphanWhere;
const shared_1 = require("@house/shared");
/** Every relation through which another module references a media row (all FK, onDelete Restrict/SetNull). */
exports.MEDIA_REFERENCE_RELATIONS = [
    'listingPhotos',
    'complexPhotos',
    'dealRequestPhotos',
    'agencyDocuments',
    'agencyLogos',
    'agencyCovers',
    'bannersPc',
    'bannersMobile',
    'popups',
];
exports.referenceCountSelect = Object.fromEntries(exports.MEDIA_REFERENCE_RELATIONS.map((r) => [r, true]));
/** `where` fragment: no other row references the media. */
exports.unattachedWhere = Object.fromEntries(exports.MEDIA_REFERENCE_RELATIONS.map((r) => [r, { none: {} }]));
/** `where` fragment: at least one other row references the media. */
exports.attachedWhere = {
    OR: exports.MEDIA_REFERENCE_RELATIONS.map((r) => ({ [r]: { some: {} } })),
};
/** Unattached, collectable uploads whose grace period (from the last attach/detach) has passed. */
function orphanWhere(cutoff) {
    return {
        deletedAt: null,
        purpose: { notIn: [...shared_1.MEDIA_ORPHAN_EXEMPT_PURPOSES] },
        updatedAt: { lt: cutoff },
        ...exports.unattachedWhere,
    };
}
exports.mediaViewSelect = {
    id: true,
    purpose: true,
    visibility: true,
    status: true,
    mimeType: true,
    sizeBytes: true,
    width: true,
    height: true,
    storageKey: true,
    variants: true,
    originalFilename: true,
    error: true,
    ownerUserId: true,
    ownerAdminId: true,
    sha256: true,
    createdAt: true,
    deletedAt: true,
    _count: { select: exports.referenceCountSelect },
};
/** Columns needed to build URLs (what other modules select when they embed media). */
exports.mediaRefSelect = {
    id: true,
    storageKey: true,
    variants: true,
    width: true,
    height: true,
};
//# sourceMappingURL=media.selects.js.map