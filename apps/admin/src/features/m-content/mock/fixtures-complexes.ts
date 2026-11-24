import { mockUuid } from './ids';

/**
 * 단지 fixtures (fictional — mockdata.md §1). Rows mirror the Prisma models Complex /
 * ComplexAreaType / ComplexPhoto / TradeSyncRun (apps/api/prisma/schema/complexes.prisma).
 * Ids are `mockUuid('C01')` … so they match the user-site mock.
 */

export interface MockAreaType {
  id: string;
  exclusiveArea: number;
  supplyArea: number | null;
  typeName: string;
  pyeongLabel: string | null;
  households: number | null;
  rooms: number | null;
  baths: number | null;
  tradeCount: number;
  lastSalePrice: number | null;
}

export interface MockComplexPhoto {
  id: string;
  mediaId: string;
  url: string;
  width: number | null;
  height: number | null;
  caption: string | null;
  sortOrder: number;
}

export interface MockComplex {
  id: string;
  assetType: 'APT' | 'OFFICETEL';
  name: string;
  roadAddress: string | null;
  jibunAddress: string | null;
  sggCode: string;
  emdCode: string | null;
  emdName: string | null;
  jibun: string | null;
  lat: number;
  lng: number;
  households: number | null;
  buildings: number | null;
  floorsMin: number | null;
  floorsMax: number | null;
  approvalDate: string | null;
  builtYear: number | null;
  parkingTotal: number | null;
  parkingPerHousehold: number | null;
  floorAreaRatio: number | null;
  buildingCoverageRatio: number | null;
  heatingType: string | null;
  builder: string | null;
  externalCode: string | null;
  viewCount: number;
  favoriteCount: number;
  activeListingCount: number;
  lastTradeDate: string | null;
  tradeTotal: number;
  tradeUnmatched: number;
  createdAt: string;
  updatedAt: string;
  areaTypes: MockAreaType[];
  photos: MockComplexPhoto[];
}

type AreaSpec = [
  pyeong: number,
  exclusive: number,
  supply: number,
  typeName: string,
  rooms: number,
  baths: number,
  households: number,
  trades: number,
  lastSale: number | null,
];

interface Spec {
  code: string;
  name: string;
  emdName: string;
  emdCode: string;
  road: string;
  jibun: string;
  lat: number;
  lng: number;
  households: number;
  buildings: number;
  floors: [number, number];
  approval: string | null;
  builtYear: number;
  parking: number;
  far: number;
  bcr: number;
  heating: string;
  builder: string | null;
  listings: number;
  views: number;
  favorites: number;
  lastTrade: string | null;
  unmatched?: number;
  photos: number;
  updatedAt: string;
  assetType?: 'APT' | 'OFFICETEL';
  areas: AreaSpec[];
}

const PHOTO_CAPTIONS = [
  '단지 전경',
  '정문',
  '중앙 광장',
  '어린이 놀이터',
  '커뮤니티 센터',
  '산책로',
];

function build(spec: Spec): MockComplex {
  const id = mockUuid(spec.code);
  const areaTypes = spec.areas.map(
    ([pyeong, exclusive, supply, typeName, rooms, baths, households, trades, lastSale], i) => ({
      id: mockUuid(`${spec.code}-area-${i}`),
      exclusiveArea: exclusive,
      supplyArea: supply,
      typeName,
      pyeongLabel: `${pyeong}평`,
      households,
      rooms,
      baths,
      tradeCount: trades,
      lastSalePrice: lastSale,
    }),
  );
  const photos = Array.from({ length: spec.photos }, (_, i) => ({
    id: mockUuid(`${spec.code}-photo-${i}`),
    mediaId: mockUuid(`${spec.code}-media-${i}`),
    url: `/mock-api/v1/admin/complexes/photo-art/${spec.code}-${i}`,
    width: 1600,
    height: 1067,
    caption: PHOTO_CAPTIONS[i] ?? null,
    sortOrder: i,
  }));
  return {
    id,
    assetType: spec.assetType ?? 'APT',
    name: spec.name,
    roadAddress: `전라남도 순천시 ${spec.road}`,
    jibunAddress: `전라남도 순천시 ${spec.emdName} ${spec.jibun}`,
    sggCode: '46150',
    emdCode: spec.emdCode,
    emdName: spec.emdName,
    jibun: spec.jibun,
    lat: spec.lat,
    lng: spec.lng,
    households: spec.households,
    buildings: spec.buildings,
    floorsMin: spec.floors[0],
    floorsMax: spec.floors[1],
    approvalDate: spec.approval,
    builtYear: spec.builtYear,
    parkingTotal: Math.round(spec.households * spec.parking),
    parkingPerHousehold: spec.parking,
    floorAreaRatio: spec.far,
    buildingCoverageRatio: spec.bcr,
    heatingType: spec.heating,
    builder: spec.builder,
    externalCode: `46150-${spec.code.slice(1).padStart(4, '0')}`,
    viewCount: spec.views,
    favoriteCount: spec.favorites,
    activeListingCount: spec.listings,
    lastTradeDate: spec.lastTrade,
    tradeTotal: areaTypes.reduce((sum, a) => sum + a.tradeCount, 0),
    tradeUnmatched: spec.unmatched ?? 0,
    createdAt: '2026-06-20T10:00:00+09:00',
    updatedAt: spec.updatedAt,
    areaTypes,
    photos,
  };
}

