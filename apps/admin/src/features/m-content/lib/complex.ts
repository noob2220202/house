import { SQM_PER_PYEONG } from '@house/shared';

/** "34평" from the supply area (the convention on listings), falling back to the exclusive area. */
export function suggestPyeongLabel(exclusive: number | null, supply: number | null): string | null {
  const base = supply && supply > 0 ? supply : exclusive;
  if (!base || !Number.isFinite(base) || base <= 0) return null;
  return `${Math.round(base / SQM_PER_PYEONG)}평`;
}

export const PHOTO_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PHOTO_MAX_COUNT = 20;

/** Client-side pre-check of a complex photo; returns a Korean message or null when the file is fine. */
export function photoFileError(file: { type: string; size: number }): string | null {
  if (!(PHOTO_MIME as readonly string[]).includes(file.type))
    return 'JPG, PNG, WebP 이미지만 올릴 수 있어요.';
  if (file.size > PHOTO_MAX_BYTES) return '10MB보다 큰 파일은 올릴 수 없어요.';
  if (file.size === 0) return '빈 파일이에요.';
  return null;
}

/**
 * Splits dropped files into the ones that fit under the photo limit and the ones that do not.
 * `existing` = photos already on the complex.
 */
export function takeWithinLimit<T>(
  files: readonly T[],
  existing: number,
): { accepted: T[]; rejected: T[] } {
  const room = Math.max(0, PHOTO_MAX_COUNT - existing);
  return { accepted: files.slice(0, room), rejected: files.slice(room) };
}
