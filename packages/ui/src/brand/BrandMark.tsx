import type { ImgHTMLAttributes } from 'react';

/**
 * The ONE brand mark: 순천부동산지도 app icon (design/brand/app-icon-b-1024.png).
 * Each app serves it from public/brand/mark.png. Replace that file (and `name` in
 * apps/<app>/src/config/brand.ts) to rebrand.
 */
export function BrandMark({
  size = 32,
  style,
  ...rest
}: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'children' | 'width' | 'height'> & {
  size?: number;
}) {
  return (
    <img
      src="/brand/mark.png"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      decoding="async"
      style={{
        display: 'block',
        flex: 'none',
        borderRadius: Math.round(size * 0.28),
        ...style,
      }}
      {...rest}
    />
  );
}
