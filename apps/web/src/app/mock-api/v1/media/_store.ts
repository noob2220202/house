/**
 * In-memory uploads of the media mock (globalThis so all route bundles share it; reset on restart).
 * Real backend: files live under UPLOAD_DIR and are served by nginx at /media/*.
 */
export interface MockMedia {
  id: string;
  purpose: string;
  mimeType: string;
  /** Original file name (shown for agency documents). */
  fileName: string;
  bytes: Uint8Array;
  createdAt: number;
}

const KEY = '__houseMockMedia' as const;
type GlobalWithMedia = typeof globalThis & { [KEY]?: Map<string, MockMedia> };

export const MOCK_MEDIA_LIMIT = 60;

export function mediaStore(): Map<string, MockMedia> {
  const g = globalThis as GlobalWithMedia;
  g[KEY] ??= new Map();
  return g[KEY];
}

/** Stored upload by id (used by agencies/mine and agencies/mine/documents). */
export function getMedia(id: string): MockMedia | undefined {
  return mediaStore().get(id);
}

/** Private purposes (agency documents) are never served publicly and have no variants. */
export function isPrivateMedia(media: Pick<MockMedia, 'purpose'>): boolean {
  return media.purpose === 'AGENCY_DOCUMENT';
}

/** MediaDto (packages/shared/src/schemas/media.ts). Private / non-image media has no variants. */
export function toMediaDto(m: MockMedia) {
  const url = `/mock-api/v1/media/${m.id}/file`;
  return {
    id: m.id,
    purpose: m.purpose,
    mimeType: m.mimeType,
    width: null,
    height: null,
    variants:
      isPrivateMedia(m) || !m.mimeType.startsWith('image/')
        ? {}
        : {
            thumb: { url, width: 320, height: 240 },
            medium: { url, width: 960, height: 720 },
            large: { url, width: 1920, height: 1440 },
          },
  };
}

/** MediaDto of a stored upload by id, or null when unknown. */
export function mediaDto(id: string) {
  const m = getMedia(id);
  return m ? toMediaDto(m) : null;
}
