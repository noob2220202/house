import { mockUuid } from '@/lib/mock';

/**
 * Fixtures for the deal-requests mock (all fictional, from design/drafts/system/mockdata.md §1, §2, §4).
 * Shapes = src/features/w-deal/api/schemas.ts.
 */
export interface MockAgency {
  id: string;
  name: string;
  representativeName: string;
  phone: string;
  roadAddress: string;
  specialty: string;
  activeListingCount: number;
  avgResponseMinutes: number;
  logoUrl: null;
  /** Region codes (same provisional codes as the w-map mock) the office works in. */
  serviceCodes: string[];
}

// Provisional region codes — identical to src/app/mock-api/v1/map/_fixtures.ts (REGIONS).
export const SINDAE = '1215033028';
export const SEONWOL = '1215033029';
const YEONHYANG = '1215012100';
const JORYE = '1215012000';
const OCHEON = '1215011900';
const WANGJI = '1215012200';
const SEOKHYEON = '1215011000';
const DEOGWOL = '1215011700';
const JANGCHEON = '1215010400';
/** 신대·선월 (해룡면) — the design's "신대·선월 중개사무소 12곳". */
const HAERYONG = [SINDAE, SEONWOL];

const agency = (
  key: string,
  name: string,
  representativeName: string,
  roadAddress: string,
  specialty: string,
  activeListingCount: number,
  avgResponseMinutes: number,
  serviceCodes: string[],
): MockAgency => ({
  id: mockUuid(`agency-${key}`),
  name,
  representativeName,
  phone: '0610000000',
  roadAddress,
  specialty,
  activeListingCount,
  avgResponseMinutes,
  logoUrl: null,
  serviceCodes,
});

export const AGENCIES: MockAgency[] = [
  agency(
    'B01',
    '신대중앙 공인중개사사무소',
    '김서진',
    '순천시 해룡면 신대1로 18, 105호',
    '신대 레이크파크 단지 전문',
    62,
    12,
    HAERYONG,
  ),
  agency(
    'B05',
    '선월 분양권 공인중개사사무소',
    '정민재',
    '순천시 해룡면 선월로 30, 상가 B동 101호',
    '분양권 전문',
    51,
    10,
    HAERYONG,
  ),
  agency(
    'B02',
    '호수공원 공인중개사사무소',
    '한서윤',
    '순천시 조례동 호수공원길 24, 1층',
    '연향·조례 아파트 전문',
    46,
    8,
    [JORYE, YEONHYANG, ...HAERYONG],
  ),
  agency(
    'B03',
    '연향센트럴 공인중개사사무소',
    '박도현',
    '순천시 연향동 연향3로 41, 102호',
    '연향 센트럴 단지 전문',
    38,
    20,
    [YEONHYANG, ...HAERYONG],
  ),
  agency(
    'B04',
    '오천그린 공인중개사사무소',
    '이하린',
    '순천시 오천동 오천2길 7, 1층',
    '오천지구 전문',
    29,
    15,
    [OCHEON, ...HAERYONG],
  ),
  agency(
    'B06',
    '순천대정문 공인중개사사무소',
    '최유나',
    '순천시 석현동 대학로 15, 1층',
    '원룸·투룸 전문',
    74,
    6,
    [SEOKHYEON, DEOGWOL, JANGCHEON],
  ),
  agency(
    'B07',
    '금당리버 공인중개사사무소',
    '윤재희',
    '순천시 연향동 금당로 9, 103호',
    '금당지구 전문',
    22,
    25,
    [YEONHYANG, ...HAERYONG],
  ),
  agency(
    'B08',
    '왕지숲 공인중개사사무소',
    '강태오',
    '순천시 왕지동 왕지2로 33, 1층',
    '왕지·조례 전문',
    19,
    30,
    [WANGJI, JORYE],
  ),
  agency(
    'B09',
    '레이크파크 공인중개사사무소',
    '서지안',
    '순천시 해룡면 신대2로 52, 108호',
    '신대지구 아파트 전문',
    33,
    14,
    HAERYONG,
  ),
  agency(
    'B10',
    '신대호수 공인중개사사무소',
    '문예준',
    '순천시 해룡면 신대3로 11, 1층',
    '신대지구 상가·아파트',
    27,
    18,
    HAERYONG,
  ),
  agency(
    'B11',
    '선월하이츠 공인중개사사무소',
    '배수아',
    '순천시 해룡면 선월로 44, 102호',
    '선월지구 분양권',
    24,
    16,
    HAERYONG,
  ),
  agency(
    'B12',
    '해룡 공인중개사사무소',
    '임도윤',
    '순천시 해룡면 해룡로 120, 1층',
    '해룡면 토지·주택',
    17,
    35,
    HAERYONG,
  ),
  agency(
    'B13',
    '순천만 공인중개사사무소',
    '고은서',
    '순천시 해룡면 신대5로 6, 103호',
    '신대·선월 전세·월세',
    21,
    22,
    [...HAERYONG, OCHEON],
  ),
  agency(
    'B14',
    '연향들 공인중개사사무소',
    '송하준',
    '순천시 연향동 연향들길 3, 1층',
    '연향들 분양·토지',
    15,
    28,
    [YEONHYANG, JORYE, ...HAERYONG],
  ),
];

