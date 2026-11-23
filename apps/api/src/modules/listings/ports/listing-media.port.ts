import {
  ErrorCode,
  MediaPurpose,
  MediaStatus,
  MediaVisibility,
  type PhotoUrls,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AppException } from '../../../common/errors/app.exception';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';

/** The media columns needed to build public URLs. */
export interface MediaRef {
  storageKey: string;
  variants: Prisma.JsonValue | null;
}

/**
 * What the listings module needs from the media domain. Bound to a Prisma implementation until
 * MediaService exposes `assertUsable` / public URL helpers.
 */
export interface ListingMediaPort {
  /**
   * Throws LISTING_MEDIA_INVALID unless every id is a READY, PUBLIC listing photo that the user
   * uploaded or that is already attached to this listing (co-brokers may reorder those).
   */
  assertUsableForListing(
    mediaIds: readonly string[],
    ctx: { userId: string; listingId: string },
  ): Promise<void>;
  urls(media: MediaRef): Pick<PhotoUrls, 'thumbUrl' | 'mediumUrl' | 'largeUrl'>;
}

export const LISTING_MEDIA = Symbol('LISTING_MEDIA');

type VariantName = 'thumb' | 'medium' | 'large';

function variantKey(variants: Prisma.JsonValue | null, name: VariantName): string | null {
  if (!variants || typeof variants !== 'object' || Array.isArray(variants)) return null;
  const v = variants[name];
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const key = v.key;
  return typeof key === 'string' && key.length > 0 ? key : null;
}

@Injectable()
export class PrismaListingMedia implements ListingMediaPort {
  private readonly base: string;

  constructor(
    private readonly prisma: PrismaService,
    config: AppConfig,
  ) {
    this.base = config.get('MEDIA_BASE_URL').replace(/\/+$/, '');
  }

  async assertUsableForListing(
    mediaIds: readonly string[],
    ctx: { userId: string; listingId: string },
  ): Promise<void> {
    if (mediaIds.length === 0) return;
    const usable = await this.prisma.media.count({
      where: {
        id: { in: [...mediaIds] },
        deletedAt: null,
        status: MediaStatus.READY,
        visibility: MediaVisibility.PUBLIC,
        purpose: MediaPurpose.LISTING_PHOTO,
        OR: [
          { ownerUserId: ctx.userId },
          { listingPhotos: { some: { listingId: ctx.listingId } } },
        ],
      },
    });
    if (usable !== mediaIds.length) throw AppException.badRequest(ErrorCode.LISTING_MEDIA_INVALID);
  }

  urls(media: MediaRef): Pick<PhotoUrls, 'thumbUrl' | 'mediumUrl' | 'largeUrl'> {
    const url = (key: string): string => `${this.base}/${key}`;
    const original = url(media.storageKey);
    const pick = (name: VariantName): string => {
      const key = variantKey(media.variants, name);
      return key ? url(key) : original;
    };
    return { thumbUrl: pick('thumb'), mediumUrl: pick('medium'), largeUrl: pick('large') };
  }
}
