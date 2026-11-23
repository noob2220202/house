export const IMAGE_VARIANTS = {
  thumb: { width: 320, height: 240, fit: 'cover' },
  medium: { width: 960, height: 720, fit: 'inside' },
  large: { width: 1920, height: 1440, fit: 'inside' },
} as const;
export type ImageVariant = keyof typeof IMAGE_VARIANTS;

export const ALLOWED_IMAGE_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;
export const ALLOWED_DOCUMENT_MIME = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export const MAX_LISTING_PHOTOS = 30;
