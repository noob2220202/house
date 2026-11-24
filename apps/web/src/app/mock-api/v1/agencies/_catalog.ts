import type { AssetType } from '@house/shared';

/**
 * Listing catalogues for the mock agency listings (design/drafts/system/mockdata.md §1–3).
 * All names are fictional. Prices are integer 만원, areas in 평 (converted when listings are built).
 */

export interface PriceBase {
  sale: number;
  jeonse: number;
  /** [보증금, 월세] */
  monthly: [number, number];
  /** [분양가, 프리미엄] — only complexes that still trade 분양권. */
  presale?: [number, number];
}

export interface ComplexType extends PriceBase {
  py: number;
}

export interface ComplexDef {
  id: string;
  name: string;
  floors: number;
  types: ComplexType[];
}

export const COMPLEXES: Record<string, ComplexDef> = {
  C01: {
    id: 'C01',
    name: '신대 레이크파크 1단지',
    floors: 25,
    types: [
      { py: 25, sale: 39000, jeonse: 26000, monthly: [3000, 80] },
      { py: 34, sale: 44500, jeonse: 29000, monthly: [3000, 90] },
      { py: 41, sale: 48500, jeonse: 31000, monthly: [5000, 80] },
    ],
  },
  C02: {
    id: 'C02',
    name: '연향 센트럴',
    floors: 15,
    types: [
      { py: 24, sale: 32000, jeonse: 21000, monthly: [2000, 70] },
      { py: 32, sale: 36000, jeonse: 24000, monthly: [3000, 65] },
    ],
  },
  C03: {
    id: 'C03',
    name: '선월 하이츠 2차',
    floors: 20,
    types: [
      { py: 25, sale: 34500, jeonse: 22000, monthly: [2000, 75], presale: [35000, -1200] },
      { py: 33, sale: 42500, jeonse: 26000, monthly: [3000, 80], presale: [39200, 2700] },
    ],
  },
  C04: {
    id: 'C04',
    name: '조례 호수마을',
    floors: 18,
    types: [
      { py: 24, sale: 26500, jeonse: 18000, monthly: [2000, 65] },
      { py: 32, sale: 30500, jeonse: 21500, monthly: [3000, 55] },
    ],
  },
  C05: {
    id: 'C05',
    name: '오천 그린빌',
    floors: 20,
    types: [
      { py: 24, sale: 25200, jeonse: 16000, monthly: [1000, 60] },
      { py: 33, sale: 29000, jeonse: 20500, monthly: [2000, 55] },
    ],
  },
  C06: {
    id: 'C06',
    name: '신대 레이크파크 3단지',
    floors: 24,
    types: [
      { py: 33, sale: 41000, jeonse: 25000, monthly: [3000, 85] },
      { py: 39, sale: 46000, jeonse: 29500, monthly: [3000, 85] },
    ],
  },
  C07: {
    id: 'C07',
    name: '금당 리버뷰',
    floors: 15,
    types: [
      { py: 25, sale: 24000, jeonse: 16500, monthly: [1000, 55] },
      { py: 31, sale: 27500, jeonse: 19000, monthly: [2000, 45] },
    ],
  },
  C08: {
    id: 'C08',
    name: '왕지 숲속마을',
    floors: 15,
    types: [
      { py: 25, sale: 23800, jeonse: 16500, monthly: [1000, 50] },
      { py: 32, sale: 26000, jeonse: 18000, monthly: [2000, 40] },
    ],
  },
  C09: {
    id: 'C09',
    name: '연향들 더 퍼스트',
    floors: 29,
    types: [
      { py: 34, sale: 44000, jeonse: 27000, monthly: [3000, 90], presale: [42800, 1500] },
      { py: 39, sale: 49500, jeonse: 30000, monthly: [5000, 85], presale: [47600, 900] },
    ],
  },
};

/** Non-complex properties (원룸·주택·상가·토지). `floors: 0` = no building (land). */
export interface SimpleDef extends PriceBase {
  assetType: AssetType;
  title: string;
  py: number;
  floors: number;
  rooms?: number;
}

