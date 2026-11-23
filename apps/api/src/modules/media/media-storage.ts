import { randomBytes } from 'node:crypto';
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { MediaVisibility, type ImageVariant } from '@house/shared';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service';

const KEY_PATTERN = /^[a-z0-9][a-z0-9/_.-]*$/;
const UUID_PATTERN = /^[0-9a-f-]{36}$/;

/**
 * Local-disk storage. Keys are random and generated here only (no user-controlled path parts).
 *  - PUBLIC  → UPLOAD_DIR          (nginx serves it at MEDIA_BASE_URL, e.g. /media/*)
 *  - PRIVATE → PRIVATE_UPLOAD_DIR  (never served by nginx; authorized streaming only)
 * Raw uploads waiting for the worker sit in PRIVATE_UPLOAD_DIR/staging — they still carry EXIF
 * (GPS!) so they must never be under the public root.
 */
@Injectable()
export class MediaStorage {
  private readonly roots: Record<MediaVisibility, string>;
  private readonly baseUrl: string;

  constructor(config: AppConfig) {
    this.roots = {
      PUBLIC: path.resolve(config.get('UPLOAD_DIR')),
      PRIVATE: path.resolve(config.get('PRIVATE_UPLOAD_DIR')),
    };
    this.baseUrl = config.get('MEDIA_BASE_URL').replace(/\/+$/, '');
  }

  /** `img/2026/11/ab/<32 hex>.webp` — the sanitized full-size image; variants sit next to it. */
  newPublicImageKey(now: Date = new Date()): string {
    const rand = randomBytes(16).toString('hex');
    return `img/${monthPath(now)}/${rand.slice(0, 2)}/${rand}.webp`;
  }

  /** `doc/2026/11/<32 hex>.<ext>` under the private root. */
  newPrivateKey(ext: string, now: Date = new Date()): string {
    if (!/^[a-z0-9]{2,5}$/.test(ext)) throw new Error(`invalid extension "${ext}"`);
    return `doc/${monthPath(now)}/${randomBytes(16).toString('hex')}.${ext}`;
  }

  variantKey(originalKey: string, variant: ImageVariant): string {
    return originalKey.replace(/\.webp$/, `_${variant}.webp`);
  }

  publicUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }

  /** Absolute path of a key, or null if it would escape its root (defense in depth). */
  resolve(visibility: MediaVisibility, key: string): string | null {
    if (!KEY_PATTERN.test(key) || key.includes('..')) return null;
    const root = this.roots[visibility];
    const resolved = path.resolve(root, key);
    return resolved.startsWith(root + path.sep) ? resolved : null;
  }

  async write(visibility: MediaVisibility, key: string, data: Buffer): Promise<void> {
    const target = this.mustResolve(visibility, key);
    const isPrivate = visibility === MediaVisibility.PRIVATE;
    await mkdir(path.dirname(target), { recursive: true, mode: isPrivate ? 0o700 : 0o755 });
    // Write-then-rename so nginx never serves a half-written file.
    const tmp = `${target}.tmp-${randomBytes(6).toString('hex')}`;
    try {
      await writeFile(tmp, data, { mode: isPrivate ? 0o600 : 0o644, flag: 'wx' });
      await rename(tmp, target);
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }
  }

  /** Removes keys; missing files are fine (idempotent). */
  async remove(visibility: MediaVisibility, keys: readonly string[]): Promise<void> {
    await Promise.all(
      keys.map(async (key) => {
        const target = this.resolve(visibility, key);
        if (target) await rm(target, { force: true });
      }),
    );
  }

  async size(visibility: MediaVisibility, key: string): Promise<number | null> {
    const target = this.resolve(visibility, key);
    if (!target) return null;
    const info = await stat(target).catch(() => null);
    return info?.isFile() ? info.size : null;
  }

  open(visibility: MediaVisibility, key: string): ReadStream {
    return createReadStream(this.mustResolve(visibility, key));
  }

  stagingKey(mediaId: string): string {
    if (!UUID_PATTERN.test(mediaId)) throw new Error('invalid media id');
    return `staging/${mediaId}`;
  }

  writeStaging(mediaId: string, data: Buffer): Promise<void> {
    return this.write(MediaVisibility.PRIVATE, this.stagingKey(mediaId), data);
  }

  async readStaging(mediaId: string): Promise<Buffer | null> {
    const target = this.mustResolve(MediaVisibility.PRIVATE, this.stagingKey(mediaId));
    return readFile(target).catch((err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') return null;
      throw err;
    });
  }

  removeStaging(mediaId: string): Promise<void> {
    return this.remove(MediaVisibility.PRIVATE, [this.stagingKey(mediaId)]);
  }

  private mustResolve(visibility: MediaVisibility, key: string): string {
    const resolved = this.resolve(visibility, key);
    if (!resolved) throw new Error(`invalid storage key "${key}"`);
    return resolved;
  }
}

function monthPath(now: Date): string {
  return `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}
