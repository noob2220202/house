import {
  ErrorCode,
  MediaPurpose,
  MediaStatus,
  MediaVisibility,
  type ImageVariant,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AppException } from '../../../common/errors/app.exception';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';

export interface DealRequestMediaRef {
  storageKey: string;
  variants: Prisma.JsonValue | null;
}

/**
 * What the deal-requests module needs from the media domain. Bound to a Prisma implementation
 * until MediaService exposes `assertUsable` / URL helpers; swap the binding then.
 */
export interface DealRequestMediaPort {
  /**
   * Throws DEAL_REQUEST_PHOTO_INVALID unless every id is a READY, PUBLIC deal-request photo uploaded
   * by `userId` that is not attached to a request yet.
   */
  assertPhotosUsable(mediaIds: readonly string[], userId: string, db?: PrismaTx): Promise<void>;
  publicUrl(media: DealRequestMediaRef, variant?: ImageVariant): string;
}

export const DEAL_REQUEST_MEDIA = Symbol('DEAL_REQUEST_MEDIA');

function variantKey(variants: Prisma.JsonValue | null, name: ImageVariant): string | null {
  if (!variants || typeof variants !== 'object' || Array.isArray(variants)) return null;
  const v = variants[name];
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const key = v.key;
  return typeof key === 'string' && key.length > 0 ? key : null;
}

@Injectable()
export class PrismaDealRequestMedia implements DealRequestMediaPort {
  private readonly base: string;

  constructor(
    private readonly prisma: PrismaService,
    config: AppConfig,
  ) {
    this.base = config.get('MEDIA_BASE_URL').replace(/\/+$/, '');
  }

  async assertPhotosUsable(
    mediaIds: readonly string[],
    userId: string,
    db: PrismaTx = this.prisma,
  ): Promise<void> {
    if (mediaIds.length === 0) return;
    const usable = await db.media.count({
      where: {
        id: { in: [...mediaIds] },
        ownerUserId: userId,
        deletedAt: null,
        status: MediaStatus.READY,
        visibility: MediaVisibility.PUBLIC,
        purpose: MediaPurpose.DEAL_REQUEST_PHOTO,
        dealRequestPhotos: { none: {} },
      },
    });
    if (usable !== new Set(mediaIds).size) {
      throw AppException.badRequest(ErrorCode.DEAL_REQUEST_PHOTO_INVALID);
    }
  }

  publicUrl(media: DealRequestMediaRef, variant: ImageVariant = 'medium'): string {
    const key = variantKey(media.variants, variant) ?? media.storageKey;
    return `${this.base}/${key}`;
  }
}
