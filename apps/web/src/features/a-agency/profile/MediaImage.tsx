import Image from 'next/image';
import type { Media } from '../api/schemas';

export interface MediaImageProps {
  media: Media;
  alt: string;
  /** Preferred variant (falls back to whatever exists). */
  variant?: 'thumb' | 'medium' | 'large';
  sizes: string;
  priority?: boolean;
  /** `contain` for logos (never crop a wordmark), `cover` for photos. */
  fit?: 'cover' | 'contain';
  /**
   * Local preview (object URL of the picked file) shown while a fresh upload has no variants yet
   * (media processing is asynchronous: PENDING → READY).
   */
  previewUrl?: string;
}

/** Picks a variant URL of a MediaDto; undefined when the media has no public variants. */
export function mediaUrl(media: Media, variant: 'thumb' | 'medium' | 'large' = 'medium') {
  const v = media.variants;
  return (v[variant] ?? v.medium ?? v.large ?? v.thumb)?.url;
}

/**
 * `next/image` (fill) for a backend media object. Mock uploads are served by a route handler and
 * local previews are blob URLs — both are passed through unoptimized; real `/media/**` files go
 * through the image optimizer.
 */
export function MediaImage({
  media,
  alt,
  variant = 'medium',
  sizes,
  priority,
  fit = 'cover',
  previewUrl,
}: MediaImageProps) {
  const src = mediaUrl(media, variant) ?? previewUrl;
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={src.startsWith('/mock-api/') || src.startsWith('blob:')}
      style={{ objectFit: fit }}
    />
  );
}
