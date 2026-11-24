import type { BannerSlot } from '@house/shared';
import type { ReactNode } from 'react';

const LINE = 'var(--line-strong)';
const SOFT = 'var(--grey-150)';
const HOT = 'var(--brand)';
const DOT = 'var(--grey-300)';

const frame = (
  <>
    <rect
      x=".75"
      y=".75"
      width="44.5"
      height="32.5"
      rx="5"
      fill="var(--surface)"
      stroke={LINE}
      strokeWidth="1.5"
    />
    <path d="M1.5 7.5h43" stroke={SOFT} strokeWidth="1.5" />
    <circle cx="6" cy="4.2" r="1.3" fill={DOT} />
  </>
);
const outline = (
  <rect
    x=".75"
    y=".75"
    width="44.5"
    height="32.5"
    rx="5"
    fill="none"
    stroke={LINE}
    strokeWidth="1.5"
  />
);

/** Where the slot sits on its page (blue block), drawn as a tiny browser window — per the design. */
const GLYPHS: Record<BannerSlot, ReactNode> = {
  MAIN_HERO: (
    <>
      {frame}
      <rect x="6" y="11" width="34" height="8" rx="2" fill={HOT} />
      <rect x="6" y="22.5" width="10" height="6" rx="1.5" fill={SOFT} />
      <rect x="18" y="22.5" width="10" height="6" rx="1.5" fill={SOFT} />
      <rect x="30" y="22.5" width="10" height="6" rx="1.5" fill={SOFT} />
    </>
  ),
  MAIN_STRIP: (
    <>
      {frame}
      <rect x="6" y="11" width="34" height="5" rx="1.5" fill={SOFT} />
      <rect x="6" y="19" width="34" height="3" rx="1.5" fill={HOT} />
      <rect x="6" y="25" width="15" height="4" rx="1.5" fill={SOFT} />
      <rect x="25" y="25" width="15" height="4" rx="1.5" fill={SOFT} />
    </>
  ),
  MAP_AD: (
    <>
      {frame}
      <rect x="1.5" y="8.25" width="43" height="24.25" fill="var(--map-land)" />
      <path
        d="M28 8.5c-2 6 4 9 1 14s-6 6-5 10"
        fill="none"
        stroke="var(--map-water)"
        strokeWidth="2.4"
      />
      <rect x="5" y="11.5" width="14" height="10" rx="2" fill={HOT} />
      <circle cx="35" cy="15" r="2.2" fill={DOT} />
      <circle cx="31" cy="26" r="2.2" fill={DOT} />
      {outline}
    </>
  ),
  COMPLEX_FEATURED_AGENCY: (
    <>
      {frame}
      <rect x="17" y="8.25" width="27.5" height="24.25" fill="var(--map-land)" />
      <path d="M17 8.25v24.5" stroke={SOFT} strokeWidth="1.5" />
      <rect x="4.5" y="11" width="10" height="6" rx="1.5" fill={HOT} />
      <rect x="4.5" y="20" width="10" height="2.5" rx="1" fill={SOFT} />
      <rect x="4.5" y="25" width="10" height="2.5" rx="1" fill={SOFT} />
      <circle cx="30" cy="19" r="2.2" fill={DOT} />
      {outline}
    </>
  ),
  LISTING_SIDE: (
    <>
      {frame}
      <rect x="6" y="11" width="18" height="9" rx="1.5" fill={SOFT} />
      <rect x="6" y="23" width="18" height="2.5" rx="1" fill={SOFT} />
      <rect x="6" y="27.5" width="12" height="2.5" rx="1" fill={SOFT} />
      <rect x="28" y="11" width="12" height="11" rx="1.5" fill={HOT} />
    </>
  ),
  AGENCY_SEARCH_TOP: (
    <>
      {frame}
      <rect x="6" y="11" width="34" height="5" rx="1.5" fill={HOT} />
      <rect x="6" y="19" width="34" height="4" rx="1.5" fill={SOFT} />
      <rect x="6" y="25.5" width="34" height="4" rx="1.5" fill={SOFT} />
    </>
  ),
  MOBILE_MAIN: (
    <>
      <rect
        x="13.75"
        y=".75"
        width="18.5"
        height="32.5"
        rx="4.5"
        fill="var(--surface)"
        stroke={LINE}
        strokeWidth="1.5"
      />
      <rect x="20" y="3.2" width="6" height="1.6" rx=".8" fill={DOT} />
      <rect x="16.5" y="8" width="13" height="9" rx="1.8" fill={HOT} />
      <rect x="16.5" y="19.5" width="13" height="4" rx="1.2" fill={SOFT} />
      <rect x="16.5" y="25.5" width="13" height="4" rx="1.2" fill={SOFT} />
    </>
  ),
};

export function SlotGlyph({ slot, className }: { slot: BannerSlot; className?: string }) {
  return (
    <svg className={className} width="46" height="34" viewBox="0 0 46 34" aria-hidden="true">
      {GLYPHS[slot]}
    </svg>
  );
}
