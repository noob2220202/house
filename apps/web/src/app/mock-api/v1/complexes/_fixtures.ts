import type {
  ComplexAreaType,
  ComplexDetail,
  NearbyComplex,
  TradeRecord,
  TradeStat,
} from '@/features/w-complex/api/schemas';
import { mockUuid } from '@/lib/mock';

/**
 * Mock 단지 fixtures (all fictional, from design/drafts/system/mockdata.md §1 + the 신대지구 complexes
 * drawn on Complex.dc.html). Owned by w-complex; other groups may import from here.
 *
 * Ids are deterministic UUIDs (`mockUuid('C01')`); every lookup also accepts the short code ("C01").
 */

export interface MockAreaSpec {
  /** 공급 평형 label number: 34 → "34평". */
  pyeong: number;
  exclusive: number;
  supply: number;
  typeName: string;
  rooms: number;
  baths: number;
  households: number;
  /** Latest 매매 실거래가 (만원) and its month (YYYYMM). */
  sale: number;
  saleYm: number;
  /** Latest 전세 보증금 (만원). */
  jeonse: number;
  /** Typical 월세 [보증금, 월세] (만원). */
  monthly: readonly [number, number];
}

export interface MockComplexSpec {
  code: string;
  name: string;
  emdName: string;
  emdCode: string;
  districtName: string | null;
  road: string;
  jibun: string;
  lat: number;
  lng: number;
  households: number;
  buildings: number;
  floorsMin: number;
  floorsMax: number;
  approvalDate: string | null;
  builtYear: number;
  parkingPerHousehold: number;
  far: number;
  bcr: number;
  heating: string;
  builder: string | null;
  /** Active listings per deal type: 분양권 / 매매 / 전세 / 월세. */
  counts: readonly [number, number, number, number];
  /** First 동 number (101 → 101동, 102동 …). */
  dongStart: number;
  areas: readonly MockAreaSpec[];
  /** Average 매매 평당가 (만원/평, mockdata.md). */
  perPyeong: number;
  viewCount: number;
  favoriteCount: number;
}

const SINDAE = { lat: 34.9215, lng: 127.58 };
/** Offsets in metres from 레이크파크 1단지 (east, north) → lat/lng. */
const near = (eastM: number, northM: number) => ({
  lat: Number((SINDAE.lat + northM / 111_000).toFixed(6)),
  lng: Number((SINDAE.lng + eastM / 91_200).toFixed(6)),
});

const area = (
  pyeong: number,
  exclusive: number,
  supply: number,
  typeName: string,
  rooms: number,
  baths: number,
  households: number,
  sale: number,
  saleYm: number,
  jeonse: number,
  monthly: readonly [number, number],
): MockAreaSpec => ({
  pyeong,
  exclusive,
  supply,
  typeName,
  rooms,
  baths,
  households,
  sale,
  saleYm,
  jeonse,
  monthly,
});

const HEAT = '개별난방 (도시가스)';