const ROOMS: SimpleDef[] = [
  {
    assetType: 'ONEROOM',
    title: '석현동 해오름빌',
    py: 14,
    floors: 4,
    sale: 9800,
    jeonse: 7000,
    monthly: [500, 42],
    rooms: 2,
  },
  {
    assetType: 'ONEROOM',
    title: '덕월동 청암하우스',
    py: 8,
    floors: 5,
    sale: 6200,
    jeonse: 4500,
    monthly: [300, 32],
    rooms: 1,
  },
  {
    assetType: 'ONEROOM',
    title: '석현동 그린캠퍼스',
    py: 11,
    floors: 5,
    sale: 8400,
    jeonse: 6000,
    monthly: [500, 38],
    rooms: 1,
  },
  {
    assetType: 'OFFICETEL',
    title: '조례동 호수뷰 오피스텔',
    py: 12,
    floors: 15,
    sale: 11500,
    jeonse: 9000,
    monthly: [1000, 45],
    rooms: 1,
  },
  {
    assetType: 'ONEROOM',
    title: '연향동 센트로빌',
    py: 15,
    floors: 4,
    sale: 12500,
    jeonse: 9500,
    monthly: [1000, 48],
    rooms: 2,
  },
  {
    assetType: 'ONEROOM',
    title: '장천동 역세권 스테이',
    py: 7,
    floors: 6,
    sale: 5800,
    jeonse: 4000,
    monthly: [200, 35],
    rooms: 1,
  },
];

const HOUSES: SimpleDef[] = [
  {
    assetType: 'HOUSE',
    title: '조례동 단독주택',
    py: 38,
    floors: 2,
    sale: 31000,
    jeonse: 17000,
    monthly: [3000, 70],
    rooms: 4,
  },
  {
    assetType: 'HOUSE',
    title: '왕지동 다가구주택',
    py: 62,
    floors: 3,
    sale: 58000,
    jeonse: 12000,
    monthly: [1000, 50],
    rooms: 3,
  },
  {
    assetType: 'HOUSE',
    title: '해룡면 전원주택',
    py: 45,
    floors: 2,
    sale: 42000,
    jeonse: 20000,
    monthly: [5000, 90],
    rooms: 4,
  },
];

const SHOPS: SimpleDef[] = [
  {
    assetType: 'COMMERCIAL',
    title: '연향동 패션거리 1층 상가',
    py: 18,
    floors: 5,
    sale: 52000,
    jeonse: 10000,
    monthly: [3000, 180],
  },
  {
    assetType: 'COMMERCIAL',
    title: '신대지구 중심상가 사무실',
    py: 24,
    floors: 8,
    sale: 38000,
    jeonse: 8000,
    monthly: [2000, 120],
  },
  {
    assetType: 'COMMERCIAL',
    title: '조례동 호수공원 앞 상가',
    py: 15,
    floors: 4,
    sale: 46000,
    jeonse: 9000,
    monthly: [3000, 150],
  },
];

const LANDS: SimpleDef[] = [
  {
    assetType: 'LAND',
    title: '해룡면 신대리 대지',
    py: 152,
    floors: 0,
    sale: 68000,
    jeonse: 0,
    monthly: [0, 0],
  },
  {
    assetType: 'LAND',
    title: '오천동 계획관리 토지',
    py: 310,
    floors: 0,
    sale: 43000,
    jeonse: 0,
    monthly: [0, 0],
  },
  {
    assetType: 'LAND',
    title: '왕지동 전 (농지)',
    py: 420,
    floors: 0,
    sale: 29500,
    jeonse: 0,
    monthly: [0, 0],
  },
];

export const DEFAULT_SIMPLE = ROOMS;

/** Catalogue per specialty (APT listings come from `COMPLEXES`). */
export const SIMPLE_BY_ASSET: Partial<Record<AssetType, SimpleDef[]>> = {
  ONEROOM: ROOMS,
  OFFICETEL: ROOMS.filter((r) => r.assetType === 'OFFICETEL'),
  HOUSE: HOUSES,
  COMMERCIAL: SHOPS,
  LAND: LANDS,
};
