import { type AdminMediaView, type ImageVariant, type MediaView, type OwnMediaView } from '@house/shared';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { MediaStorage } from './media-storage';
import { type MediaRef, type MediaViewRow } from './media.selects';
declare const storedVariantSchema: z.ZodObject<{
    key: z.ZodString;
    width: z.ZodNumber;
    height: z.ZodNumber;
}, z.core.$strip>;
export type StoredVariant = z.infer<typeof storedVariantSchema>;
export type StoredVariants = Partial<Record<ImageVariant, StoredVariant>>;
/** Reads the `variants` JSON column defensively (unknown/invalid entries are ignored). */
export declare function parseVariants(json: Prisma.JsonValue | null): StoredVariants;
/** Media row → response view. Never exposes storage keys, sha256 or file names to non-owners. */
export declare class MediaMapper {
    private readonly storage;
    constructor(storage: MediaStorage);
    /** Public URL of a variant (falls back to the full-size image). */
    url(ref: Pick<MediaRef, 'storageKey' | 'variants'>, variant?: ImageVariant): string;
    variantUrls(ref: Pick<MediaRef, 'storageKey' | 'variants'>): Record<ImageVariant, string>;
    toView(row: MediaViewRow): MediaView;
    toOwnView(row: MediaViewRow): OwnMediaView;
    toAdminView(row: MediaViewRow): AdminMediaView;
}
export declare function referenceTotal(row: Pick<MediaViewRow, '_count'>): number;
export {};