export const COMPLEX_SPECS: readonly MockComplexSpec[] = [
  {
    code: 'C01',
    name: '신대 레이크파크 1단지',
    emdName: '해룡면 신대리',
    emdCode: '1215033028',
    districtName: '신대지구',
    road: '전라남도 순천시 해룡면 신대1로 30',
    jibun: '전라남도 순천시 해룡면 신대리 2001',
    ...SINDAE,
    households: 1412,
    buildings: 12,
    floorsMin: 18,
    floorsMax: 25,
    approvalDate: '2019-06-28',
    builtYear: 2019,
    parkingPerHousehold: 1.38,
    far: 229,
    bcr: 17.4,
    heating: HEAT,
    builder: '레이크파크건설(주)',
    counts: [0, 38, 12, 6],
    dongStart: 101,
    areas: [
      area(25, 59.97, 82.64, '59A', 3, 2, 412, 31000, 202608, 22000, [3000, 90]),
      area(34, 84.98, 112.4, '84A', 3, 2, 724, 43500, 202610, 27500, [5000, 80]),
      area(41, 101.92, 135.54, '101A', 4, 2, 276, 48000, 202607, 30500, [5000, 110]),
    ],
    perPyeong: 1180,
    viewCount: 18420,
    favoriteCount: 312,
  },
  {
    code: 'C02',
    name: '연향 센트럴',
    emdName: '연향동',
    emdCode: '1215012100',
    districtName: '연향지구',
    road: '전라남도 순천시 연향3로 52',
    jibun: '전라남도 순천시 연향동 1502',
    lat: 34.949,
    lng: 127.534,
    households: 980,
    buildings: 9,
    floorsMin: 12,
    floorsMax: 15,
    approvalDate: '2016-03-18',
    builtYear: 2016,
    parkingPerHousehold: 1.21,
    far: 218,
    bcr: 18.9,
    heating: HEAT,
    builder: '센트럴종합건설(주)',
    counts: [0, 24, 9, 5],
    dongStart: 101,
    areas: [
      area(24, 59.84, 79.9, '59A', 3, 2, 420, 30500, 202609, 21000, [2000, 70]),
      area(32, 84.72, 106.2, '84A', 3, 2, 560, 36000, 202610, 24000, [3000, 65]),
    ],
    perPyeong: 1090,
    viewCount: 12980,
    favoriteCount: 201,
  },
  {
    code: 'C03',
    name: '선월 하이츠 2차',
    emdName: '해룡면 선월리',
    emdCode: '1215033029',
    districtName: '선월지구',
    road: '전라남도 순천시 해룡면 선월로 88',
    jibun: '전라남도 순천시 해룡면 선월리 1180',
    lat: 34.912,
    lng: 127.57,
    households: 1120,
    buildings: 10,
    floorsMin: 15,
    floorsMax: 20,
    approvalDate: null,
    builtYear: 2027,
    parkingPerHousehold: 1.45,
    far: 224,
    bcr: 16.8,
    heating: HEAT,
    builder: '하이츠건설(주)',
    counts: [46, 5, 0, 2],
    dongStart: 201,
    areas: [
      area(25, 59.95, 83.1, '59A', 3, 2, 480, 33800, 202609, 21500, [2000, 80]),
      area(33, 84.9, 110.3, '84A', 3, 2, 640, 41900, 202610, 26000, [3000, 85]),
    ],
    perPyeong: 1240,
    viewCount: 15110,
    favoriteCount: 254,
  },
  {
    code: 'C04',
    name: '조례 호수마을',
    emdName: '조례동',
    emdCode: '1215011900',
    districtName: null,
    road: '전라남도 순천시 호수공원길 61',
    jibun: '전라남도 순천시 조례동 1720',
    lat: 34.964,
    lng: 127.53,
    households: 860,
    buildings: 8,
    floorsMin: 15,
    floorsMax: 18,
    approvalDate: '2009-10-09',
    builtYear: 2009,
    parkingPerHousehold: 1.12,
    far: 236,
    bcr: 19.6,
    heating: HEAT,
    builder: null,
    counts: [0, 19, 7, 4],
    dongStart: 101,
    areas: [
      area(24, 59.76, 80.2, '59', 3, 1, 380, 26800, 202609, 18500, [2000, 65]),
      area(32, 84.81, 105.9, '84', 3, 2, 480, 29800, 202610, 21000, [3000, 55]),
    ],
    perPyeong: 940,
    viewCount: 9870,
    favoriteCount: 143,
  },
  {
    code: 'C05',
    name: '오천 그린빌',
    emdName: '오천동',
    emdCode: '1215012600',
    districtName: '오천지구',
    road: '전라남도 순천시 오천2길 21',
    jibun: '전라남도 순천시 오천동 860',
    lat: 34.9165,
    lng: 127.5,
    households: 724,
    buildings: 7,
    floorsMin: 15,
    floorsMax: 20,
    approvalDate: '2012-05-25',
    builtYear: 2012,
    parkingPerHousehold: 1.18,
    far: 221,
    bcr: 18.2,
    heating: HEAT,
    builder: null,
    counts: [0, 17, 6, 8],
    dongStart: 101,
    areas: [
      area(24, 59.9, 80.6, '59', 3, 2, 330, 25200, 202610, 17000, [1000, 60]),
      area(33, 84.95, 109.4, '84', 3, 2, 394, 28500, 202609, 20000, [2000, 55]),
    ],
    perPyeong: 1020,
    viewCount: 8440,
    favoriteCount: 120,
  },
  {
    code: 'C06',
    name: '신대 레이크파크 3단지',
    emdName: '해룡면 신대리',
    emdCode: '1215033028',
    districtName: '신대지구',
    road: '전라남도 순천시 해룡면 신대3로 12',
    jibun: '전라남도 순천시 해룡면 신대리 2040',
    ...near(807, -40),
    households: 1036,
    buildings: 9,
    floorsMin: 18,
    floorsMax: 24,
    approvalDate: '2020-02-14',
    builtYear: 2020,
    parkingPerHousehold: 1.41,
    far: 226,
    bcr: 17.1,
    heating: HEAT,
    builder: '레이크파크건설(주)',
    counts: [0, 21, 8, 2],
    dongStart: 301,
    areas: [
      area(33, 84.93, 109.8, '84A', 3, 2, 690, 41000, 202610, 26500, [3000, 85]),
      area(39, 99.9, 129.6, '99A', 4, 2, 346, 46000, 202608, 29000, [4000, 95]),
    ],
    perPyeong: 1160,
    viewCount: 11200,
    favoriteCount: 188,
  },
  {
    code: 'C07',
    name: '금당 리버뷰',
    emdName: '연향동',
    emdCode: '1215012100',
    districtName: '금당지구',
    road: '전라남도 순천시 금당로 44',
    jibun: '전라남도 순천시 연향동 1340',
    lat: 34.938,
    lng: 127.51,
    households: 808,
    buildings: 8,
    floorsMin: 12,
    floorsMax: 15,
    approvalDate: '2005-11-30',
    builtYear: 2005,
    parkingPerHousehold: 1.02,
    far: 241,
    bcr: 20.4,
    heating: '지역난방',
    builder: null,
    counts: [0, 14, 5, 3],
    dongStart: 101,
    areas: [
      area(25, 59.8, 82.1, '59', 3, 1, 380, 24500, 202609, 16500, [1000, 55]),
      area(31, 84.6, 103.2, '84', 3, 2, 428, 27500, 202610, 18500, [2000, 45]),
    ],
    perPyeong: 880,
    viewCount: 6350,
    favoriteCount: 84,
  },
  {
    code: 'C08',
    name: '왕지 숲속마을',
    emdName: '왕지동',
    emdCode: '1215012000',
    districtName: null,
    road: '전라남도 순천시 왕지2로 60',
    jibun: '전라남도 순천시 왕지동 910',
    lat: 34.978,
    lng: 127.552,
    households: 652,
    buildings: 6,
    floorsMin: 12,
    floorsMax: 15,
    approvalDate: '2011-08-19',
    builtYear: 2011,
    parkingPerHousehold: 1.15,
    far: 214,
    bcr: 18.8,
    heating: HEAT,
    builder: null,
    counts: [0, 12, 4, 6],
    dongStart: 101,
    areas: [
      area(25, 59.88, 82.5, '59', 3, 2, 300, 23800, 202610, 16000, [1000, 50]),
      area(32, 84.7, 106.0, '84', 3, 2, 352, 25500, 202608, 17500, [2000, 40]),
    ],
    perPyeong: 860,
    viewCount: 5120,
    favoriteCount: 61,
  },
  {
    // 분양 단지 (mockdata.md §1 note): 612세대, 2029년 입주 예정, 분양 58건, 분양가 4억 2,800 / 34평.
    // Same complex as the MAIN_HERO ad AD-01 and rank 9 of /complexes/popular.
    code: 'C09',
    name: '연향들 더 퍼스트',
    emdName: '연향동',
    emdCode: '1215012100',
    districtName: '연향들지구',
    road: '전라남도 순천시 연향들1로 20',
    jibun: '전라남도 순천시 연향동 1720',
    lat: 34.9412,
    lng: 127.5298,
    households: 612,
    buildings: 6,
    floorsMin: 22,
    floorsMax: 29,
    approvalDate: null,
    builtYear: 2029,
    parkingPerHousehold: 1.5,
    far: 249,
    bcr: 15.2,
    heating: HEAT,
    builder: '[분양 광고주 A]',
    counts: [58, 0, 0, 0],
    dongStart: 101,
    areas: [
      area(34, 84.98, 112.6, '84A', 3, 2, 402, 42800, 202610, 27000, [3000, 90]),
      area(39, 101.6, 129.4, '101A', 4, 2, 210, 47600, 202609, 30000, [5000, 85]),
    ],
    perPyeong: 1260,
    viewCount: 9040,
    favoriteCount: 143,
  },
  // ---- 신대지구 neighbours drawn on the Complex design map ---------------------------------------
  ...(
    [
      ['N01', '신대 레이크파크 2단지', 151, 221, 1184, 2019, 34, 84.96, 112.2, 43000, 27],
      ['N02', '신대 에듀포레', -412, 186, 846, 2018, 34, 84.9, 111.8, 40000, 19],
      ['N03', '신대 호수마루', -470, -157, 712, 2017, 32, 79.8, 105.6, 39000, 16],
      ['N04', '신대 별빛마을', 831, -453, 598, 2016, 25, 59.9, 82.4, 30000, 12],
      ['N05', '신대 해오름 2차', 831, -825, 484, 2021, 39, 99.8, 129.1, 48000, 9],
      ['N06', '신대 푸른숲', -470, -924, 366, 2015, 24, 59.7, 79.6, 28000, 7],
      ['N07', '신대 한빛마을', 221, -1115, 540, 2017, 29, 74.9, 96.3, 35000, 11],
    ] as const
  ).map(
    ([code, name, e, n, households, year, py, ex, sup, sale, count], i): MockComplexSpec => ({
      code,
      name,
      emdName: '해룡면 신대리',
      emdCode: '1215033028',
      districtName: '신대지구',
      road: `전라남도 순천시 해룡면 신대${(i % 4) + 1}로 ${40 + i * 12}`,
      jibun: `전라남도 순천시 해룡면 신대리 ${2100 + i * 7}`,
      ...near(e, n),
      households,
      buildings: Math.max(4, Math.round(households / 110)),
      floorsMin: 15,
      floorsMax: 22,
      approvalDate: `${year}-0${(i % 8) + 2}-15`,
      builtYear: year,
      parkingPerHousehold: 1.3,
      far: 220 + i,
      bcr: 17 + i / 10,
      heating: HEAT,
      builder: null,
      counts: [
        0,
        Math.round(count * 0.64),
        Math.round(count * 0.24),
        count - Math.round(count * 0.64) - Math.round(count * 0.24),
      ],
      dongStart: 101,
      areas: [
        area(
          py,
          ex,
          sup,
          `${Math.round(ex)}A`,
          3,
          2,
          Math.round(households * 0.6),
          sale,
          202610,
          Math.round((sale * 0.63) / 500) * 500,
          [3000, 75],
        ),
        area(
          py - 9 > 20 ? py - 9 : py + 8,
          py - 9 > 20 ? 59.9 : 101.5,
          py - 9 > 20 ? 82.3 : 134.2,
          py - 9 > 20 ? '59A' : '101A',
          3,
          2,
          Math.round(households * 0.4),
          py - 9 > 20
            ? Math.round((sale * 0.74) / 500) * 500
            : Math.round((sale * 1.2) / 500) * 500,
          202609,
          Math.round((sale * 0.5) / 500) * 500,
          [2000, 70],
        ),
      ],
      perPyeong: Math.round(sale / py / 10) * 10,
      viewCount: 4000 - i * 310,
      favoriteCount: 60 - i * 5,
    }),
  ),
];

