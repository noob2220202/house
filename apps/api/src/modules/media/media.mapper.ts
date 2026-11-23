import {
  IMAGE_VARIANTS,
  MediaStatus,
  MediaVisibility,
  type AdminMediaView,
  type ImageVariant,
  type MediaReferenceCounts,
  type MediaVariantView,
  type MediaView,
  type OwnMediaView,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { MediaStorage } from './media-storage';
import { MEDIA_REFERENCE_RELATIONS, type MediaRef, type MediaViewRow } from './media.selects';

const storedVariantSchema = z.object({
  key: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type StoredVariant = z.infer<typeof storedVariantSchema>;
export type StoredVariants = Partial<Record<ImageVariant, StoredVariant>>;

const VARIANT_NAMES = Object.keys(IMAGE_VARIANTS) as ImageVariant[];

/** Reads the `variants` JSON column defensively (unknown/invalid entries are ignored). */
export function parseVariants(json: Prisma.JsonValue | null): StoredVariants {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return {};
  const out: StoredVariants = {};
  for (const name of VARIANT_NAMES) {
    const parsed = storedVariantSchema.safeParse(json[name]);
    if (parsed.success) out[name] = parsed.data;
  }
  return out;
}

/** Media row → response view. Never exposes storage keys, sha256 or file names to non-owners. */
@Injectable()
export class MediaMapper {
  constructor(private readonly storage: MediaStorage) {}

  /** Public URL of a variant (falls back to the full-size image). */
  url(ref: Pick<MediaRef, 'storageKey' | 'variants'>, variant: ImageVariant = 'large'): string {
    const key = parseVariants(ref.variants)[variant]?.key ?? ref.storageKey;
    return this.storage.publicUrl(key);
  }

  variantUrls(ref: Pick<MediaRef, 'storageKey' | 'variants'>): Record<ImageVariant, string> {
    return {
      thumb: this.url(ref, 'thumb'),
      medium: this.url(ref, 'medium'),
      large: this.url(ref, 'large'),
    };
  }

  toView(row: MediaViewRow): MediaView {
    const servable = row.visibility === MediaVisibility.PUBLIC && row.status === MediaStatus.READY;
    const variants: Partial<Record<ImageVariant, MediaVariantView>> = {};
    if (servable) {
      for (const [name, v] of Object.entries(parseVariants(row.variants)) as [
        ImageVariant,
        StoredVariant,
      ][]) {
        variants[name] = { url: this.storage.publicUrl(v.key), width: v.width, height: v.height };
      }
    }
    return {
      id: row.id,
      purpose: row.purpose,
      visibility: row.visibility,
      status: row.status,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      width: row.width,
      height: row.height,
      url: servable ? this.storage.publicUrl(row.storageKey) : null,
      variants,
      createdAt: row.createdAt.toISOString(),
    };
  }

  toOwnView(row: MediaViewRow): OwnMediaView {
    return {
      ...this.toView(row),
      originalFilename: row.originalFilename,
      error: row.error,
      attached: referenceTotal(row) > 0,
    };
  }

  toAdminView(row: MediaViewRow): AdminMediaView {
    return {
      ...this.toOwnView(row),
      ownerUserId: row.ownerUserId,
      ownerAdminId: row.ownerAdminId,
      sha256: row.sha256,
      deletedAt: row.deletedAt?.toISOString() ?? null,
      references: { ...row._count } satisfies MediaReferenceCounts,
    };
  }
}

export function referenceTotal(row: Pick<MediaViewRow, '_count'>): number {
  return MEDIA_REFERENCE_RELATIONS.reduce((sum, r) => sum + row._count[r], 0);
}
