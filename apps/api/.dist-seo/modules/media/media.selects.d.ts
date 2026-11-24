import type { Prisma } from '@prisma/client';
/** Every relation through which another module references a media row (all FK, onDelete Restrict/SetNull). */
export declare const MEDIA_REFERENCE_RELATIONS: readonly ["listingPhotos", "complexPhotos", "dealRequestPhotos", "agencyDocuments", "agencyLogos", "agencyCovers", "bannersPc", "bannersMobile", "popups"];
export type MediaReferenceRelation = (typeof MEDIA_REFERENCE_RELATIONS)[number];
export declare const referenceCountSelect: Record<MediaReferenceRelation, true>;
/** `where` fragment: no other row references the media. */
export declare const unattachedWhere: Prisma.MediaWhereInput;
/** `where` fragment: at least one other row references the media. */
export declare const attachedWhere: Prisma.MediaWhereInput;
/** Unattached, collectable uploads whose grace period (from the last attach/detach) has passed. */
export declare function orphanWhere(cutoff: Date): Prisma.MediaWhereInput;
export declare const mediaViewSelect: {
    id: true;
    purpose: true;
    visibility: true;
    status: true;
    mimeType: true;
    sizeBytes: true;
    width: true;
    height: true;
    storageKey: true;
    variants: true;
    originalFilename: true;
    error: true;
    ownerUserId: true;
    ownerAdminId: true;
    sha256: true;
    createdAt: true;
    deletedAt: true;
    _count: {
        select: Record<"listingPhotos" | "complexPhotos" | "dealRequestPhotos" | "agencyDocuments" | "agencyLogos" | "agencyCovers" | "bannersPc" | "bannersMobile" | "popups", true>;
    };
};
export type MediaViewRow = Prisma.MediaGetPayload<{
    select: typeof mediaViewSelect;
}>;
/** Columns needed to build URLs (what other modules select when they embed media). */
export declare const mediaRefSelect: {
    id: true;
    storageKey: true;
    variants: true;
    width: true;
    height: true;
};
export type MediaRef = Prisma.MediaGetPayload<{
    select: typeof mediaRefSelect;
}>;
