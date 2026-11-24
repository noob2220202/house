import type { SVGProps } from 'react';

/**
 * The ONE brand mark SVG. Placeholder abstract mark (cobalt tile + arch + champagne dot).
 * Swap this component's paths (and `name` in apps/<app>/src/config/brand.ts) to rebrand.
 */
export function BrandMark({
  size = 32,
  ...rest
}: Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flex: 'none' }}
      {...rest}
    >
      <rect width="32" height="32" rx="9" fill="#1D4FF2" />
      <path
        d="M9 24v-7a7 7 0 0 1 14 0v7"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect x="13.6" y="17.6" width="4.8" height="6.4" rx="1.2" fill="#FFFFFF" />
      <rect x="21.6" y="6" width="4.4" height="4.4" rx="1.3" fill="#E9D7A8" />
    </svg>
  );
}
