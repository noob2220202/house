import { ErrorCode, MediaPurpose, MediaStatus, MediaVisibility } from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AppException } from '../../../common/errors/app.exception';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';

export interface ComplexMediaRef {
  storageKey: string;
  variants: Prisma.JsonValue | null;
}

export interface ComplexPhotoUrls {
  thumbUrl: string;
  mediumUrl: string;
  largeUrl: string;
}

/**
 * What the complexes module needs from the media domain. Bound to a Prisma implementation until
 * MediaService exposes `assertUsable` / public URL helpers (see openIssues).
 */
export interface ComplexMediaPort {
  /** Throws COMPLEX_MEDIA_INVALID unless every id is a READY, PUBLIC, non-deleted 단지 photo. */
  assertUsable(mediaIds: readonly string[]): Promise<void>;
  urls(media: ComplexMediaRef): ComplexPhotoUrls;
}

export const COMPLEX_MEDIA = Symbol('COMPLEX_MEDIA');

type VariantName = 'thumb' | 'medium' | 'large';

function variantKey(variants: Prisma.JsonValue | null, name: VariantName): string | null {
  if (!variants || typeof variants !== 'object' || Array.isArray(variants)) return null;
  const v = variants[name];
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  return typeof v.key === 'string' && v.key.length > 0 ? v.key : null;
}

@Injectable()
export class PrismaComplexMedia implements ComplexMediaPort {
  private readonly base: string;

  constructor(
    private readonly prisma: PrismaService,
    config: AppConfig,
  ) {
    this.base = config.get('MEDIA_BASE_URL').replace(/\/+$/, '');
  }

  async assertUsable(mediaIds: readonly string[]): Promise<void> {
    if (mediaIds.length === 0) return;
    const usable = await this.prisma.media.count({
      where: {
        id: { in: [...mediaIds] },
        deletedAt: null,
        status: MediaStatus.READY,
        visibility: MediaVisibility.PUBLIC,
        purpose: MediaPurpose.COMPLEX_PHOTO,
      },
    });
    if (usable !== new Set(mediaIds).size) {
      throw AppException.badRequest(ErrorCode.COMPLEX_MEDIA_INVALID);
    }
  }

  urls(media: ComplexMediaRef): ComplexPhotoUrls {
    const url = (key: string): string => `${this.base}/${key}`;
    const pick = (name: VariantName): string =>
      url(variantKey(media.variants, name) ?? media.storageKey);
    return { thumbUrl: pick('thumb'), mediumUrl: pick('medium'), largeUrl: pick('large') };
  }
}
