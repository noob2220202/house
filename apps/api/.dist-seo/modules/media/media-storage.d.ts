import { type ReadStream } from 'node:fs';
import { MediaVisibility, type ImageVariant } from '@house/shared';
import { AppConfig } from '../../config/app-config.service';
/**
 * Local-disk storage. Keys are random and generated here only (no user-controlled path parts).
 *  - PUBLIC  → UPLOAD_DIR          (nginx serves it at MEDIA_BASE_URL, e.g. /media/*)
 *  - PRIVATE → PRIVATE_UPLOAD_DIR  (never served by nginx; authorized streaming only)
 * Raw uploads waiting for the worker sit in PRIVATE_UPLOAD_DIR/staging — they still carry EXIF
 * (GPS!) so they must never be under the public root.
 */
export declare class MediaStorage {
    private readonly roots;
    private readonly baseUrl;
    constructor(config: AppConfig);
    /** `img/2026/11/ab/<32 hex>.webp` — the sanitized full-size image; variants sit next to it. */
    newPublicImageKey(now?: Date): string;
    /** `doc/2026/11/<32 hex>.<ext>` under the private root. */
    newPrivateKey(ext: string, now?: Date): string;
    variantKey(originalKey: string, variant: ImageVariant): string;
    publicUrl(key: string): string;
    /** Absolute path of a key, or null if it would escape its root (defense in depth). */
    resolve(visibility: MediaVisibility, key: string): string | null;
    write(visibility: MediaVisibility, key: string, data: Buffer): Promise<void>;
    /** Removes keys; missing files are fine (idempotent). */
    remove(visibility: MediaVisibility, keys: readonly string[]): Promise<void>;
    size(visibility: MediaVisibility, key: string): Promise<number | null>;
    open(visibility: MediaVisibility, key: string): ReadStream;
    stagingKey(mediaId: string): string;
    writeStaging(mediaId: string, data: Buffer): Promise<void>;
    readStaging(mediaId: string): Promise<Buffer | null>;
    removeStaging(mediaId: string): Promise<void>;
    private mustResolve;
}
/**
 * Refuses to start when one root contains the other: nginx would then serve private documents
 * (or raw staging uploads with EXIF/GPS) under /media, or private paths would shadow public ones.
 */
export declare function assertDisjointRoots(publicRoot: string, privateRoot: string): void;