export const COMPLEXES: MockComplex[] = [
  build({
    code: 'C01',
    name: '신대 레이크파크 1단지',
    emdName: '해룡면 신대리',
    emdCode: '4615033028',
    road: '해룡면 신대1로 55',
    jibun: '1971',
    lat: 34.9215,
    lng: 127.58,
    households: 1412,
    buildings: 16,
    floors: [18, 25],
    approval: '2019-03-28',
    builtYear: 2019,
    parking: 1.32,
    far: 219.4,
    bcr: 16.8,
    heating: '지역난방',
    builder: '[시공사 A]',
    listings: 56,
    views: 18420,
    favorites: 612,
    lastTrade: '2026-11-14',
    unmatched: 2,
    photos: 5,
    updatedAt: '2026-11-21T15:10:00+09:00',
    areas: [
      [25, 59.97, 82.64, '59A', 3, 2, 412, 148, 32500],
      [34, 84.98, 112.4, '84A', 3, 2, 640, 236, 43500],
      [34, 84.91, 112.9, '84B', 3, 2, 216, 71, 42800],
      [41, 101.96, 135.2, '101', 4, 2, 144, 39, 48500],
    ],
  }),
  build({
    code: 'C02',
    name: '연향 센트럴',
    emdName: '연향동',
    emdCode: '4615012100',
    road: '연향3로 40',
    jibun: '1432',
    lat: 34.9442,
    lng: 127.5208,
    households: 980,
    buildings: 11,
    floors: [12, 15],
    approval: '2016-09-12',
    builtYear: 2016,
    parking: 1.21,
    far: 204.1,
    bcr: 18.2,
    heating: '개별난방 (도시가스)',
    builder: '[시공사 B]',
    listings: 38,
    views: 12980,
    favorites: 401,
    lastTrade: '2026-11-11',
    photos: 4,
    updatedAt: '2026-11-18T09:40:00+09:00',
    areas: [
      [24, 59.84, 79.9, '59', 3, 2, 420, 121, 32000],
      [32, 84.72, 106.3, '84', 3, 2, 560, 188, 36000],
    ],
  }),
  build({
    code: 'C03',
    name: '선월 하이츠 2차',
    emdName: '해룡면 선월리',
    emdCode: '4615033029',
    road: '해룡면 선월로 12',
    jibun: '808',
    lat: 34.9352,
    lng: 127.5746,
    households: 1120,
    buildings: 12,
    floors: [15, 20],
    approval: null,
    builtYear: 2027,
    parking: 1.4,
    far: 228.7,
    bcr: 15.9,
    heating: '지역난방',
    builder: '[시공사 C]',
    listings: 53,
    views: 15310,
    favorites: 548,
    lastTrade: '2026-11-17',
    photos: 3,
    updatedAt: '2026-11-20T11:25:00+09:00',
    areas: [
      [25, 59.92, 83.1, '59A', 3, 2, 480, 64, 33800],
      [33, 84.95, 110.8, '84A', 3, 2, 640, 97, 41900],
    ],
  }),
  build({
    code: 'C04',
    name: '조례 호수마을',
    emdName: '조례동',
    emdCode: '4615012000',
    road: '조례동 호수공원길 60',
    jibun: '1820',
    lat: 34.9571,
    lng: 127.5224,
    households: 860,
    buildings: 10,
    floors: [15, 18],
    approval: '2009-06-30',
    builtYear: 2009,
    parking: 1.08,
    far: 196.3,
    bcr: 19.5,
    heating: '개별난방 (도시가스)',
    builder: '[시공사 D]',
    listings: 30,
    views: 9240,
    favorites: 287,
    lastTrade: '2026-11-09',
    photos: 3,
    updatedAt: '2026-11-12T14:05:00+09:00',
    areas: [
      [24, 59.76, 80.2, '59', 3, 1, 380, 204, 26500],
      [32, 84.63, 107.1, '84', 3, 2, 480, 262, 29800],
    ],
  }),
  build({
    code: 'C05',
    name: '오천 그린빌',
    emdName: '오천동',
    emdCode: '4615011900',
    road: '오천2길 21',
    jibun: '655',
    lat: 34.9318,
    lng: 127.5052,
    households: 724,
    buildings: 8,
    floors: [15, 20],
    approval: '2012-11-08',
    builtYear: 2012,
    parking: 1.15,
    far: 201.8,
    bcr: 17.6,
    heating: '개별난방 (도시가스)',
    builder: '[시공사 E]',
    listings: 31,
    views: 8010,
    favorites: 233,
    lastTrade: '2026-11-13',
    photos: 2,
    updatedAt: '2026-11-15T10:30:00+09:00',
    areas: [
      [24, 59.89, 81.0, '59', 3, 2, 364, 143, 25200],
      [33, 84.87, 109.6, '84', 3, 2, 360, 151, 29000],
    ],
  }),
  build({
    code: 'C06',
    name: '신대 레이크파크 3단지',
    emdName: '해룡면 신대리',
    emdCode: '4615033028',
    road: '해룡면 신대3로 20',
    jibun: '1990',
    lat: 34.9248,
    lng: 127.5841,
    households: 1036,
    buildings: 12,
    floors: [20, 24],
    approval: '2020-05-21',
    builtYear: 2020,
    parking: 1.35,
    far: 221.0,
    bcr: 16.1,
    heating: '지역난방',
    builder: '[시공사 A]',
    listings: 31,
    views: 11260,
    favorites: 372,
    lastTrade: '2026-11-10',
    photos: 4,
    updatedAt: '2026-11-16T17:20:00+09:00',
    areas: [
      [33, 84.96, 110.2, '84A', 3, 2, 720, 172, 41000],
      [39, 99.94, 129.6, '99', 4, 2, 316, 58, 46000],
    ],
  }),
  build({
    code: 'C07',
    name: '금당 리버뷰',
    emdName: '연향동',
    emdCode: '4615012100',
    road: '금당로 28',
    jibun: '1244',
    lat: 34.9391,
    lng: 127.5263,
    households: 808,
    buildings: 9,
    floors: [12, 15],
    approval: '2005-10-14',
    builtYear: 2005,
    parking: 0.98,
    far: 189.2,
    bcr: 20.4,
    heating: '개별난방 (도시가스)',
    builder: null,
    listings: 22,
    views: 6120,
    favorites: 164,
    lastTrade: '2026-11-06',
    photos: 0,
    updatedAt: '2026-10-29T13:15:00+09:00',
    areas: [
      [25, 59.82, 82.9, '59', 3, 1, 408, 311, 24000],
      [31, 84.6, 103.7, '84', 3, 2, 400, 298, 27500],
    ],
  }),
  build({
    code: 'C08',
    name: '왕지 숲속마을',
    emdName: '왕지동',
    emdCode: '4615012200',
    road: '왕지2로 50',
    jibun: '902',
    lat: 34.9683,
    lng: 127.5341,
    households: 652,
    buildings: 7,
    floors: [12, 15],
    approval: '2011-04-19',
    builtYear: 2011,
    parking: 1.12,
    far: 198.6,
    bcr: 18.8,
    heating: '개별난방 (도시가스)',
    builder: '[시공사 F]',
    listings: 22,
    views: 5480,
    favorites: 139,
    lastTrade: '2026-11-04',
    photos: 2,
    updatedAt: '2026-11-05T09:00:00+09:00',
    areas: [
      [25, 59.9, 83.2, '59', 3, 2, 340, 187, 23800],
      [32, 84.7, 106.0, '84', 3, 2, 312, 160, 26000],
    ],
  }),
  build({
    code: 'C09',
    name: '연향들 더 퍼스트',
    emdName: '연향동',
    emdCode: '4615012100',
    road: '연향들1로 10',
    jibun: '2101',
    lat: 34.9479,
    lng: 127.5302,
    households: 612,
    buildings: 6,
    floors: [20, 29],
    approval: null,
    builtYear: 2029,
    parking: 1.5,
    far: 249.8,
    bcr: 14.2,
    heating: '지역난방',
    builder: '[시공사 G]',
    listings: 58,
    views: 21030,
    favorites: 804,
    lastTrade: null,
    photos: 3,
    updatedAt: '2026-11-22T10:10:00+09:00',
    areas: [
      [34, 84.99, 113.0, '84A', 3, 2, 420, 0, null],
      [45, 114.9, 148.8, '114', 4, 2, 192, 0, null],
    ],
  }),
  build({
    code: 'C10',
    name: '덕연 한솔마을',
    emdName: '덕연동',
    emdCode: '4615011500',
    road: '덕연2길 14',
    jibun: '377',
    lat: 34.9487,
    lng: 127.5118,
    households: 498,
    buildings: 6,
    floors: [10, 15],
    approval: '1999-12-03',
    builtYear: 1999,
    parking: 0.82,
    far: 179.5,
    bcr: 21.3,
    heating: '개별난방 (도시가스)',
    builder: null,
    listings: 14,
    views: 3120,
    favorites: 71,
    lastTrade: '2026-10-28',
    unmatched: 7,
    photos: 0,
    updatedAt: '2026-09-30T16:45:00+09:00',
    areas: [[24, 59.4, 79.3, '59', 3, 1, 498, 402, 15800]],
  }),
  build({
    code: 'C11',
    name: '조례 호수뷰 오피스텔',
    assetType: 'OFFICETEL',
    emdName: '조례동',
    emdCode: '4615012000',
    road: '조례동 호수공원길 8',
    jibun: '1795',
    lat: 34.9562,
    lng: 127.5249,
    households: 216,
    buildings: 1,
    floors: [15, 15],
    approval: '2018-02-27',
    builtYear: 2018,
    parking: 0.9,
    far: 598.2,
    bcr: 58.0,
    heating: '개별난방 (도시가스)',
    builder: '[시공사 H]',
    listings: 9,
    views: 2890,
    favorites: 64,
    lastTrade: '2026-10-19',
    photos: 1,
    updatedAt: '2026-10-21T11:00:00+09:00',
    areas: [
      [9, 24.8, 49.1, '원룸형', 1, 1, 168, 44, 9800],
      [14, 39.6, 72.4, '1.5룸형', 1, 1, 48, 12, 14500],
    ],
  }),
];

