import { createHash } from 'node:crypto';
import {
  canAdminUpload,
  canUserUpload,
  ErrorCode,
  isAcceptedMime,
  MEDIA_USER_QUOTA,
  MediaKind,
  mediaMaxBytes,
  mediaRuleFor,
  MediaStatus,
  MediaVisibility,
  SNIFF_HEADER_BYTES,
  sniffMime,
  type MediaPurpose,
  type OwnMediaView,
} from '@house/shared';
import { InjectQueue } from '@nestjs/bullmq';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { UserPrincipal } from '../../common/auth/principal';
import { AppException } from '../../common/errors/app.exception';
import { DailyCapService } from '../../common/throttle/daily-cap.service';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService, type PrismaTx } from '../../prisma/prisma.service';
import { QUEUES } from '../../queue/queue.constants';
import { ASYNC_PROCESSING_THRESHOLD, MEDIA_JOBS } from './constants';
import { ImageProcessor } from './image-processor';
import { MediaFiles } from './media-files';
import { MediaStorage } from './media-storage';
import { MediaMapper } from './media.mapper';
import { mediaViewSelect, type MediaViewRow } from './media.selects';

/** The parts of a multer memory-storage file the service uses. */
export interface UploadedFileInput {
  buffer: Buffer;
  size: number;
  originalname: string;
}

export type MediaUploaderRef =
  | { kind: 'USER'; principal: UserPrincipal }
  | { kind: 'ADMIN'; adminId: string };

export interface ProcessJobData {
  mediaId: string;
}

const MB = 1024 * 1024;

/**
 * Upload flow: authorize purpose → size → magic-byte sniff → daily cap + quota → process.
 * Small images and documents are processed inline (201 READY); large images and HEIC go to the
 * media-processing worker (202 PENDING, raw bytes kept in private staging until then).
 */
@Injectable()
export class MediaUploadService {
  private readonly logger = new Logger(MediaUploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorage,
    private readonly files: MediaFiles,
    private readonly processor: ImageProcessor,
    private readonly mapper: MediaMapper,
    private readonly dailyCaps: DailyCapService,
    private readonly config: AppConfig,
    @InjectQueue(QUEUES.MEDIA_PROCESSING) private readonly queue: Queue<ProcessJobData>,
  ) {}

  /** Per-file byte limit for a purpose (also used by the multipart interceptor). */
  maxBytesFor(purpose: MediaPurpose): number {
    return mediaMaxBytes(purpose, Math.floor(this.config.get('MAX_UPLOAD_MB') * MB));
  }

  async upload(
    file: UploadedFileInput | undefined,
    purpose: MediaPurpose,
    uploader: MediaUploaderRef,
  ): Promise<OwnMediaView> {
    this.assertMayUpload(purpose, uploader);
    if (!file || file.size === 0 || file.buffer.length === 0) {
      throw AppException.badRequest(ErrorCode.MEDIA_FILE_REQUIRED);
    }
    const maxBytes = this.maxBytesFor(purpose);
    if (file.size > maxBytes) {
      throw new AppException(ErrorCode.MEDIA_TOO_LARGE, {
        status: HttpStatus.PAYLOAD_TOO_LARGE,
        details: { maxBytes },
      });
    }
    const rule = mediaRuleFor(purpose);
    const mime = sniffMime(file.buffer.subarray(0, SNIFF_HEADER_BYTES));
    if (!mime || !isAcceptedMime(purpose, mime)) {
      throw new AppException(ErrorCode.MEDIA_UNSUPPORTED_TYPE, {
        status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        details: { accepted: rule.accept },
      });
    }
    this.processor.assertDecodable(mime);
    const userId = uploader.kind === 'USER' ? uploader.principal.userId : null;
    if (userId) {
      await this.dailyCaps.consume('MEDIA_UPLOAD', userId);
      await this.assertQuota(this.prisma, userId, file.size, false);
    }

    const base = {
      purpose,
      visibility: rule.visibility,
      ownerUserId: userId,
      ownerAdminId: uploader.kind === 'ADMIN' ? uploader.adminId : null,
      sha256: createHash('sha256').update(file.buffer).digest('hex'),
      originalFilename: sanitizeFilename(file.originalname),
    } satisfies Partial<Prisma.MediaUncheckedCreateInput>;

    if (rule.kind === MediaKind.DOCUMENT) return this.storeDocument(file.buffer, mime, base);

    const dims = await this.processor.probe(file.buffer, mime);
    const deferred =
      dims === null ||
      file.size > ASYNC_PROCESSING_THRESHOLD.bytes ||
      dims.width * dims.height > ASYNC_PROCESSING_THRESHOLD.pixels;
    return deferred
      ? this.enqueueImage(file.buffer, file.size, base)
      : this.storeImage(file.buffer, mime, base);
  }

  /** Also called by the multipart interceptor, so a forbidden purpose is refused before the body is read. */
  assertMayUpload(purpose: MediaPurpose, uploader: MediaUploaderRef): void {
    const allowed =
      uploader.kind === 'USER'
        ? canUserUpload(purpose, uploader.principal.role)
        : canAdminUpload(purpose);
    if (!allowed) throw AppException.forbidden(ErrorCode.MEDIA_PURPOSE_NOT_ALLOWED);
  }

