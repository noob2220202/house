import { MEDIA_ORPHAN_EXEMPT_PURPOSES } from '@house/shared';
import type { Prisma } from '@prisma/client';

/** Every relation through which another module references a media row (all FK, onDelete Restrict/SetNull). */
export const MEDIA_REFERENCE_RELATIONS = [
  'listingPhotos',
  'complexPhotos',
  'dealRequestPhotos',
  'agencyDocuments',
  'agencyLogos',
  'bannersPc',
  'bannersMobile',
  'popups',
] as const;
export type MediaReferenceRelation = (typeof MEDIA_REFERENCE_RELATIONS)[number];

export const referenceCountSelect = Object.fromEntries(
  MEDIA_REFERENCE_RELATIONS.map((r) => [r, true]),
) as Record<MediaReferenceRelation, true>;

/** `where` fragment: no other row references the media. */
export const unattachedWhere = Object.fromEntries(
  MEDIA_REFERENCE_RELATIONS.map((r) => [r, { none: {} }]),
) as Prisma.MediaWhereInput;

/** `where` fragment: at least one other row references the media. */
export const attachedWhere: Prisma.MediaWhereInput = {
  OR: MEDIA_REFERENCE_RELATIONS.map((r) => ({ [r]: { some: {} } })),
};

/** Unattached, collectable uploads whose grace period (from the last attach/detach) has passed. */
export function orphanWhere(cutoff: Date): Prisma.MediaWhereInput {
  return {
    deletedAt: null,
    purpose: { notIn: [...MEDIA_ORPHAN_EXEMPT_PURPOSES] },
    updatedAt: { lt: cutoff },
    ...unattachedWhere,
  };
}

export const mediaViewSelect = {
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
  _count: { select: referenceCountSelect },
} satisfies Prisma.MediaSelect;
export type MediaViewRow = Prisma.MediaGetPayload<{ select: typeof mediaViewSelect }>;

/** Columns needed to build URLs (what other modules select when they embed media). */
export const mediaRefSelect = {
  id: true,
  storageKey: true,
  variants: true,
  width: true,
  height: true,
} satisfies Prisma.MediaSelect;
export type MediaRef = Prisma.MediaGetPayload<{ select: typeof mediaRefSelect }>;
