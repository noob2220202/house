import { ListingOption } from '@house/shared';
import type { ReactNode, SVGProps } from 'react';
import type { NearbyCategory } from '../api/schemas';

/**
 * Extra stroke icons for the listing detail (options, nearby places) that are not in the shared
 * icon set. Same grid as `@house/ui` Icon: 24 × 24, stroke 1.75, round caps.
 */
export type ListingGlyph =
  | 'aircon'
  | 'fridge'
  | 'washer'
  | 'bed'
  | 'desk'
  | 'wardrobe'
  | 'cooktop'
  | 'dishwasher'
  | 'tv'
  | 'wifi'
  | 'elevator'
  | 'parking'
  | 'paw'
  | 'cctv'
  | 'guard'
  | 'balcony'
  | 'school'
  | 'tree'
  | 'cart'
  | 'train'
  | 'landmark'
  | 'hospital'
  | 'bulb'
  | 'shield-check'
  | 'message';

const PATHS: Record<ListingGlyph, ReactNode> = {
  aircon: (
    <>
      <rect x="3" y="5" width="18" height="8" rx="2" />
      <path d="M6.5 10h11M7 16.5v2M12 16.5v3M17 16.5v2" />
    </>
  ),
  fridge: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <path d="M6 10h12M9 6.5v1.5M9 13v3" />
    </>
  ),
  washer: (
    <>
      <rect x="4.5" y="3" width="15" height="18" rx="2" />
      <circle cx="12" cy="13.5" r="4" />
      <path d="M7.5 6.5h2M15.5 6.5h1" />
    </>
  ),
  bed: (
    <path d="M3 18.5v-11M3 14.5h18v4M21 14.5v-2.5a3 3 0 0 0-3-3h-7v5.5M6.8 11.4a1.6 1.6 0 1 0 0-.01" />
  ),
  desk: <path d="M3 8h18M5 8v11M19 8v11M12.5 8v5.5H19M12.5 11h6.5" />,
  wardrobe: (
    <>
      <rect x="4.5" y="3" width="15" height="17" rx="1.5" />
      <path d="M12 3v17M9.5 11v2M14.5 11v2M7 20v1.5M17 20v1.5" />
    </>
  ),
  cooktop: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="9" cy="12" r="2.4" />
      <circle cx="15.5" cy="12" r="1.6" />
    </>
  ),
  dishwasher: (
    <>
      <rect x="4.5" y="3" width="15" height="18" rx="2" />
      <path d="M4.5 8h15M8 5.5h1M9 15.5a3 3 0 0 0 6 0c0-1.6-3-4-3-4s-3 2.4-3 4z" />
    </>
  ),
  tv: (
    <>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8.5 20.5h7M12 17v3.5" />
    </>
  ),
  wifi: (
    <path d="M3.5 9.5a12.5 12.5 0 0 1 17 0M6.5 13a8 8 0 0 1 11 0M9.5 16.4a3.6 3.6 0 0 1 5 0M12 19.5v.01" />
  ),
  elevator: (
    <>
      <rect x="4.5" y="3" width="15" height="18" rx="2" />
      <path d="M12 3v18M7.2 10.5 8.5 8.8l1.3 1.7M14.2 13.5l1.3 1.7 1.3-1.7" />
    </>
  ),
  parking: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M9.5 16.5v-9h3.2a2.8 2.8 0 0 1 0 5.6H9.5" />
    </>
  ),
  paw: (
    <>
      <path d="M12 12.5c-2.6 0-4.6 2-4.6 4.2 0 1.5 1.2 2.3 2.6 2.3.8 0 1.3-.4 2-.4s1.2.4 2 .4c1.4 0 2.6-.8 2.6-2.3 0-2.2-2-4.2-4.6-4.2z" />
      <path d="M6 10.2v.6M9.5 6.6v.8M14.5 6.6v.8M18 10.2v.6" strokeWidth="2.6" />
    </>
  ),
  cctv: (
    <path d="m3.5 7 12.5 3.6-1.3 4.6L2.2 11.6zM16 10.6l4.5 1.3-.7 2.5-4.5-1.3M7 13v4.5H3M3 15.5v4" />
  ),
  guard: (
    <path d="M12 3 5 5.8v5.4c0 4.4 2.9 8.1 7 9.8 4.1-1.7 7-5.4 7-9.8V5.8zM9.5 12a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0z" />
  ),
  balcony: (
    <path d="M4 12h16v8H4zM8 12v8M12 12v8M16 12v8M6.5 12V5.5a1.5 1.5 0 0 1 1.5-1.500h8a1.5 1.5 0 0 1 1.5 1.5V12M12 4v8" />
  ),
  school: (
    <path d="M12 4.5 2.5 9.5l9.500 5 9.500-5zM6.5 12v4.200c1.500 1.500 3.400 2.300 5.500 2.300s4-.800 5.500-2.300V12M21.500 9.500v5" />
  ),
  tree: (
    <path d="M12 21v-6M12 15c-3.600 0-6-2.400-6-5.500C6 6 8.600 3 12 3s6 3 6 6.500c0 3.100-2.400 5.500-6 5.500zM12 15l-2.500-2.500M12 12l2-2" />
  ),
  cart: (
    <>
      <path d="M3 4.500h2.500l2.400 10.500h9.600l2-7.500H6.700" />
      <circle cx="9.500" cy="19" r="1.300" />
      <circle cx="16.500" cy="19" r="1.300" />
    </>
  ),
  train: (
    <>
      <rect x="5.500" y="3" width="13" height="14" rx="3" />
      <path d="M5.500 11h13M9 14v.01M15 14v.01M8.500 17 6.500 21M15.500 17l2 4M9.500 6.500h5" />
    </>
  ),
  landmark: (
    <path d="M3 20.500h18M5 20.500v-9M9.500 20.500v-9M14.500 20.500v-9M19 20.500v-9M3.500 11.500h17M12 3.500 3.500 8.500h17z" />
  ),
  hospital: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8.500v7M8.500 12h7" />
    </>
  ),
  bulb: (
    <path d="M9.500 18.500h5M10.500 21h3M12 3a6 6 0 0 0-3.600 10.800c.700.500 1.100 1.300 1.100 2.200h5c0-.900.400-1.700 1.100-2.200A6 6 0 0 0 12 3z" />
  ),
  'shield-check': (
    <path d="M12 3 5 5.800v5.400c0 4.400 2.900 8.100 7 9.800 4.100-1.700 7-5.400 7-9.800V5.800zM8.800 12.200l2.300 2.300 4.200-4.400" />
  ),
  message: (
    <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4.500 3.500V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM8 9.500h8M8 12.500h5" />
  ),
};

