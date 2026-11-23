import {
  ErrorCode,
  MediaPurpose,
  MediaStatus,
  MediaVisibility,
  type AdMediaView,
  type ImageVariant,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AppException } from '../../../common/errors/app.exception';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';

/** Media columns needed to build public URLs. */
export const adMediaSelect = {
  id: true,
  storageKey: true,
  variants: true,
  width: true,
  height: true,
} satisfies Prisma.MediaSelect;
export type AdMediaRef = Prisma.MediaGetPayload<{ select: typeof adMediaSelect }>;

export type AdMediaPurpose = typeof MediaPurpose.BANNER | typeof MediaPurpose.POPUP;

/**
 * What the ads module needs from the media domain. Bound to a Prisma implementation until
 * MediaService exposes `assertUsable` / URL helpers; swap the binding then.
 */
export interface AdsMediaPort {
  /** Throws BANNER_MEDIA_INVALID / POPUP_MEDIA_INVALID unless every id is a READY, PUBLIC image of that purpose. */
  assertUsable(mediaIds: readonly string[], purpose: AdMediaPurpose, db?: PrismaTx): Promise<void>;
  /** Public URL of the large variant (falls back to the original). */
  url(media: AdMediaRef, variant?: ImageVariant): string;
  view(media: AdMediaRef): AdMediaView;
}

export const ADS_MEDIA = Symbol('ADS_MEDIA');

function variantKey(variants: Prisma.JsonValue | null, name: ImageVariant): string | null {
  if (!variants || typeof variants !== 'object' || Array.isArray(variants)) return null;
  const v = variants[name];
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const key = v.key;
  return typeof key === 'string' && key.length > 0 ? key : null;
}

@Injectable()
export class PrismaAdsMedia implements AdsMediaPort {
  private readonly base: string;

  constructor(
    private readonly prisma: PrismaService,
    config: AppConfig,
  ) {
    this.base = config.get('MEDIA_BASE_URL').replace(/\/+$/, '');
  }

  async assertUsable(
    mediaIds: readonly string[],
    purpose: AdMediaPurpose,
    db: PrismaTx = this.prisma,
  ): Promise<void> {
    const ids = [...new Set(mediaIds)];
    if (ids.length === 0) return;
    const usable = await db.media.count({
      where: {
        id: { in: ids },
        purpose,
        deletedAt: null,
        status: MediaStatus.READY,
        visibility: MediaVisibility.PUBLIC,
      },
    });
    if (usable !== ids.length) {
      throw AppException.badRequest(
        purpose === MediaPurpose.BANNER
          ? ErrorCode.BANNER_MEDIA_INVALID
          : ErrorCode.POPUP_MEDIA_INVALID,
      );
    }
  }

  url(media: AdMediaRef, variant: ImageVariant = 'large'): string {
    return `${this.base}/${variantKey(media.variants, variant) ?? media.storageKey}`;
  }

  view(media: AdMediaRef): AdMediaView {
    return { id: media.id, url: this.url(media), width: media.width, height: media.height };
  }
}
