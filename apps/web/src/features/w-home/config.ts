import { AssetType, DealType } from '@house/shared';
import type { CategoryIconName } from '@house/ui';
import type { MapAssetSlug } from '@/config/nav';

/** Home categories = the five map entry points (GNB order). */
export interface HomeCategory {
  slug: MapAssetSlug;
  icon: CategoryIconName;
  label: string;
  caption: string;
  /** Backend asset types counted under / queried for this category. */
  assetTypes: readonly AssetType[];
}

export const HOME_CATEGORIES: readonly HomeCategory[] = [
  {
    slug: 'apt',
    icon: 'apt',
    label: '아파트·분양권',
    caption: '매매 · 전세 · 월세 · 분양권',
    assetTypes: [AssetType.APT],
  },
  {
    slug: 'oneroom',
    icon: 'room',
    label: '원룸·투룸',
    caption: '대학가 · 역세권 · 오피스텔',
    assetTypes: [AssetType.ONEROOM, AssetType.OFFICETEL],
  },
  {
    slug: 'house',
    icon: 'house',
    label: '주택',
    caption: '단독 · 다가구 · 전원주택',
    assetTypes: [AssetType.HOUSE],
  },
  {
    slug: 'commercial',
    icon: 'biz',
    label: '상업·업무',
    caption: '상가 · 사무실 · 건물',
    assetTypes: [AssetType.COMMERCIAL],
  },
  {
    slug: 'land',
    icon: 'land',
    label: '토지',
    caption: '대지 · 전 · 답 · 임야',
    assetTypes: [AssetType.LAND],
  },
];

export function categoryOf(slug: MapAssetSlug): HomeCategory {
  return HOME_CATEGORIES.find((c) => c.slug === slug) ?? HOME_CATEGORIES[0]!;
}

/** Deal pills above the hero search. `all` = no deal filter. */
export const HERO_DEALS = [
  { value: 'all', label: '전체' },
  { value: DealType.SALE, label: '매매' },
  { value: DealType.JEONSE, label: '전세' },
  { value: DealType.MONTHLY, label: '월세' },
  { value: DealType.PRESALE, label: '분양권' },
] as const;
export type HeroDeal = (typeof HERO_DEALS)[number]['value'];

/**
 * "많이 찾는" quick chips. Regions are matched by name against `GET /home/summary` (so the link
 * opens the map on that district); `fallback` is used when the district is not in the response.
 * Editorial for now — a candidate for the admin "메인 화면 편집".
 */
export interface QuickSearch {
  label: string;
  /** Region display name to look up. */
  region: string;
  asset: MapAssetSlug;
  fallback: { lat: number; lng: number };
  /** Extra map filter. */
  deal?: DealType;
  /** Only in the mobile chip row. */
  mobileOnly?: boolean;
  /** Only in the desktop chip row. */
  desktopOnly?: boolean;
}

export const QUICK_SEARCHES: readonly QuickSearch[] = [
  { label: '신대지구', region: '신대지구', asset: 'apt', fallback: { lat: 34.9335, lng: 127.556 } },
  { label: '오천지구', region: '오천지구', asset: 'apt', fallback: { lat: 34.927, lng: 127.506 } },
  { label: '연향동', region: '연향동', asset: 'apt', fallback: { lat: 34.944, lng: 127.522 } },
  { label: '조례동', region: '조례동', asset: 'apt', fallback: { lat: 34.9585, lng: 127.5245 } },
  {
    label: '선월 분양권',
    region: '선월지구',
    asset: 'apt',
    deal: DealType.PRESALE,
    fallback: { lat: 34.92, lng: 127.57 },
    mobileOnly: true,
  },
  {
    label: '순천대 원룸',
    region: '석현동',
    asset: 'oneroom',
    fallback: { lat: 34.969, lng: 127.483 },
  },
];

/** Map zoom used when a link opens the map on one district / one complex. */
export const REGION_ZOOM = 15;
export const COMPLEX_ZOOM = 17;

/**
 * District anchors on the stylized hero map (design: Main.dc.html `.hmap`), in % of the frame.
 * The art is not geographically exact, so known districts sit where the design drew them; anything
 * else is projected from lat/lng with `HERO_MAP_BOUNDS`. `mobile` = position ≤ 720px (the mobile
 * home has no hero map, but the tablet-width layout reuses the anchors); `wide` = desktop only.
 */
export const HERO_REGION_ANCHORS: Record<string, { x: number; y: number; wide?: boolean }> = {
  석현동: { x: 25, y: 21.3 },
  덕연동: { x: 17.33, y: 32.96, wide: true },
  조례동: { x: 71.67, y: 19.63 },
  왕지동: { x: 88.67, y: 42.59, wide: true },
  연향동: { x: 75.33, y: 52.22 },
  오천지구: { x: 35.67, y: 58.89 },
  신대지구: { x: 81.67, y: 74.07 },
  선월지구: { x: 87.33, y: 91.48, wide: true },
};

/** Rough extent of the hero art for projecting districts without an anchor. */
export const HERO_MAP_BOUNDS = {
  swLat: 34.905,
  swLng: 127.465,
  neLat: 34.995,
  neLng: 127.585,
} as const;

/** Place labels printed on the hero art (decorative). */
export const HERO_MAP_LABELS: readonly {
  text: string;
  x: number;
  y: number;
  kind: 'water' | 'park';
  wide?: boolean;
}[] = [
  { text: '동천', x: 52.33, y: 45.56, kind: 'water' },
  { text: '조례호수공원', x: 71.83, y: 42.59, kind: 'park', wide: true },
  { text: '봉화산', x: 15.67, y: 47.41, kind: 'park' },
  { text: '순천만국가정원', x: 66, y: 94.81, kind: 'park', wide: true },
  { text: '순천만', x: 93.33, y: 97.41, kind: 'water', wide: true },
];
export const HERO_MAP_STATION = { text: '순천역', x: 55, y: 59.26 } as const;

/** How many rows each home block asks for. */
/**
 * Data-cache window of the home's banner reads (seconds). Short so that a banner the admin saves
 * shows up within seconds: the API serve cache is version-bumped on every admin write, so this
 * window (plus one regeneration, the page is ISR) is all the delay there is. Notice popups are read
 * in the browser and need nothing here.
 */
export const BANNER_REVALIDATE_SECONDS = 15;

export const HOME_LIMITS = {
  ranking: 9,
  listings: 8,
  listingsShown: 4,
  videos: 4,
  agencies: 6,
} as const;