export interface GlyphProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: ListingGlyph;
  size?: number;
}

export function Glyph({ name, size = 20, style, ...rest }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flex: 'none', display: 'block', ...style }}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

/** Icon + short category for every listing option. */
export const OPTION_META: Record<ListingOption, { glyph: ListingGlyph; group: string }> = {
  [ListingOption.AIR_CONDITIONER]: { glyph: 'aircon', group: '냉방' },
  [ListingOption.REFRIGERATOR]: { glyph: 'fridge', group: '주방' },
  [ListingOption.WASHER]: { glyph: 'washer', group: '세탁' },
  [ListingOption.DRYER]: { glyph: 'washer', group: '세탁' },
  [ListingOption.BED]: { glyph: 'bed', group: '가구' },
  [ListingOption.DESK]: { glyph: 'desk', group: '가구' },
  [ListingOption.CLOSET]: { glyph: 'wardrobe', group: '수납' },
  [ListingOption.BUILT_IN_WARDROBE]: { glyph: 'wardrobe', group: '수납' },
  [ListingOption.SHOE_RACK]: { glyph: 'wardrobe', group: '현관' },
  [ListingOption.INDUCTION]: { glyph: 'cooktop', group: '주방' },
  [ListingOption.GAS_RANGE]: { glyph: 'cooktop', group: '주방' },
  [ListingOption.MICROWAVE]: { glyph: 'cooktop', group: '주방' },
  [ListingOption.DISHWASHER]: { glyph: 'dishwasher', group: '주방' },
  [ListingOption.TV]: { glyph: 'tv', group: '가전' },
  [ListingOption.WIFI]: { glyph: 'wifi', group: '통신' },
  [ListingOption.ELEVATOR]: { glyph: 'elevator', group: '공용' },
  [ListingOption.PARKING]: { glyph: 'parking', group: '공용' },
  [ListingOption.PET_ALLOWED]: { glyph: 'paw', group: '생활' },
  [ListingOption.SECURITY]: { glyph: 'guard', group: '보안' },
  [ListingOption.CCTV]: { glyph: 'cctv', group: '보안' },
  [ListingOption.VERANDA]: { glyph: 'balcony', group: '구조' },
  [ListingOption.BALCONY]: { glyph: 'balcony', group: '구조' },
};

export const NEARBY_GLYPH: Record<NearbyCategory, ListingGlyph> = {
  SCHOOL: 'school',
  PARK: 'tree',
  MART: 'cart',
  LANDMARK: 'landmark',
  TRANSIT: 'train',
  HOSPITAL: 'hospital',
};
