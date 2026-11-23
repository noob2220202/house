import type { ImageVariant } from '../constants/media';
import type { MediaPurpose, MediaStatus, MediaVisibility } from '../enums/media';

export interface MediaVariantView {
  url: string;
  width: number;
  height: number;
}

/** Media as anyone may see it (READY public files, or the caller's own uploads). */
export interface MediaView {
  id: string;
  purpose: MediaPurpose;
  visibility: MediaVisibility;
  status: MediaStatus;
  /** MIME type of the stored file (public images are stored as image/webp). */
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  /** Public URL of the full-size (sanitized) image; null for private files or until READY. */
  url: string | null;
  /** Public variant URLs; empty for private files or until READY. */
  variants: Partial<Record<ImageVariant, MediaVariantView>>;
  createdAt: string;
}

/** The uploader's own view: adds the file name, processing error and whether it is in use. */
export interface OwnMediaView extends MediaView {
  originalFilename: string | null;
  error: string | null;
  attached: boolean;
}

/** Where a media is referenced (counts per owning table). */
export interface MediaReferenceCounts {
  listingPhotos: number;
  complexPhotos: number;
  dealRequestPhotos: number;
  agencyDocuments: number;
  agencyLogos: number;
  bannersPc: number;
  bannersMobile: number;
  popups: number;
}

export interface AdminMediaView extends OwnMediaView {
  ownerUserId: string | null;
  ownerAdminId: string | null;
  sha256: string;
  deletedAt: string | null;
  references: MediaReferenceCounts;
}

export interface MediaCleanupResult {
  /** Unattached uploads older than the grace period that were soft-deleted. */
  orphaned: number;
  /** PENDING uploads stuck longer than the grace period, marked FAILED. */
  staleFailed: number;
  /** Soft-deleted rows whose files were removed and rows purged. */
  purged: number;
}