// ---------- 실거래가 동기화 ----------

export interface MockTradeSyncRun {
  id: string;
  kind: 'APT_TRADE' | 'APT_RENT';
  sggCode: string;
  yearMonth: number;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  fetchedCount: number;
  upsertedCount: number;
  matchedCount: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  triggeredByAdminName: string | null;
  /** MOCK ONLY: a RUNNING run settles into this result a few seconds after it started. */
  settle?: { fetched: number; upserted: number; matched: number };
}

const run = (
  key: string,
  kind: MockTradeSyncRun['kind'],
  yearMonth: number,
  startedAt: string,
  seconds: number,
  counts: [number, number, number],
  extra: Partial<MockTradeSyncRun> = {},
): MockTradeSyncRun => ({
  id: mockUuid(`sync-${key}`),
  kind,
  sggCode: '46150',
  yearMonth,
  status: 'SUCCEEDED',
  fetchedCount: counts[0],
  upsertedCount: counts[1],
  matchedCount: counts[2],
  error: null,
  startedAt,
  finishedAt: new Date(new Date(startedAt).getTime() + seconds * 1000).toISOString(),
  triggeredByAdminName: null,
  ...extra,
});

/** Newest first. Scheduled job: 1st of each month 04:00 KST (previous month) + a mid-month re-run. */
export const TRADE_SYNC_RUNS: MockTradeSyncRun[] = [
  run('r12', 'APT_RENT', 202611, '2026-11-20T10:12:40+09:00', 31, [612, 48, 44], {
    triggeredByAdminName: '한지우',
  }),
  run('r11', 'APT_TRADE', 202611, '2026-11-20T10:12:08+09:00', 28, [287, 36, 33], {
    triggeredByAdminName: '한지우',
  }),
  run('r10', 'APT_RENT', 202610, '2026-11-15T04:00:41+09:00', 38, [905, 12, 11]),
  run('r09', 'APT_TRADE', 202610, '2026-11-15T04:00:02+09:00', 35, [431, 9, 9]),
  run('r08', 'APT_RENT', 202610, '2026-11-01T04:00:52+09:00', 44, [893, 893, 842]),
  run('r07', 'APT_TRADE', 202610, '2026-11-01T04:00:03+09:00', 46, [422, 422, 401]),
  run('r06', 'APT_RENT', 202609, '2026-10-01T04:01:10+09:00', 12, [0, 0, 0], {
    status: 'FAILED',
    error: 'data.go.kr 응답 지연 (timeout 10000ms) — RTMSDataSvcAptRent 3회 재시도 후 실패',
  }),
  run('r05', 'APT_TRADE', 202609, '2026-10-01T04:00:04+09:00', 41, [398, 398, 377]),
  run('r04', 'APT_RENT', 202609, '2026-10-01T09:20:15+09:00', 40, [861, 861, 815], {
    triggeredByAdminName: '정다은',
  }),
  run('r03', 'APT_RENT', 202608, '2026-09-01T04:00:49+09:00', 39, [874, 874, 829]),
  run('r02', 'APT_TRADE', 202608, '2026-09-01T04:00:03+09:00', 42, [405, 405, 380]),
  run('r01', 'APT_TRADE', 202607, '2026-08-01T04:00:03+09:00', 40, [388, 388, 366]),
];
