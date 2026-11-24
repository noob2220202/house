/** Client-side checks for ad images (banner pc / mobile, popup) before they are uploaded. */
export interface ImageSize {
  width: number;
  height: number;
}

export interface ImageMeta extends ImageSize {
  /** File size in bytes. */
  bytes: number;
  /** MIME type reported by the browser. */
  type: string;
}

/** Formats the browser can measure and every client renders (no HEIC for ads). */
export const AD_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const AD_IMAGE_ACCEPT = AD_IMAGE_TYPES.join(',');
/** Hard cap for one ad image. Banners are above-the-fold: keep them light. */
export const AD_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
/** Allowed deviation of the aspect ratio from the slot spec (2%). */
export const RATIO_TOLERANCE = 0.02;

/** Popup image: shown at 380 × 300, uploaded at 2× (mockdata.md §6). */
export const POPUP_IMAGE_SPEC: ImageSize = { width: 760, height: 600 };

export type ImageIssueCode = 'TYPE' | 'TOO_LARGE' | 'TOO_SMALL' | 'RATIO';

export type ImageCheck =
  | { ok: true; note: string }
  | { ok: false; code: ImageIssueCode; message: string };

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10}MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

export const formatSize = (size: ImageSize, separator = ' × ') =>
  `${size.width}${separator}${size.height}`;

export function ratioMatches(size: ImageSize, spec: ImageSize, tolerance = RATIO_TOLERANCE) {
  if (size.width <= 0 || size.height <= 0) return false;
  const actual = size.width / size.height;
  const expected = spec.width / spec.height;
  return Math.abs(actual - expected) / expected <= tolerance;
}

/**
 * Validates an image against a slot spec: type → file size → minimum pixels → aspect ratio.
 * Larger images with the same ratio are fine (2× uploads); smaller or differently shaped ones are not.
 */
export function validateAdImage(
  meta: ImageMeta,
  spec: ImageSize,
  maxBytes: number = AD_IMAGE_MAX_BYTES,
): ImageCheck {
  if (!(AD_IMAGE_TYPES as readonly string[]).includes(meta.type))
    return { ok: false, code: 'TYPE', message: 'JPG, PNG, WebP 이미지만 올릴 수 있어요.' };
  if (meta.bytes > maxBytes)
    return {
      ok: false,
      code: 'TOO_LARGE',
      message: `파일이 너무 커요. ${formatBytes(maxBytes)} 이하로 줄여 주세요. (현재 ${formatBytes(meta.bytes)})`,
    };
  if (meta.width < spec.width || meta.height < spec.height)
    return {
      ok: false,
      code: 'TOO_SMALL',
      message: `이미지가 작아요. ${formatSize(spec)}px 이상이어야 해요. (현재 ${formatSize(meta)})`,
    };
  if (!ratioMatches(meta, spec))
    return {
      ok: false,
      code: 'RATIO',
      message: `비율이 맞지 않아요. ${formatSize(spec)} 비율로 올려 주세요. (현재 ${formatSize(meta)})`,
    };
  return { ok: true, note: '비율 일치' };
}

/** Reads the pixel size of an image file in the browser. */
export async function measureImage(file: Blob): Promise<ImageSize> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return size;
    } catch {
      // fall through to the <img> path (some browsers reject certain encodings here)
    }
  }
  return new Promise<ImageSize>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 읽지 못했어요.'));
    };
    img.src = url;
  });
}
