import { MAX_LISTING_PHOTOS } from '@house/shared';

/** Photo as the wizard holds it (uploaded media + caption + cover flag). */
export interface PhotoValue {
  mediaId: string;
  /** Display URL (medium variant). */
  url: string;
  thumbUrl?: string | null;
  caption: string;
  isCover: boolean;
}

/** File-picker filter; the extensions let pickers that do not know the HEIC MIME type show iPhone photos. */
export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PHOTO_MAX_COUNT = MAX_LISTING_PHOTOS;
/** Suggested captions (also the mobile thumbnail labels on the public page). */
export const CAPTION_PRESETS = [
  '거실',
  '주방',
  '안방',
  '방',
  '욕실',
  '현관',
  '전망',
  '외관',
  '평면도',
] as const;

/** Exactly one cover: keeps the flagged one, otherwise the first photo. */
export function normalizeCover<T extends { isCover: boolean }>(photos: readonly T[]): T[] {
  if (photos.length === 0) return [];
  const coverIndex = Math.max(
    0,
    photos.findIndex((p) => p.isCover),
  );
  return photos.map((p, i) =>
    p.isCover === (i === coverIndex) ? p : { ...p, isCover: i === coverIndex },
  );
}

/** Moves the photo at `from` to position `to` (clamped). */
export function movePhoto<T>(photos: readonly T[], from: number, to: number): T[] {
  const next = [...photos];
  if (from < 0 || from >= next.length) return next;
  const target = Math.min(next.length - 1, Math.max(0, to));
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(target, 0, item);
  return next;
}

/** Makes one photo the cover and moves it to the front (the cover is the first tile publicly). */
export function setCover<T extends { mediaId: string; isCover: boolean }>(
  photos: readonly T[],
  mediaId: string,
): T[] {
  const index = photos.findIndex((p) => p.mediaId === mediaId);
  if (index < 0) return [...photos];
  return movePhoto(photos, index, 0).map((p, i) => ({ ...p, isCover: i === 0 }));
}

export function removePhoto<T extends { mediaId: string; isCover: boolean }>(
  photos: readonly T[],
  mediaId: string,
): T[] {
  return normalizeCover(photos.filter((p) => p.mediaId !== mediaId));
}

export interface FileCheck {
  accepted: File[];
  /** One message per rejected file. */
  rejected: string[];
}

/**
 * Browsers on Windows / Android often report an empty type for HEIC / HEIF files (iPhone photos
 * copied to a PC). Such files get their type from the extension; anything else is returned as is.
 */
export function withPhotoType(file: File): File {
  if (file.type !== '') return file;
  const ext = /\.(hei[cf])$/i.exec(file.name)?.[1]?.toLowerCase();
  if (!ext) return file;
  return new File([file], file.name, { type: `image/${ext}`, lastModified: file.lastModified });
}

/** Client-side pre-check of picked files (type, size, remaining slots). The server re-validates. */
export function checkPhotoFiles(picked: readonly File[], currentCount: number): FileCheck {
  const accepted: File[] = [];
  const rejected: string[] = [];
  const allowed = PHOTO_ACCEPT.split(',');
  let slots = PHOTO_MAX_COUNT - currentCount;
  for (const file of picked.map(withPhotoType)) {
    if (!allowed.includes(file.type)) {
      rejected.push(`${file.name}: JPG, PNG, WEBP, HEIC 사진만 올릴 수 있어요.`);
    } else if (file.size > PHOTO_MAX_BYTES) {
      rejected.push(`${file.name}: 10MB보다 큰 사진은 올릴 수 없어요.`);
    } else if (slots <= 0) {
      rejected.push(`${file.name}: 사진은 최대 ${PHOTO_MAX_COUNT}장까지 올릴 수 있어요.`);
    } else {
      accepted.push(file);
      slots -= 1;
    }
  }
  return { accepted, rejected };
}

/** Display + thumbnail URL of an uploaded photo, or null while the server is still processing it. */
export function variantUrls(media: {
  variants: Partial<Record<'thumb' | 'medium' | 'large', { url: string } | undefined>>;
}): { url: string; thumbUrl: string } | null {
  const { thumb, medium, large } = media.variants;
  const url = medium?.url ?? large?.url ?? thumb?.url;
  return url ? { url, thumbUrl: thumb?.url ?? url } : null;
}

/** Body of PUT /agency/listings/:id/photos — order = array order. */
export function toPhotosPayload(photos: readonly PhotoValue[]) {
  return {
    photos: normalizeCover(photos).map((p) => ({
      mediaId: p.mediaId,
      caption: p.caption.trim() || undefined,
      isCover: p.isCover,
    })),
  };
}

export const samePhotos = (a: readonly PhotoValue[], b: readonly PhotoValue[]): boolean =>
  a.length === b.length &&
  a.every((p, i) => {
    const q = b[i];
    return !!q && p.mediaId === q.mediaId && p.caption === q.caption && p.isCover === q.isCover;
  });
