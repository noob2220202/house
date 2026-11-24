import { AssetType } from '@house/shared';
import { mockUuid } from '@/lib/mock';

/**
 * "사람들이 자주 찾는 단지" ranking rows (mockdata.md §1, Main.dc.html). Self-contained on purpose:
 * ids follow the complexes fixtures (`mockUuid('C01')`) but nothing is imported from them.
 */
export interface MockPopularComplex {
  rank: number;
  /** Positions moved since last week: + up, − down, 0 flat, null = new entry. */
  rankDelta: number | null;
  /** Consecutive weeks at this rank (only meaningful for #1). */
  rankStreakWeeks: number | null;
  weeklyViewCount: number;
  id: string;
  assetType: AssetType;
  name: string;
  emdName: string;
  lat: number;
  lng: number;
  households: number | null;
  builtYear: number | null;
  /** Active listings per deal type (co-brokered listings count once). */
  dealCounts: { presale: number; sale: number; jeonse: number; monthly: number };
  activeListingCount: number;
  /** 매매 호가 range of the representative 평형 (만원). */
  salePriceMin: number | null;
  salePriceMax: number | null;
  representativeAreaLabel: string | null;
  /** 만원 / 평 */
  pricePerPyeong: number | null;
  /** Latest trade (or 분양권 / 분양가 reference) shown in the "최근 거래" column. */
  latestTrade: { price: number; areaLabel: string; note: string | null } | null;
}

function row(
  rank: number,
  rankDelta: number | null,
  code: string,
  name: string,
  emdName: string,
  pos: [number, number],
  households: number,
  builtYear: number,
  counts: [number, number, number, number],
  sale: [number, number] | null,
  areaLabel: string,
  pricePerPyeong: number,
  latest: [number, string, string | null],
  weeklyViewCount: number,
): MockPopularComplex {
  return {
    rank,
    rankDelta,
    rankStreakWeeks: rank === 1 ? 3 : null,
    weeklyViewCount,
    id: mockUuid(code),
    assetType: AssetType.APT,
    name,
    emdName,
    lat: pos[0],
    lng: pos[1],
    households,
    builtYear,
    dealCounts: { presale: counts[0], sale: counts[1], jeonse: counts[2], monthly: counts[3] },
    activeListingCount: counts.reduce((a, b) => a + b, 0),
    salePriceMin: sale?.[0] ?? null,
    salePriceMax: sale?.[1] ?? null,
    representativeAreaLabel: areaLabel,
    pricePerPyeong,
    latestTrade: { price: latest[0], areaLabel: latest[1], note: latest[2] },
  };
}

export const POPULAR_COMPLEXES: readonly MockPopularComplex[] = [
  row(
    1,
    0,
    'C01',
    '신대 레이크파크 1단지',
    '해룡면 신대리',
    [34.9335, 127.556],
    1412,
    2019,
    [0, 38, 12, 6],
    [39000, 48500],
    '34평',
    1180,
    [43500, '34평', null],
    2418,
  ),
  row(
    2,
    2,
    'C02',
    '연향 센트럴',
    '연향동',
    [34.9395, 127.5215],
    980,
    2016,
    [0, 24, 9, 5],
    [32000, 39500],
    '32평',
    1090,
    [36000, '32평', null],
    1986,
  ),
  row(
    3,
    -1,
    'C03',
    '선월 하이츠 2차',
    '해룡면 선월리',
    [34.92, 127.57],
    1120,
    2027,
    [46, 5, 0, 2],
    [33800, 43500],
    '33평',
    1240,
    [41900, '33평', '분양권'],
    1812,
  ),
  row(
    4,
    1,
    'C04',
    '조례 호수마을',
    '조례동',
    [34.96, 127.523],
    860,
    2009,
    [0, 19, 7, 4],
    [26500, 31000],
    '32평',
    940,
    [29800, '32평', null],
    1540,
  ),
  row(
    5,
    -2,
    'C05',
    '오천 그린빌',
    '오천동',
    [34.929, 127.501],
    724,
    2012,
    [0, 17, 6, 8],
    [23500, 29000],
    '24평',
    1020,
    [25200, '24평', null],
    1322,
  ),
  row(
    6,
    0,
    'C06',
    '신대 레이크파크 3단지',
    '해룡면 신대리',
    [34.9318, 127.5592],
    1036,
    2020,
    [0, 21, 8, 2],
    [38000, 46000],
    '33평',
    1160,
    [41000, '33평', null],
    1208,
  ),
  row(
    7,
    1,
    'C07',
    '금당 리버뷰',
    '연향동',
    [34.944, 127.527],
    808,
    2005,
    [0, 14, 5, 3],
    [24000, 29800],
    '31평',
    880,
    [27500, '31평', null],
    1034,
  ),
  row(
    8,
    -1,
    'C08',
    '왕지 숲속마을',
    '왕지동',
    [34.97, 127.54],
    652,
    2011,
    [0, 12, 4, 6],
    [21000, 26000],
    '25평',
    860,
    [23800, '25평', null],
    962,
  ),
  row(
    9,
    null,
    'C09',
    '연향들 더 퍼스트',
    '연향동',
    [34.9412, 127.5298],
    612,
    2029,
    [58, 0, 0, 0],
    null,
    '34평',
    1260,
    [42800, '34평', '분양가'],
    904,
  ),
];
