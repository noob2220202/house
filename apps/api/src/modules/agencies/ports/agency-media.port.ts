import path from 'node:path';
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

export interface MediaRef {
  storageKey: string;
  variants: Prisma.JsonValue | null;
}

/**
 * What the agencies module needs from the media domain. Bound to a Prisma implementation until
 * MediaService exposes `assertUsable` / URL helpers; swap the binding then.
 */
export interface AgencyMediaPort {
  /**
   * Throws AGENCY_DOCUMENT_INVALID unless every id is a READY, PRIVATE agency-document upload of
   * `userId` that is not attached to any agency yet.
   */
  assertDocumentsUsable(mediaIds: readonly string[], userId: string, db?: PrismaTx): Promise<void>;
  /** Throws AGENCY_LOGO_INVALID unless the media is a READY, PUBLIC agency logo of `userId`. */
  assertLogoUsable(mediaId: string, userId: string): Promise<void>;
  /** Public URL of a variant (falls back to the original). */
  publicUrl(media: MediaRef, variant?: ImageVariant): string;
  /** Absolute path of a PRIVATE file, guaranteed to stay inside PRIVATE_UPLOAD_DIR (null if not). */
  privateFilePath(storageKey: string): string | null;
}

export const AGENCY_MEDIA = Symbol('AGENCY_MEDIA');

function variantKey(variants: Prisma.JsonValue | null, name: ImageVariant): string | null {
  if (!variants || typeof variants !== 'object' || Array.isArray(variants)) return null;
  const v = variants[name];
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const key = v.key;
  return typeof key === 'string' && key.length > 0 ? key : null;
}

@Injectable()
export class PrismaAgencyMedia implements AgencyMediaPort {
  private readonly base: string;
  private readonly privateRoot: string;

  constructor(
    private readonly prisma: PrismaService,
    config: AppConfig,
  ) {
    this.base = config.get('MEDIA_BASE_URL').replace(/\/+$/, '');
    this.privateRoot = path.resolve(config.get('PRIVATE_UPLOAD_DIR'));
  }

  async assertDocumentsUsable(
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
        visibility: MediaVisibility.PRIVATE,
        purpose: MediaPurpose.AGENCY_DOCUMENT,
        agencyDocuments: { none: {} },
      },
    });
    if (usable !== new Set(mediaIds).size) {
      throw AppException.badRequest(ErrorCode.AGENCY_DOCUMENT_INVALID);
    }
  }

  async assertLogoUsable(mediaId: string, userId: string): Promise<void> {
    const ok = await this.prisma.media.count({
      where: {
        id: mediaId,
        ownerUserId: userId,
        deletedAt: null,
        status: MediaStatus.READY,
        visibility: MediaVisibility.PUBLIC,
        purpose: MediaPurpose.AGENCY_LOGO,
      },
    });
    if (ok !== 1) throw AppException.badRequest(ErrorCode.AGENCY_LOGO_INVALID);
  }

  publicUrl(media: MediaRef, variant: ImageVariant = 'thumb'): string {
    const key = variantKey(media.variants, variant) ?? media.storageKey;
    return `${this.base}/${key}`;
  }

  privateFilePath(storageKey: string): string | null {
    const resolved = path.resolve(this.privateRoot, storageKey);
    return resolved.startsWith(this.privateRoot + path.sep) ? resolved : null;
  }
}