  private async storeDocument(data: Buffer, mime: string, base: BaseCreate): Promise<OwnMediaView> {
    const doc = await this.processor.processDocument(data, mime);
    const key = this.storage.newPrivateKey(doc.ext);
    await this.storage.write(MediaVisibility.PRIVATE, key, doc.data);
    const row = await this.createRow(
      {
        ...base,
        status: MediaStatus.READY,
        mimeType: doc.mimeType,
        sizeBytes: doc.data.length,
        width: doc.width,
        height: doc.height,
        storageKey: key,
      },
      false,
    ).catch(async (err: unknown) => {
      await this.storage.remove(MediaVisibility.PRIVATE, [key]);
      throw err;
    });
    return this.mapper.toOwnView(row);
  }

  private async storeImage(data: Buffer, mime: string, base: BaseCreate): Promise<OwnMediaView> {
    const processed = await this.processor.processImage(data, mime);
    const key = this.storage.newPublicImageKey();
    const variants = await this.files.writeImage(key, processed);
    const row = await this.createRow(
      {
        ...base,
        status: MediaStatus.READY,
        mimeType: 'image/webp',
        sizeBytes: processed.original.data.length,
        width: processed.original.width,
        height: processed.original.height,
        storageKey: key,
        variants: variants,
      },
      false,
    ).catch(async (err: unknown) => {
      await this.files.removeImage(key);
      throw err;
    });
    return this.mapper.toOwnView(row);
  }

  private async enqueueImage(data: Buffer, size: number, base: BaseCreate): Promise<OwnMediaView> {
    const row = await this.createRow(
      {
        ...base,
        status: MediaStatus.PENDING,
        mimeType: 'image/webp',
        sizeBytes: size,
        storageKey: this.storage.newPublicImageKey(),
      },
      true,
    );
    try {
      await this.storage.writeStaging(row.id, data);
      await this.queue.add(MEDIA_JOBS.PROCESS, { mediaId: row.id }, { jobId: row.id });
    } catch (err) {
      this.logger.error({ err, mediaId: row.id }, 'failed to queue media processing');
      await this.storage.removeStaging(row.id).catch(() => undefined);
      await this.prisma.media.delete({ where: { id: row.id } }).catch(() => undefined);
      throw new AppException(ErrorCode.SERVICE_UNAVAILABLE, { cause: err });
    }
    return this.mapper.toOwnView(row);
  }

  /** Insert under a per-user advisory lock so concurrent uploads cannot overshoot the quota. */
  private createRow(
    data: Prisma.MediaUncheckedCreateInput,
    pending: boolean,
  ): Promise<MediaViewRow> {
    const userId = data.ownerUserId;
    return this.prisma.$transaction(async (tx) => {
      if (userId) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`media-quota:${userId}`}, 0))`;
        await this.assertQuota(tx, userId, data.sizeBytes, pending);
      }
      return tx.media.create({ data, select: mediaViewSelect });
    });
  }

  private async assertQuota(
    db: PrismaTx,
    userId: string,
    incomingBytes: number,
    pending: boolean,
  ): Promise<void> {
    const live = { ownerUserId: userId, deletedAt: null };
    const [usage, pendingCount] = await Promise.all([
      db.media.aggregate({ where: live, _sum: { sizeBytes: true }, _count: { _all: true } }),
      pending ? db.media.count({ where: { ...live, status: MediaStatus.PENDING } }) : 0,
    ]);
    const usedBytes = usage._sum.sizeBytes ?? 0;
    if (
      usage._count._all >= MEDIA_USER_QUOTA.maxFiles ||
      usedBytes + incomingBytes > MEDIA_USER_QUOTA.maxBytes
    ) {
      throw AppException.conflict(ErrorCode.MEDIA_QUOTA_EXCEEDED, {
        usedBytes,
        maxBytes: MEDIA_USER_QUOTA.maxBytes,
        files: usage._count._all,
        maxFiles: MEDIA_USER_QUOTA.maxFiles,
      });
    }
    if (pendingCount >= MEDIA_USER_QUOTA.maxPending) {
      throw new AppException(ErrorCode.MEDIA_TOO_MANY_PENDING, {
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    }
  }
}

type BaseCreate = Pick<
  Prisma.MediaUncheckedCreateInput,
  'purpose' | 'visibility' | 'ownerUserId' | 'ownerAdminId' | 'sha256' | 'originalFilename'
>;

// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const UNSAFE_FILENAME_CHARS = /[\u0000-\u001f\u007f"<>]/g;

/** Display-only file name: base name, no control/quote characters, NFC, ≤ 255 chars. */
export function sanitizeFilename(name: string | undefined): string | null {
  if (!name) return null;
  const base = name.split(/[\\/]/).pop() ?? '';
  const clean = base.normalize('NFC').replace(UNSAFE_FILENAME_CHARS, '').trim();
  return clean.length === 0 ? null : clean.slice(0, 255);
}