export const agencyByKey = (key: string): MockAgency => {
  const found = AGENCIES.find((a) => a.id === mockUuid(`agency-${key}`));
  if (!found) throw new Error(`unknown mock agency ${key}`);
  return found;
};

export interface MockComplex {
  id: string;
  name: string;
  emdCode: string;
  emdName: string;
  /** Substrings of a road address / building name that identify the complex. */
  match: string[];
  roadAddress: string;
  households: number;
  builtYear: number;
  floorsMax: number;
  lat: number;
  lng: number;
  areaTypes: { id: string; pyeongLabel: string; exclusiveArea: number; supplyArea: number }[];
  market: {
    recentTradePrice: number;
    recentTradeYm: string;
    recentTradePyeong: string;
    askingMin: number;
    askingMax: number;
    perPyeong: number;
  };
}

const areaType = (key: string, pyeong: number, exclusiveArea: number, supplyArea: number) => ({
  // Same id scheme as the complexes mock (areaTypeIdOf).
  id: mockUuid(`${key}-A${pyeong}`),
  pyeongLabel: `${pyeong}평`,
  exclusiveArea,
  supplyArea,
});

export const COMPLEXES: MockComplex[] = [
  {
    id: mockUuid('C01'),
    name: '신대 레이크파크 1단지',
    emdCode: SINDAE,
    emdName: '해룡면 신대리',
    match: ['신대2로 40', '레이크파크 1단지'],
    roadAddress: '전남 순천시 해룡면 신대2로 40',
    households: 1412,
    builtYear: 2019,
    floorsMax: 25,
    lat: 34.9372,
    lng: 127.5512,
    areaTypes: [
      areaType('C01', 34, 84.98, 112.4),
      areaType('C01', 25, 59.92, 82.6),
      areaType('C01', 41, 101.87, 135.5),
    ],
    market: {
      recentTradePrice: 43500,
      recentTradeYm: '2026-10',
      recentTradePyeong: '34평',
      askingMin: 39000,
      askingMax: 48500,
      perPyeong: 1180,
    },
  },
  {
    id: mockUuid('C02'),
    name: '연향 센트럴',
    emdCode: YEONHYANG,
    emdName: '연향동',
    match: ['연향3로 20', '연향 센트럴', '연향센트럴'],
    roadAddress: '전남 순천시 연향3로 20',
    households: 980,
    builtYear: 2016,
    floorsMax: 15,
    lat: 34.9489,
    lng: 127.5215,
    areaTypes: [areaType('C02', 32, 84.72, 105.9), areaType('C02', 24, 59.85, 79.3)],
    market: {
      recentTradePrice: 36000,
      recentTradeYm: '2026-10',
      recentTradePyeong: '32평',
      askingMin: 32000,
      askingMax: 39500,
      perPyeong: 1090,
    },
  },
  {
    id: mockUuid('C05'),
    name: '오천 그린빌',
    emdCode: OCHEON,
    emdName: '오천동',
    match: ['오천2길 30', '오천 그린빌', '오천그린빌'],
    roadAddress: '전남 순천시 오천2길 30',
    households: 724,
    builtYear: 2012,
    floorsMax: 20,
    lat: 34.9291,
    lng: 127.5098,
    areaTypes: [areaType('C05', 24, 59.76, 80.2), areaType('C05', 33, 84.91, 109.6)],
    market: {
      recentTradePrice: 25200,
      recentTradeYm: '2026-11',
      recentTradePyeong: '24평',
      askingMin: 23500,
      askingMax: 29000,
      perPyeong: 1020,
    },
  },
];
