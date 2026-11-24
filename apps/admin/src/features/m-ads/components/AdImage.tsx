import Image from 'next/image';

export interface AdImageProps {
  src: string;
  alt: string;
  /** `sizes` hint for the optimiser, e.g. "84px". */
  sizes: string;
  fit?: 'cover' | 'contain';
  /**
   * `object-position` for cropped thumbnails. Ad creatives carry their headline on the left, so
   * small `cover` thumbs anchor there ("left center") instead of cutting both ends.
   */
  position?: string;
  priority?: boolean;
}

/** Only backend media paths go through the Next image optimiser; blobs, SVG stand-ins and unknown hosts are served as-is. */
const optimizable = (src: string) => src.startsWith('/media/') && !/\.svg(\?|$)/i.test(src);

/** Ad creative filling its (positioned) parent. */
export function AdImage({ src, alt, sizes, fit = 'cover', position, priority }: AdImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={!optimizable(src)}
      style={{ objectFit: fit, objectPosition: position }}
      draggable={false}
    />
  );
}
