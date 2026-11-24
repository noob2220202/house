import { AssetType } from '@house/shared';

/**
 * Home aggregates (mockdata.md §0). All fictional. `code` is a 법정동코드-shaped placeholder,
 * lat/lng are approximate centres used to open the map on that district.
 */
export interface MockRegion {
  code: string;
  /** Display name used on the site: 지구 name when it is better known than the 법정동. */
  name: string;
  emdName: string;
  lat: number;
  lng: number;
  listingCount: number;
  /** 만원 / 평 */
  avgPricePerPyeong: number;
  /** Active listings per asset type → used for the per-category ranking. */
  byAsset: Record<AssetType, number>;
  /** Share of 분양 / 매매 / 전세 / 월세 (sums to 1). */
  dealMix: readonly [number, number, number, number];
  weeklyViewCount: number;
  rankDelta: number | null;
}

const asset = (
  apt: number,
  officetel: number,
  oneroom: number,
  house: number,
  commercial: number,
  land: number,
): Record<AssetType, number> => ({
  APT: apt,
  OFFICETEL: officetel,
  ONEROOM: oneroom,
  HOUSE: house,
  COMMERCIAL: commercial,
  LAND: land,
});

export const REGIONS: readonly MockRegion[] = [
  {
    code: '1215012500',
    name: '연향동',
    emdName: '연향동',
    lat: 34.944,
    lng: 127.522,
    listingCount: 412,
    avgPricePerPyeong: 1090,
    byAsset: asset(196, 22, 84, 26, 62, 22),
    dealMix: [0.14, 0.46, 0.2, 0.2],
    weeklyViewCount: 9840,
    rankDelta: 1,
  },
  {
    code: '1215033028',
    name: '신대지구',
    emdName: '해룡면 신대리',
    lat: 34.9335,
    lng: 127.556,
    listingCount: 318,
    avgPricePerPyeong: 1180,
    byAsset: asset(214, 18, 22, 12, 34, 18),
    dealMix: [0.02, 0.62, 0.24, 0.12],
    weeklyViewCount: 11260,
    rankDelta: 0,
  },
  {
    code: '1215012400',
    name: '조례동',
    emdName: '조례동',
    lat: 34.9585,
    lng: 127.5245,
    listingCount: 286,
    avgPricePerPyeong: 940,
    byAsset: asset(128, 26, 58, 24, 38, 12),
    dealMix: [0, 0.5, 0.22, 0.28],
    weeklyViewCount: 7420,
    rankDelta: -1,
  },
  {
    code: '1215012700',
    name: '오천지구',
    emdName: '오천동',
    lat: 34.927,
    lng: 127.506,
    listingCount: 201,
    avgPricePerPyeong: 1020,
    byAsset: asset(118, 6, 14, 22, 21, 20),
    dealMix: [0, 0.56, 0.2, 0.24],
    weeklyViewCount: 5130,
    rankDelta: 2,
  },
  {
    code: '1215012300',
    name: '왕지동',
    emdName: '왕지동',
    lat: 34.97,
    lng: 127.53,
    listingCount: 154,
    avgPricePerPyeong: 860,
    byAsset: asset(72, 4, 18, 28, 14, 18),
    dealMix: [0, 0.52, 0.2, 0.28],
    weeklyViewCount: 3260,
    rankDelta: -1,
  },
  {
    code: '1215011500',
    name: '석현동',
    emdName: '석현동',
    lat: 34.969,
    lng: 127.483,
    listingCount: 121,
    avgPricePerPyeong: 780,
    byAsset: asset(8, 6, 86, 12, 7, 2),
    dealMix: [0, 0.1, 0.16, 0.74],
    weeklyViewCount: 4480,
    rankDelta: 1,
  },
  {
    code: '1215033027',
    name: '선월지구',
    emdName: '해룡면 선월리',
    lat: 34.92,
    lng: 127.57,
    listingCount: 97,
    avgPricePerPyeong: 1240,
    byAsset: asset(71, 0, 0, 4, 6, 16),
    dealMix: [0.72, 0.18, 0.04, 0.06],
    weeklyViewCount: 6050,
    rankDelta: null,
  },
  {
    code: '1215012600',
    name: '덕연동',
    emdName: '덕연동',
    lat: 34.949,
    lng: 127.502,
    listingCount: 88,
    avgPricePerPyeong: 720,
    byAsset: asset(24, 4, 30, 14, 12, 4),
    dealMix: [0, 0.4, 0.22, 0.38],
    weeklyViewCount: 1980,
    rankDelta: -2,
  },
];

/** GET /home/summary payload. */
export const HOME_SUMMARY = {
  regionName: '순천시',
  listingCount: 3201,
  agencyCount: 86,
  verifiedTodayCount: 128,
  /** Active listings per asset type (아파트·분양권 = APT, 원룸·투룸 = ONEROOM + OFFICETEL …). */
  assetTypeCounts: {
    [AssetType.APT]: 1284,
    [AssetType.OFFICETEL]: 212,
    [AssetType.ONEROOM]: 724,
    [AssetType.HOUSE]: 312,
    [AssetType.COMMERCIAL]: 248,
    [AssetType.LAND]: 421,
  },
  regions: REGIONS.map(({ code, name, emdName, lat, lng, listingCount, avgPricePerPyeong }) => ({
    code,
    name,
    emdName,
    lat,
    lng,
    listingCount,
    avgPricePerPyeong,
  })),
  updatedAt: '2026-11-23T06:00:00+09:00',
} as const;

/** Splits `total` by the 분/매/전/월 mix, keeping the sum exact. */
export function splitByDeal(total: number, mix: readonly [number, number, number, number]) {
  const presale = Math.round(total * mix[0]);
  const jeonse = Math.round(total * mix[2]);
  const monthly = Math.round(total * mix[3]);
  const sale = Math.max(0, total - presale - jeonse - monthly);
  return { presale, sale, jeonse, monthly };
}
