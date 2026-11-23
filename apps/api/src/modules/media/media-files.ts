import { IMAGE_VARIANTS, MediaVisibility, type ImageVariant } from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { ProcessedImage } from './image-processor';
import { MediaStorage } from './media-storage';
import type { StoredVariants } from './media.mapper';

const VARIANT_NAMES = Object.keys(IMAGE_VARIANTS) as ImageVariant[];

/** File layout of a media row: the full-size image + its variants, a private file, staging. */
@Injectable()
export class MediaFiles {
  constructor(private readonly storage: MediaStorage) {}

  /** Writes the full-size image and its variants; returns the `variants` column value. */
  async writeImage(key: string, processed: ProcessedImage): Promise<StoredVariants> {
    const variants: StoredVariants = {};
    const writes = [this.storage.write(MediaVisibility.PUBLIC, key, processed.original.data)];
    for (const name of VARIANT_NAMES) {
      const v = processed.variants[name];
      const vKey = this.storage.variantKey(key, name);
      variants[name] = { key: vKey, width: v.width, height: v.height };
      writes.push(this.storage.write(MediaVisibility.PUBLIC, vKey, v.data));
    }
    const results = await Promise.allSettled(writes);
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failed) {
      await this.removeImage(key);
      throw failed.reason;
    }
    return variants;
  }

  removeImage(key: string): Promise<void> {
    return this.storage.remove(MediaVisibility.PUBLIC, this.imageKeys(key));
  }

  /** Idempotent: missing files are ignored. */
  async removeAll(row: { id: string; storageKey: string; visibility: MediaVisibility }) {
    const keys =
      row.visibility === MediaVisibility.PUBLIC ? this.imageKeys(row.storageKey) : [row.storageKey];
    await Promise.all([
      this.storage.remove(row.visibility, keys),
      this.storage.removeStaging(row.id),
    ]);
  }

  private imageKeys(key: string): string[] {
    return [key, ...VARIANT_NAMES.map((v) => this.storage.variantKey(key, v))];
  }
}