// ---- lookups ------------------------------------------------------------------------------------

export const complexIdOf = (code: string) => mockUuid(code);
export const areaTypeIdOf = (code: string, a: MockAreaSpec) => mockUuid(`${code}-A${a.pyeong}`);

const BY_KEY = new Map<string, MockComplexSpec>();
for (const spec of COMPLEX_SPECS) {
  BY_KEY.set(complexIdOf(spec.code), spec);
  BY_KEY.set(spec.code.toLowerCase(), spec);
}

/** Finds a complex by UUID or short code ("C01", case-insensitive). */
export function findComplexSpec(idOrCode: string): MockComplexSpec | undefined {
  return BY_KEY.get(idOrCode) ?? BY_KEY.get(idOrCode.toLowerCase());
}

export function toAreaType(spec: MockComplexSpec, a: MockAreaSpec): ComplexAreaType {
  return {
    id: areaTypeIdOf(spec.code, a),
    exclusiveArea: a.exclusive,
    supplyArea: a.supply,
    typeName: a.typeName,
    pyeongLabel: `${a.pyeong}평`,
    households: a.households,
    rooms: a.rooms,
    baths: a.baths,
  };
}

export function toComplexDetail(spec: MockComplexSpec): ComplexDetail {
  return {
    id: complexIdOf(spec.code),
    assetType: 'APT',
    name: spec.name,
    roadAddress: spec.road,
    jibunAddress: spec.jibun,
    sggCode: '12150',
    emdCode: spec.emdCode,
    emdName: spec.emdName,
    districtName: spec.districtName,
    lat: spec.lat,
    lng: spec.lng,
    households: spec.households,
    buildings: spec.buildings,
    floorsMin: spec.floorsMin,
    floorsMax: spec.floorsMax,
    approvalDate: spec.approvalDate,
    builtYear: spec.builtYear,
    parkingTotal: Math.round(spec.households * spec.parkingPerHousehold),
    parkingPerHousehold: spec.parkingPerHousehold,
    floorAreaRatio: spec.far,
    buildingCoverageRatio: spec.bcr,
    heatingType: spec.heating,
    builder: spec.builder,
    viewCount: spec.viewCount,
    favoriteCount: spec.favoriteCount,
    activeListingCount: spec.counts.reduce((a, b) => a + b, 0),
    avgPricePerPyeong: spec.perPyeong,
    areaTypes: spec.areas.map((a) => toAreaType(spec, a)),
    // No media server in mock mode → the UI shows the branded placeholder.
    photos: [],
    latestTrades: tradeDataOf(spec).latest,
  };
}

