import { MediaVisibility } from '@house/shared';
import type { ProcessedImage } from './image-processor';
import { MediaStorage } from './media-storage';
import type { StoredVariants } from './media.mapper';
/** File layout of a media row: the full-size image + its variants, a private file, staging. */
export declare class MediaFiles {
    private readonly storage;
    constructor(storage: MediaStorage);
    /** Writes the full-size image and its variants; returns the `variants` column value. */
    writeImage(key: string, processed: ProcessedImage): Promise<StoredVariants>;
    removeImage(key: string): Promise<void>;
    /** Idempotent: missing files are ignored. */
    removeAll(row: {
        id: string;
        storageKey: string;
        visibility: MediaVisibility;
    }): Promise<void>;
    private imageKeys;
}
