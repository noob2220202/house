import Image from 'next/image';

export interface MediaImageProps {
  src: string;
  alt: string;
  /** `sizes` hint for the optimizer (the image fills its positioned parent). */
  sizes: string;
  priority?: boolean;
  contain?: boolean;
  /**
   * Private file behind an authorized endpoint (report evidence): skip the image optimizer — it
   * would fetch without the admin cookie and keep a cached copy on disk.
   */
  restricted?: boolean;
}

/**
 * Backend media image (`/media/…`) through next/image, filling its positioned parent.
 * The mock API serves generated SVG stand-ins, which the optimizer does not accept — those are
 * passed through unoptimized (dev only).
 */
export function MediaImage({ src, alt, sizes, priority, contain, restricted }: MediaImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={restricted || src.startsWith('/mock-api/') || src.startsWith('blob:')}
      style={{ objectFit: contain ? 'contain' : 'cover' }}
    />
  );
}
