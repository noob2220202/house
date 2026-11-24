import { getImageProps } from 'next/image';
import { imageProps } from '@/lib/media';

export interface BannerPictureProps {
  /** PC creative. */
  src: string;
  /** Mobile creative (≤ 720px); the PC one is used when missing. */
  mobileSrc?: string | null;
  /** `sizes` of the PC creative. */
  sizes: string;
  /** `sizes` of the mobile creative (default 100vw). */
  mobileSizes?: string;
  /** Load at once (LCP banner in the first viewport) instead of lazily. */
  eager?: boolean;
  /** Decorative by default: the surrounding link names the banner. */
  alt?: string;
}

/**
 * Banner creative. The mobile creative is an art-directed <source> (≤ 720px) of ONE <img>, so a
 * phone downloads only the mobile file and a desktop only the PC one. Fills its (positioned) box.
 */
export function BannerPicture({
  src,
  mobileSrc,
  sizes,
  mobileSizes = '100vw',
  eager = false,
  alt = '',
}: BannerPictureProps) {
  const common = { alt, fill: true, draggable: false, loading: eager ? 'eager' : 'lazy' } as const;
  const { props: pc } = getImageProps({ ...common, ...imageProps(src), sizes });
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img {...pc} alt={alt} />;
  if (!mobileSrc) return img;
  const { props: m } = getImageProps({ ...common, ...imageProps(mobileSrc), sizes: mobileSizes });
  return (
    <picture>
      <source media="(max-width: 720px)" srcSet={m.srcSet ?? m.src} sizes={m.sizes} />
      {img}
    </picture>
  );
}