// ---- deterministic pseudo-random ----------------------------------------------------------------

export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- 실거래가 ------------------------------------------------------------------------------------

/** Months of history generated per 평형 (5 years). */
const HISTORY_MONTHS = 60;

const ymAdd = (ym: number, delta: number): number => {
  const total = Math.floor(ym / 100) * 12 + ((ym % 100) - 1) + delta;
  return Math.floor(total / 12) * 100 + (total % 12) + 1;
};

/** Monthly aggregate row tagged with its series (ComplexTradeStat). */
export interface MockTradeStat extends TradeStat {
  areaTypeId: string;
  exclusiveArea: number;
  dealType: TradeRecord['dealType'];
}

interface TradeData {
  trades: TradeRecord[];
  monthly: MockTradeStat[];
  latest: TradeRecord[];
}

const TRADE_CACHE = new Map<string, TradeData>();

/**
 * Deterministic trade history. Monthly medians follow a gentle upward curve that ends exactly at the
 * 평형's latest price (so the panel shows "4억 3,500 ▲ 2,500" for C01 34평 like the design); the
 * individual records are spread symmetrically around each median.
 */
export function tradeDataOf(spec: MockComplexSpec): TradeData {
  const cached = TRADE_CACHE.get(spec.code);
  if (cached) return cached;
  const trades: TradeRecord[] = [];
  const monthly: MockTradeStat[] = [];
  const presaleOnly = spec.approvalDate === null;

  for (const a of spec.areas) {
    const areaTypeId = areaTypeIdOf(spec.code, a);
    const rand = seededRandom(`${spec.code}-${a.pyeong}`);
    const series: {
      dealType: TradeRecord['dealType'];
      latest: number;
      lastYm: number;
      growth: number;
      step: number;
      rent?: number;
      density: number;
    }[] = [
      {
        dealType: 'SALE',
        latest: a.sale,
        lastYm: a.saleYm,
        growth: 0.0667,
        step: 100,
        density: 1,
      },
      ...(presaleOnly
        ? []
        : ([
            {
              dealType: 'JEONSE',
              latest: a.jeonse,
              lastYm: 202610,
              growth: 0.04,
              step: 500,
              density: 0.7,
            },
            {
              dealType: 'MONTHLY',
              latest: a.monthly[0],
              lastYm: 202610,
              growth: 0,
              step: 500,
              rent: a.monthly[1],
              density: 0.45,
            },
          ] as const)),
    ];

    for (const s of series) {
      const months = presaleOnly ? 18 : HISTORY_MONTHS;
      for (let k = 0; k < months; k++) {
        const ym = ymAdd(s.lastYm, -k);
        const anchor = k % 11 === 0;
        const r1 = rand();
        const r2 = rand();
        const r3 = rand();
        // Anchor months always have exactly one trade so the median equals the trend value.
        const count = anchor ? 1 : r1 < 0.22 / s.density ? 0 : r1 < 0.62 ? 1 : r1 < 0.88 ? 2 : 3;
        if (count === 0) continue;
        const base = s.latest / (1 + s.growth) ** (k / 12);
        const noise = anchor ? 0 : (r2 - 0.5) * 0.024 * base;
        const median = Math.max(s.step, Math.round((base + noise) / s.step) * s.step);
        const spread = Math.max(s.step, Math.round((median * 0.012) / s.step) * s.step);
        const offsets = count === 1 ? [0] : count === 2 ? [-spread, spread] : [-spread, 0, spread];
        const rent = s.rent === undefined ? null : Math.max(5, s.rent - Math.round(k / 12) * 5);
        offsets.forEach((offset, i) => {
          const day = 3 + Math.floor(((r3 * 97 + i * 37) % 1) * 24);
          const floor = 2 + Math.floor(((r2 * 53 + i * 0.37) % 1) * (spec.floorsMax - 2));
          const value = median + offset;
          trades.push({
            id: mockUuid(`${spec.code}-${a.pyeong}-${s.dealType}-${ym}-${i}`),
            areaTypeId,
            dealType: s.dealType,
            dealDate: `${Math.floor(ym / 100)}-${String(ym % 100).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            dealYm: ym,
            exclusiveArea: a.exclusive,
            floor,
            price: s.dealType === 'SALE' ? value : null,
            deposit: s.dealType === 'SALE' ? null : value,
            monthlyRent: rent,
            cancelled: false,
            contractType: s.dealType === 'SALE' ? null : r3 < 0.7 ? '신규' : '갱신',
          });
        });
        monthly.push({
          areaTypeId,
          exclusiveArea: a.exclusive,
          dealType: s.dealType,
          yearMonth: ym,
          tradeCount: count,
          medianPrice: median,
          minPrice: median + Math.min(...offsets),
          maxPrice: median + Math.max(...offsets),
          avgPrice: median,
          medianMonthlyRent: rent,
        });
      }
    }
  }

  trades.sort((x, y) => (x.dealDate < y.dealDate ? 1 : x.dealDate > y.dealDate ? -1 : 0));
  monthly.sort((x, y) => x.yearMonth - y.yearMonth);
  const seen = new Set<string>();
  const latest = trades.filter((t) => {
    const key = `${t.areaTypeId}-${t.dealType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const data = { trades, monthly, latest };
  TRADE_CACHE.set(spec.code, data);
  return data;
}

// ---- nearby -------------------------------------------------------------------------------------

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(6_371_000 * 2 * Math.asin(Math.sqrt(h)));
}

export function toNearby(origin: MockComplexSpec, spec: MockComplexSpec): NearbyComplex {
  const [presale, sale, jeonse, monthly] = spec.counts;
  const main = [...spec.areas].sort((x, y) => y.households - x.households)[0];
  return {
    id: complexIdOf(spec.code),
    name: spec.name,
    assetType: 'APT',
    emdName: spec.emdName,
    lat: spec.lat,
    lng: spec.lng,
    distanceM: distanceM(origin, spec),
    households: spec.households,
    builtYear: spec.builtYear,
    activeListingCount: presale + sale + jeonse + monthly,
    dealCounts: { presale, sale, jeonse, monthly },
    representative: main
      ? {
          pyeongLabel: `${main.pyeong}평`,
          price: main.sale,
          dealType: presale > sale ? 'PRESALE' : 'SALE',
        }
      : null,
  };
}

export function nearbyOf(origin: MockComplexSpec, radiusM = 3000): NearbyComplex[] {
  return COMPLEX_SPECS.filter((s) => s.code !== origin.code)
    .map((s) => toNearby(origin, s))
    .filter((n) => n.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM);
}
