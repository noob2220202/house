import { ALLOWED_DOCUMENT_MIME, ALLOWED_IMAGE_MIME } from '../constants/media';
import { MediaPurpose, MediaVisibility } from '../enums/media';
import { UserRole } from '../enums/user';

/**
 * IMAGE: re-encoded to webp (auto-rotated, metadata stripped) with thumb/medium/large variants,
 * stored under the public media root.
 * DOCUMENT: private file (PDF as uploaded; images re-encoded without metadata), no variants,
 * served only through the authorized streaming endpoints.
 */
export const MediaKind = { IMAGE: 'IMAGE', DOCUMENT: 'DOCUMENT' } as const;
export type MediaKind = (typeof MediaKind)[keyof typeof MediaKind];

/** Who may upload a purpose: any site user, broker staff (AGENT/AGENCY_OWNER), or admins. */
export const MediaUploader = { USER: 'USER', AGENCY: 'AGENCY', ADMIN: 'ADMIN' } as const;
export type MediaUploader = (typeof MediaUploader)[keyof typeof MediaUploader];

export interface MediaPurposeRule {
  kind: MediaKind;
  visibility: MediaVisibility;
  /** Sniffed MIME types accepted for this purpose (HEIC/HEIF are converted). */
  accept: readonly string[];
  /** Per-file limit in bytes (the server's MAX_UPLOAD_MB caps it further). */
  maxBytes: number;
  uploaders: readonly MediaUploader[];
}

const MB = 1024 * 1024;
const DOCUMENT_ACCEPT: readonly string[] = [...ALLOWED_DOCUMENT_MIME, 'image/heic', 'image/heif'];

const image = (uploaders: readonly MediaUploader[], maxBytes = 15 * MB): MediaPurposeRule => ({
  kind: MediaKind.IMAGE,
  visibility: MediaVisibility.PUBLIC,
  accept: ALLOWED_IMAGE_MIME,
  maxBytes,
  uploaders,
});

export const MEDIA_PURPOSE_RULES: Record<MediaPurpose, MediaPurposeRule> = {
  LISTING_PHOTO: image([MediaUploader.AGENCY]),
  COMPLEX_PHOTO: image([MediaUploader.ADMIN]),
  DEAL_REQUEST_PHOTO: image([MediaUploader.USER]),
  AGENCY_LOGO: image([MediaUploader.USER], 5 * MB),
  AGENCY_DOCUMENT: {
    kind: MediaKind.DOCUMENT,
    visibility: MediaVisibility.PRIVATE,
    accept: DOCUMENT_ACCEPT,
    maxBytes: 10 * MB,
    uploaders: [MediaUploader.USER],
  },
  BANNER: image([MediaUploader.ADMIN], 10 * MB),
  POPUP: image([MediaUploader.ADMIN], 10 * MB),
  CONTENT: image([MediaUploader.ADMIN]),
  /**
   * Disabled until a profile image is linked by FK (User.profileImageUrl is a provider URL today):
   * unlinked uploads would be permanent, uncollectable public hosting.
   */
  PROFILE: image([], 5 * MB),
};

/** Limits per site user (admins are not limited). Daily upload count: DAILY_CAPS.MEDIA_UPLOAD. */
export const MEDIA_USER_QUOTA = {
  /** Total stored bytes of the user's live (non-deleted) uploads. */
  maxBytes: 2 * 1024 * MB,
  /** Number of live uploads. */
  maxFiles: 5000,
  /**
   * Uploads still waiting for background processing. Every image is processed by the worker, so
   * this must allow a full listing's photos (MAX_LISTING_PHOTOS = 30) uploaded at once.
   */
  maxPending: 40,
} as const;

/** Unattached uploads older than this are removed by the orphan cleanup job. */
export const MEDIA_ORPHAN_GRACE_HOURS = 24;

/**
 * Purposes whose references are not modeled as foreign keys yet (CONTENT images are embedded in
 * notice bodies by admins), so the orphan job must never collect them.
 */
export const MEDIA_ORPHAN_EXEMPT_PURPOSES: readonly MediaPurpose[] = [MediaPurpose.CONTENT];

/**
 * Purposes whose public metadata (GET /media/:id) is shown to the uploader only: deal-request
 * photos belong to a request that only the requester and permitted agencies may see.
 */
export const MEDIA_OWNER_ONLY_LOOKUP_PURPOSES: readonly MediaPurpose[] = [
  MediaPurpose.DEAL_REQUEST_PHOTO,
];

/**
 * Largest decoded image accepted (pixels); bigger images are rejected before processing.
 * 50 MP covers phone cameras (48/50 MP modes) and A4 scans at 600 dpi (~35 MP).
 */
export const MEDIA_MAX_INPUT_PIXELS = 50_000_000;

export function mediaRuleFor(purpose: MediaPurpose): MediaPurposeRule {
  return MEDIA_PURPOSE_RULES[purpose];
}

export function mediaVisibilityFor(purpose: MediaPurpose): MediaVisibility {
  return MEDIA_PURPOSE_RULES[purpose].visibility;
}

/** Effective per-file byte limit: the purpose limit capped by the server-wide limit. */
export function mediaMaxBytes(purpose: MediaPurpose, serverMaxBytes: number): number {
  return Math.min(MEDIA_PURPOSE_RULES[purpose].maxBytes, serverMaxBytes);
}

/** Whether a site user with `role` may upload `purpose`. */
export function canUserUpload(purpose: MediaPurpose, role: UserRole): boolean {
  const { uploaders } = MEDIA_PURPOSE_RULES[purpose];
  if (uploaders.includes(MediaUploader.USER)) return true;
  return (
    uploaders.includes(MediaUploader.AGENCY) &&
    (role === UserRole.AGENT || role === UserRole.AGENCY_OWNER)
  );
}

export function canAdminUpload(purpose: MediaPurpose): boolean {
  return MEDIA_PURPOSE_RULES[purpose].uploaders.includes(MediaUploader.ADMIN);
}

export function isAcceptedMime(purpose: MediaPurpose, mime: string): boolean {
  return MEDIA_PURPOSE_RULES[purpose].accept.includes(mime);
}
