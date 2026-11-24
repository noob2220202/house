/**
 * Fixtures for the listing-detail page group (w-listing). All data is fictional and follows
 * design/drafts/system/mockdata.md (기준일 2026-11-23). Other groups may import the lookups, but
 * the seeds are owned by w-listing.
 */
import {
  AssetType,
  DealType,
  Direction,
  DirectionBasis,
  FloorDisplay,
  ListingOption,
  ListingStatus,
  MoveInType,
  type RoomType,
  VerificationMethod,
} from '@house/shared';
import type {
  ListingAgency,
  ListingComplex,
  ListingDetail,
  ListingSummary,
  NearbyPlace,
  SimilarListings,
} from '@/features/w-listing/api/schemas';
import { floorClassOf } from '@/lib/format/floor';
import { mockUuid } from '@/lib/mock';
import {
  COMPLEX_SPECS,
  areaTypeIdOf,
  complexIdOf,
  type MockComplexSpec,
} from '../complexes/_fixtures';
import { findMockListing as findComplexListing, type MockListing } from '../complexes/_listings';
import { listingDisplayName } from '@/lib/api/schemas/listing';
import { findMockListingSummary, type MockSummaryHit } from './_catalog';
import { roomTypeOf, toListingSummary } from './_summary';

// ---- complexes (owned by w-complex — ids, coordinates and 평형 come from its fixtures) ----------

const complexByCode = (code: string): MockComplexSpec =>
  COMPLEX_SPECS.find((c) => c.code === code)!;
const regionOf = (c: MockComplexSpec) => c.districtName ?? c.emdName;

// ---- agencies -------------------------------------------------------------------------------------

/** [code, 상호, 대표, 주소, 상세, 전문 태그, 보유 매물, 평균 응답(분), 등록번호] */
type AgencyRow = readonly [string, string, string, string, string, string, number, number, string];
const AGENCIES: readonly AgencyRow[] = [
  [
    'B01',
    '신대중앙 공인중개사사무소',
    '김서진',
    '순천시 해룡면 신대1로 18',
    '105호',
    '단지 전문',
    62,
    12,
    '46150-2019-00012',
  ],
  [
    'B02',
    '호수공원 공인중개사사무소',
    '한서윤',
    '순천시 조례동 호수공원길 24',
    '1층',
    '연향·조례 아파트 전문',
    46,
    8,
    '46150-2017-00034',
  ],
  [
    'B03',
    '연향센트럴 공인중개사사무소',
    '박도현',
    '순천시 연향동 연향3로 41',
    '102호',
    '연향 센트럴 단지 전문',
    38,
    20,
    '46150-2016-00058',
  ],
  [
    'B04',
    '오천그린 공인중개사사무소',
    '이하린',
    '순천시 오천동 오천2길 7',
    '1층',
    '오천지구 전문',
    29,
    15,
    '46150-2018-00021',
  ],
  [
    'B05',
    '선월 분양권 공인중개사사무소',
    '정민재',
    '순천시 해룡면 선월로 30',
    '상가 B동 101호',
    '분양권 전문',
    51,
    10,
    '46150-2023-00007',
  ],
  [
    'B06',
    '순천대정문 공인중개사사무소',
    '최유나',
    '순천시 석현동 대학로 15',
    '1층',
    '원룸·투룸 전문',
    74,
    6,
    '46150-2014-00043',
  ],
  [
    'B07',
    '금당리버 공인중개사사무소',
    '윤재희',
    '순천시 연향동 금당로 9',
    '103호',
    '금당지구 전문',
    22,
    25,
    '46150-2011-00019',
  ],
  [
    'B08',
    '왕지숲 공인중개사사무소',
    '강태오',
    '순천시 왕지동 왕지2로 33',
    '1층',
    '왕지·조례 전문',
    19,
    30,
    '46150-2015-00066',
  ],
];

/** Agency id convention — keep in sync with the agencies mock (w-agencies). */
export const mockAgencyId = (code: string) => mockUuid(`agency-${code}`);

function agencyOf(code: string, isPrimary: boolean): ListingAgency {
  const a = AGENCIES.find((x) => x[0] === code) ?? AGENCIES[0]!;
  return {
    agencyId: mockAgencyId(a[0]),
    isPrimary,
    name: a[1],
    representativeName: a[2],
    registrationNumber: a[8],
    phone: '0610000000',
    roadAddress: a[3],
    addressDetail: a[4],
    logoUrl: null,
    specialtyTag: a[5],
    activeListingCount: a[6],
    avgResponseMinutes: a[7],
    contactName: a[2],
    contactPhone: '0610000000',
  };
}

// ---- listing seeds --------------------------------------------------------------------------------

export type MockPhotoScene =
  | 'exterior'
  | 'living'
  | 'kitchen'
  | 'plan'
  | 'view'
  | 'bedroom'
  | 'bath'
  | 'entrance'
  | 'room'
  | 'villa'
  | 'shop'
  | 'land';

interface Seed {
  code: string;
  no: string;
  asset: AssetType;
  deal: DealType;
  status?: ListingStatus;
  complex?: string;
  /** Index into the complex `types`. */
  type?: number;
  name: string;
  dong?: string;
  emdName: string;
  emdCode: string;
  region: string;
  road: string;
  lat: number;
  lng: number;
  floor?: number;
  totalFloors?: number;
  floorDisplay?: FloorDisplay;
  excl?: number;
  supply?: number;
  land?: number;
  rooms?: number;
  /** 방 구성 as stated by the broker (원룸·투룸·1.5룸). */
  roomType?: RoomType | null;
  baths?: number;
  direction?: Direction;
  /** 매매가 / 전세 보증금 / 분양권 매매가 (만원). */
  price?: number;
  deposit?: number;
  rent?: number;
  premium?: number;
  feeWon?: number;
  moveIn?: string;
  builtYear?: number;
  parking?: number;
  heating?: string;
  zoning?: string;
  landCategory?: string;
  buildingUse?: string;
  options?: readonly ListingOption[];
  verified?: string;
  published: string;
  views: number;
  favs: number;
  agencies: readonly string[];
  photos: readonly (readonly [MockPhotoScene, string])[];
  highlights?: readonly string[];
  description?: string;
  nearby?: readonly NearbyPlace[];
}

const O = ListingOption;
const D = Direction;
const SALE = DealType.SALE;
const APT_OPTIONS = [
  O.AIR_CONDITIONER,
  O.BUILT_IN_WARDROBE,
  O.DISHWASHER,
  O.INDUCTION,
  O.SHOE_RACK,
  O.BALCONY,
  O.ELEVATOR,
  O.CCTV,
] as const;
const ROOM_OPTIONS = [
  O.AIR_CONDITIONER,
  O.REFRIGERATOR,
  O.WASHER,
  O.BED,
  O.DESK,
  O.CLOSET,
  O.INDUCTION,
  O.WIFI,
  O.CCTV,
] as const;

const APT_PHOTOS: Seed['photos'] = [
  ['exterior', '단지 전경'],
  ['living', '거실'],
  ['kitchen', '주방'],
  ['plan', '평면도'],
  ['view', '거실 조망'],
  ['bedroom', '안방'],
  ['bath', '욕실'],
  ['entrance', '현관'],
];
const ROOM_PHOTOS: Seed['photos'] = [
  ['room', '방 전체'],
  ['kitchen', '주방'],
  ['bath', '욕실'],
  ['villa', '건물 외관'],
  ['entrance', '현관'],
];

/** 신대지구 landmarks, placed relative to 레이크파크 1단지 (w-complex fixture coordinates). */
const SINDAE_AT = { lat: complexByCode('C01').lat, lng: complexByCode('C01').lng };
const off = (eastM: number, northM: number) => ({
  lat: Number((SINDAE_AT.lat + northM / 111_000).toFixed(6)),
  lng: Number((SINDAE_AT.lng + eastM / 91_200).toFixed(6)),
});
const NEARBY_SINDAE: readonly NearbyPlace[] = [
  {
    category: 'SCHOOL',
    name: '호수초등학교',
    distanceM: 350,
    note: '단지 배정 · 도보 5분',
    ...off(20, -350),
  },
  { category: 'SCHOOL', name: '호수중학교', distanceM: 780, note: '도보 11분', ...off(520, -580) },
  { category: 'PARK', name: '신대 호수공원', distanceM: 150, note: '도보 2분', ...off(-150, 10) },
  {
    category: 'MART',
    name: '신대 중심상가 대형마트',
    distanceM: 900,
    note: '도보 13분',
    ...off(40, 900),
  },
  {
    category: 'LANDMARK',
    name: '순천만국가정원',
    distanceM: 6800,
    note: '차로 12분',
    lat: 34.9285,
    lng: 127.4985,
  },
  {
    category: 'TRANSIT',
    name: '순천역 · KTX 전라선',
    distanceM: 9400,
    note: '차로 18분',
    lat: 34.9457,
    lng: 127.5035,
  },
];

function nearbyFor(lat: number, lng: number): NearbyPlace[] {
  return [
    {
      category: 'SCHOOL',
      name: '초등학교',
      distanceM: 420,
      note: '도보 6분',
      lat: lat - 0.0028,
      lng: lng + 0.0012,
    },
    {
      category: 'PARK',
      name: '근린공원',
      distanceM: 300,
      note: '도보 4분',
      lat: lat + 0.0012,
      lng: lng - 0.0025,
    },
    {
      category: 'MART',
      name: '동네 마트',
      distanceM: 650,
      note: '도보 9분',
      lat: lat + 0.0035,
      lng: lng + 0.002,
    },
    {
      category: 'TRANSIT',
      name: '순천역 · KTX 전라선',
      distanceM: 5200,
      note: '차로 12분',
      lat: 34.9457,
      lng: 127.5035,
    },
  ];
}

type Money = Partial<Pick<Seed, 'price' | 'deposit' | 'rent' | 'premium'>>;

function apt(
  code: string,
  no: string,
  complex: string,
  type: number,
  dong: string,
  floor: number,
  direction: Direction,
  deal: DealType,
  money: Money,
  verified: string,
  agencies: readonly string[],
  extra: Partial<Seed> = {},
): Seed {
  const c = complexByCode(complex);
  const t = c.areas[type]!;
  const n = code.charCodeAt(1) * 7 + code.charCodeAt(2);
  return {
    code,
    no,
    asset: AssetType.APT,
    deal,
    complex,
    type,
    name: c.name,
    dong,
    emdName: c.emdName,
    emdCode: c.emdCode,
    region: regionOf(c),
    road: c.road,
    lat: c.lat,
    lng: c.lng,
    floor,
    totalFloors: c.floorsMax,
    floorDisplay: FloorDisplay.CLASS,
    excl: t.exclusive,
    supply: t.supply,
    rooms: t.rooms,
    baths: t.baths,
    direction,
    ...money,
    feeWon: Math.round((t.supply * 2135) / 10000) * 10000,
    moveIn: '2027-02-01',
    builtYear: c.builtYear,
    parking: c.parkingPerHousehold,
    heating: '개별난방 (도시가스)',
    options: APT_OPTIONS,
    verified,
    published: verified,
    views: 120 + ((n * 37) % 300),
    favs: 20 + ((n * 13) % 120),
    agencies,
    photos: APT_PHOTOS,
    ...extra,
  };
}

function room(
  code: string,
  no: string,
  name: string,
  emdName: string,
  emdCode: string,
  hint: string,
  kind: string,
  floors: readonly [number, number],
  builtYear: number,
  deal: DealType,
  money: Money,
  verified: string,
  agencies: readonly string[],
  at: readonly [number, number],
  excl: number,
): Seed {
  const n = code.charCodeAt(2);
  return {
    code,
    no,
    asset: AssetType.ONEROOM,
    deal,
    name,
    emdName,
    emdCode,
    region: emdName,
    road: `순천시 ${emdName} [도로명 주소]`,
    lat: at[0],
    lng: at[1],
    floor: floors[0],
    totalFloors: floors[1],
    floorDisplay: FloorDisplay.EXACT,
    excl,
    supply: Math.round(excl * 132) / 100,
    rooms: kind === '투룸' ? 2 : 1,
    roomType: roomTypeOf(kind),
    baths: 1,
    direction: D.SOUTH,
    ...money,
    feeWon: 70000,
    builtYear,
    parking: 4,
    heating: '개별난방 (도시가스)',
    options: ROOM_OPTIONS,
    verified,
    published: verified,
    views: 80 + ((n * 29) % 200),
    favs: 6 + ((n * 7) % 40),
    agencies,
    photos: ROOM_PHOTOS,
    highlights: [hint, kind, `${builtYear}년 준공`],
    description: `${hint} 거리의 ${kind}입니다.\n풀옵션이라 가방만 들고 들어오시면 되고, 관리비에 인터넷과 수도 요금이 포함되어 있어요.\n채광이 좋은 남향이며 건물 1층에 CCTV와 공동현관 잠금장치가 있습니다.`,
  };
}

const SINDAE = { nearby: NEARBY_SINDAE } as const;

const SEEDS: readonly Seed[] = [
  apt(
    'L01',
    '100412',
    'C01',
    1,
    '103동',
    22,
    D.SOUTH,
    SALE,
    { price: 44500 },
    '2026-11-22',
    ['B01', 'B02', 'B03'],
    {
      ...SINDAE,
      published: '2026-11-20',
      views: 312,
      favs: 128,
      feeWon: 240000,
      photos: [
        ['exterior', '단지 전경 · 신대 호수공원에서'],
        ['living', '거실 · 남향'],
        ['kitchen', '주방 · 2023 수리'],
        ['plan', '평면도 34A'],
        ['view', '거실 조망 · 호수공원'],
        ['bedroom', '안방'],
        ['bath', '안방 욕실'],
        ['bedroom', '작은방 1'],
        ['bedroom', '작은방 2'],
        ['bath', '공용 욕실'],
        ['entrance', '현관 중문'],
        ['living', '거실 · 야간'],
        ['exterior', '단지 정문'],
        ['view', '단지 산책로'],
      ],
      highlights: [
        '호수공원 정면 조망',
        '2023년 부분 수리',
        '초등학교 도보 5분',
        '시스템에어컨 3대',
      ],
      description:
        '거실 창으로 신대 호수공원이 정면으로 보이는 103동 고층 세대입니다.\n2023년에 주방 상판과 싱크대, 거실 조명, 도배를 새로 했고 시스템에어컨이 거실과 안방, 작은방에 설치되어 있습니다. 확장형이라 거실이 넓고, 안방에 드레스룸과 전용 욕실이 있어요.\n단지 정문에서 호수초등학교까지 아이 걸음으로 5분, 단지 안에 국공립 어린이집이 있습니다. 광양·여수 방면 출퇴근은 남해고속도로 해룡IC까지 차로 6분입니다.\n현재 소유자가 거주 중이라 방문은 하루 전 예약해 주세요. 입주는 2027년 2월 전후로 맞춰 드릴 수 있습니다.',
    },
  ),
  apt(
    'L02',
    '100409',
    'C03',
    1,
    '205동',
    11,
    D.SOUTH_EAST,
    DealType.PRESALE,
    { price: 41900, premium: 2700 },
    '2026-11-22',
    ['B05', 'B01'],
    {
      moveIn: '2027-03-31',
      highlights: ['2027년 3월 입주', '분양가 3억 9,200', '중도금 무이자'],
    },
  ),
  apt(
    'L03',
    '100401',
    'C02',
    1,
    '108동',
    8,
    D.SOUTH,
    DealType.JEONSE,
    { price: 24000 },
    '2026-11-21',
    ['B03', 'B02', 'B07', 'B04'],
  ),
  apt(
    'L04',
    '100398',
    'C04',
    0,
    '102동',
    3,
    D.SOUTH_WEST,
    DealType.MONTHLY,
    { deposit: 2000, rent: 65 },
    '2026-11-21',
    ['B02'],
    {
      status: ListingStatus.RESERVED,
    },
  ),
  apt('L05', '100391', 'C05', 0, '107동', 17, D.SOUTH, SALE, { price: 25200 }, '2026-11-20', [
    'B04',
    'B02',
  ]),
  apt(
    'L06',
    '100388',
    'C06',
    1,
    '301동',
    13,
    D.SOUTH,
    SALE,
    { price: 46000 },
    '2026-11-20',
    ['B01', 'B02', 'B05'],
    SINDAE,
  ),
  apt(
    'L07',
    '100377',
    'C03',
    0,
    '210동',
    4,
    D.EAST,
    DealType.PRESALE,
    { price: 33800, premium: -1200 },
    '2026-11-19',
    ['B05'],
    {
      moveIn: '2027-03-31',
    },
  ),
  apt(
    'L08',
    '100370',
    'C08',
    0,
    '104동',
    13,
    D.SOUTH,
    DealType.JEONSE,
    { price: 16500 },
    '2026-11-19',
    ['B08', 'B02'],
  ),
  // Extra asks so "비슷한 매물" has depth.
  apt(
    'L11',
    '100405',
    'C01',
    1,
    '108동',
    12,
    D.SOUTH_EAST,
    SALE,
    { price: 42000 },
    '2026-11-21',
    ['B01', 'B02'],
    SINDAE,
  ),
  apt(
    'L12',
    '100399',
    'C01',
    2,
    '101동',
    21,
    D.SOUTH,
    SALE,
    { price: 48500 },
    '2026-11-20',
    ['B01'],
    SINDAE,
  ),
  apt(
    'L13',
    '100384',
    'C01',
    1,
    '105동',
    6,
    D.SOUTH,
    SALE,
    { price: 43000 },
    '2026-11-18',
    ['B02', 'B01'],
    SINDAE,
  ),
  apt(
    'L14',
    '100380',
    'C01',
    0,
    '110동',
    15,
    D.SOUTH_WEST,
    SALE,
    { price: 39000 },
    '2026-11-17',
    ['B01', 'B03'],
    SINDAE,
  ),
  apt(
    'L15',
    '100376',
    'C06',
    0,
    '305동',
    19,
    D.SOUTH,
    SALE,
    { price: 41500 },
    '2026-11-19',
    ['B01', 'B05'],
    SINDAE,
  ),
  apt(
    'L16',
    '100362',
    'C01',
    1,
    '107동',
    9,
    D.SOUTH,
    DealType.JEONSE,
    { price: 28500 },
    '2026-11-18',
    ['B01', 'B02'],
    SINDAE,
  ),
  apt('L17', '100358', 'C02', 1, '103동', 12, D.SOUTH_EAST, SALE, { price: 37500 }, '2026-11-17', [
    'B03',
    'B07',
  ]),
  apt('L18', '100351', 'C05', 1, '102동', 9, D.SOUTH, SALE, { price: 28800 }, '2026-11-16', [
    'B04',
  ]),
  apt(
    'L19',
    '100349',
    'C02',
    0,
    '110동',
    5,
    D.SOUTH,
    DealType.JEONSE,
    { price: 21500 },
    '2026-11-16',
    ['B03', 'B02'],
  ),
  apt('L20', '100344', 'C07', 1, '203동', 10, D.SOUTH, SALE, { price: 27500 }, '2026-11-15', [
    'B07',
    'B03',
  ]),
  room(
    'R01',
    '100407',
    '석현동 해오름빌',
    '석현동',
    '1215010900',
    '순천대 정문 도보 6분',
    '투룸',
    [3, 4],
    2019,
    DealType.MONTHLY,
    { deposit: 500, rent: 42 },
    '2026-11-21',
    ['B06', 'B02', 'B08', 'B03'],
    [34.9682, 127.4812],
    39.6,
  ),
  room(
    'R02',
    '100403',
    '덕월동 청암하우스',
    '덕월동',
    '1215011500',
    '청암대 후문 도보 4분',
    '원룸',
    [2, 5],
    2015,
    DealType.MONTHLY,
    { deposit: 300, rent: 32 },
    '2026-11-22',
    ['B06', 'B04'],
    [34.9281, 127.4893],
    23.1,
  ),
  room(
    'R03',
    '100395',
    '석현동 그린캠퍼스',
    '석현동',
    '1215010900',
    '순천대 도보 9분',
    '1.5룸',
    [4, 5],
    2021,
    DealType.MONTHLY,
    { deposit: 500, rent: 38 },
    '2026-11-20',
    ['B06', 'B08', 'B02'],
    [34.9668, 127.4835],
    29.7,
  ),
  room(
    'R04',
    '100390',
    '조례동 호수뷰 오피스텔',
    '조례동',
    '1215011100',
    '조례호수공원 앞',
    '원룸',
    [9, 15],
    2018,
    DealType.MONTHLY,
    { deposit: 1000, rent: 45 },
    '2026-11-20',
    ['B02'],
    [34.9588, 127.5248],
    26.4,
  ),
  room(
    'R05',
    '100379',
    '연향동 센트로빌',
    '연향동',
    '1215011200',
    '연향 패션거리 인근',
    '투룸',
    [2, 4],
    2012,
    DealType.JEONSE,
    { price: 9500 },
    '2026-11-19',
    ['B03', 'B07'],
    [34.9402, 127.5188],
    42.9,
  ),
  room(
    'R06',
    '100366',
    '장천동 역세권 스테이',
    '장천동',
    '1215010500',
    '순천역 도보 8분',
    '원룸',
    [3, 6],
    2016,
    DealType.MONTHLY,
    { deposit: 200, rent: 35 },
    '2026-11-18',
    ['B06'],
    [34.9447, 127.4992],
    21.5,
  ),
  {
    code: 'H01',
    no: '100355',
    asset: AssetType.HOUSE,
    deal: SALE,
    name: '왕지동 2층 단독주택',
    emdName: '왕지동',
    emdCode: '1215012300',
    region: '왕지동',
    road: '순천시 왕지동 [도로명 주소]',
    lat: 34.9712,
    lng: 127.5372,
    floor: 1,
    totalFloors: 2,
    excl: 132.4,
    supply: 148.2,
    land: 231,
    rooms: 4,
    baths: 2,
    direction: D.SOUTH,
    price: 32000,
    builtYear: 2008,
    parking: 2,
    heating: '개별난방 (도시가스)',
    options: [O.AIR_CONDITIONER, O.PARKING, O.VERANDA, O.PET_ALLOWED],
    verified: '2026-11-18',
    published: '2026-11-15',
    views: 143,
    favs: 21,
    agencies: ['B08', 'B02'],
    photos: [
      ['villa', '주택 전경'],
      ['living', '거실'],
      ['kitchen', '주방'],
      ['bedroom', '안방'],
    ],
    highlights: ['마당 있는 단독', '주차 2대', '봉화산 둘레길 도보 7분'],
    description:
      '남향 마당이 있는 2층 단독주택입니다.\n2019년에 지붕과 외벽을 손봤고 1층 거실과 주방을 한 공간으로 텄습니다. 2층은 방 두 개와 작은 거실로 분리되어 부모님과 함께 살기에도 좋아요.\n골목이 넓어 차량 진입이 편하고 대문 안에 2대 주차할 수 있습니다.',
  },
  {
    code: 'M01',
    no: '100347',
    asset: AssetType.COMMERCIAL,
    deal: DealType.MONTHLY,
    name: '연향동 1층 코너 상가',
    emdName: '연향동',
    emdCode: '1215011200',
    region: '연향동',
    road: '순천시 연향동 [도로명 주소]',
    lat: 34.9408,
    lng: 127.5206,
    floor: 1,
    totalFloors: 5,
    excl: 66.1,
    supply: 82.6,
    baths: 1,
    direction: D.SOUTH_EAST,
    deposit: 3000,
    rent: 180,
    feeWon: 150000,
    builtYear: 2014,
    parking: 12,
    heating: '개별 냉난방',
    buildingUse: '제2종 근린생활시설',
    options: [O.AIR_CONDITIONER, O.PARKING, O.CCTV, O.ELEVATOR],
    verified: '2026-11-17',
    published: '2026-11-14',
    views: 98,
    favs: 9,
    agencies: ['B03', 'B07', 'B02'],
    photos: [
      ['shop', '상가 전면'],
      ['room', '내부'],
      ['entrance', '출입구'],
    ],
    highlights: ['코너 자리 · 전면 9m', '권리금 없음', '패션거리 유동인구'],
    description:
      '연향 패션거리 초입 코너 1층 상가입니다.\n전면이 9m로 넓어 간판이 잘 보이고, 현재 공실이라 바로 인테리어를 시작할 수 있습니다. 권리금은 없습니다.\n건물 뒤 공용 주차장을 함께 쓸 수 있어요.',
  },
  {
    code: 'T01',
    no: '100339',
    asset: AssetType.LAND,
    deal: SALE,
    name: '해룡면 신대리 대지',
    emdName: '해룡면 신대리',
    emdCode: '1215032021',
    region: '신대지구',
    road: '순천시 해룡면 신대리 [지번]',
    ...off(620, -420),
    land: 512,
    price: 18500,
    zoning: '제2종일반주거지역',
    landCategory: '대',
    published: '2026-11-12',
    views: 77,
    favs: 12,
    agencies: ['B01', 'B05'],
    photos: [],
    highlights: ['6m 도로 접함', '건축 가능', '신대지구 생활권'],
    description:
      '신대지구 생활권의 반듯한 대지입니다.\n남쪽으로 6m 도로에 접해 있어 단독주택이나 상가주택을 짓기에 좋습니다.\n측량과 경계 확인을 마쳤고, 지목은 대입니다.',
  },
];

/** Canonical id (`mockUuid('L01')`), the same in every mock (list, map, complex, agency, my page). */
export const mockListingId = (code: string) => mockUuid(code);
const BY_ID = new Map<string, Seed>();
for (const s of SEEDS) BY_ID.set(mockListingId(s.code), s);
export const MOCK_LISTING_CODES = SEEDS.map((s) => s.code);

const iso = (date: string, time = '10:00:00') => `${date}T${time}+09:00`;
const complexOfSeed = (seed: Seed) => (seed.complex ? complexByCode(seed.complex) : undefined);

function pyeongLabelOf(seed: Seed): string | null {
  const a = seed.type !== undefined ? complexOfSeed(seed)?.areas[seed.type] : undefined;
  return a ? `${a.pyeong}평` : null;
}

function toComplex(seed: Seed): ListingComplex | null {
  const c = complexOfSeed(seed);
  if (!c) return null;
  const t = seed.type !== undefined ? c.areas[seed.type] : undefined;
  const lease = seed.deal === DealType.JEONSE || seed.deal === DealType.MONTHLY;
  const tradePrice = t && c.builtYear <= 2026 ? (lease ? t.jeonse : t.sale) : 0;
  return {
    id: complexIdOf(c.code),
    name: c.name,
    emdName: c.emdName,
    households: c.households,
    builtYear: c.builtYear,
    approvalDate: c.approvalDate,
    parkingPerHousehold: c.parkingPerHousehold,
    heatingType: c.heating,
    avgPricePerPyeong: c.perPyeong,
    areaTypes: c.areas.map((x) => ({
      id: areaTypeIdOf(c.code, x),
      exclusiveArea: x.exclusive,
      supplyArea: x.supply,
      pyeongLabel: `${x.pyeong}평`,
    })),
    latestTrade:
      t && tradePrice > 0
        ? {
            price: tradePrice,
            dealDate: `${String(t.saleYm).slice(0, 4)}-${String(t.saleYm).slice(4)}-14`,
            floor: 17,
            pyeongLabel: `${t.pyeong}평`,
          }
        : null,
  };
}

function photoUrl(seed: Seed, index: number): string {
  const [scene] = seed.photos[index]!;
  const variant = (seed.code.charCodeAt(1) + seed.code.charCodeAt(2) + index) % 6;
  return `/mock-api/v1/listings/mock-photo/${scene}-${variant}`;
}

function toDetail(seed: Seed, id = mockListingId(seed.code)): ListingDetail {
  const c = complexOfSeed(seed);
  const exact = seed.floorDisplay !== FloorDisplay.CLASS;
  const feeItems =
    seed.asset === AssetType.ONEROOM
      ? ['인터넷', '수도', '공용 전기']
      : ['일반관리비', '청소비', '승강기 유지비'];
  return {
    id,
    listingNo: seed.no,
    status: seed.status ?? ListingStatus.ACTIVE,
    dealType: seed.deal,
    assetType: seed.asset,
    title: seed.dong ? `${seed.name} ${seed.dong}` : seed.name,
    description:
      seed.description ??
      `${seed.name}${seed.dong ? ` ${seed.dong}` : ''} 매물입니다.\n채광이 좋고 관리 상태가 깨끗합니다. 주변에 학교와 마트가 가까워 생활이 편리해요.\n방문은 하루 전에 예약해 주세요.`,
    highlights: [...(seed.highlights ?? [])],
    salePrice: seed.deal === SALE ? (seed.price ?? null) : null,
    deposit: seed.deal === DealType.JEONSE ? (seed.price ?? null) : (seed.deposit ?? null),
    monthlyRent: seed.rent ?? null,
    presalePrice:
      seed.deal === DealType.PRESALE && seed.price !== undefined
        ? seed.price - (seed.premium ?? 0)
        : null,
    premium: seed.premium ?? null,
    maintenanceFeeWon: seed.feeWon ?? null,
    maintenanceFeeItems: seed.feeWon ? feeItems : [],
    moveInType: seed.moveIn
      ? MoveInType.DATE
      : seed.asset === AssetType.ONEROOM
        ? MoveInType.IMMEDIATE
        : MoveInType.NEGOTIABLE,
    moveInDate: seed.moveIn ?? null,
    floorDisplay: seed.floorDisplay ?? FloorDisplay.EXACT,
    floorClass:
      seed.floor !== undefined && seed.totalFloors
        ? floorClassOf(seed.floor, seed.totalFloors)
        : null,
    options: [...(seed.options ?? [])],
    publishedAt: iso(seed.published, '09:20:00'),
    updatedAt: iso(seed.verified ?? seed.published, '14:05:00'),
    verifiedAt: seed.verified ? iso(seed.verified, '14:05:00') : null,
    viewCount: seed.views,
    favoriteCount: seed.favs,
    property: {
      roadAddress: seed.road,
      jibunAddress: null,
      buildingName: seed.name,
      dong: seed.dong ?? null,
      emdCode: seed.emdCode,
      emdName: seed.emdName,
      lat: seed.lat,
      lng: seed.lng,
      floor: exact ? (seed.floor ?? null) : null,
      totalFloors: seed.totalFloors ?? null,
      exclusiveArea: seed.excl ?? null,
      supplyArea: seed.supply ?? null,
      landArea: seed.land ?? null,
      totalFloorArea: null,
      areaTypeId: c && seed.type !== undefined ? areaTypeIdOf(c.code, c.areas[seed.type]!) : null,
      rooms: seed.rooms ?? null,
      roomType: seed.roomType ?? null,
      baths: seed.baths ?? null,
      direction: seed.direction ?? null,
      directionBasis: seed.direction
        ? seed.asset === AssetType.COMMERCIAL
          ? DirectionBasis.ENTRANCE
          : DirectionBasis.LIVING_ROOM
        : null,
      approvalDate: c?.approvalDate ?? (seed.builtYear ? `${seed.builtYear}-05-20` : null),
      parkingSpaces:
        seed.parking !== undefined
          ? c
            ? Math.round(c.households * c.parkingPerHousehold)
            : seed.parking
          : null,
      heatingType: seed.heating ?? null,
      zoning: seed.zoning ?? null,
      landCategory: seed.landCategory ?? null,
      buildingUse: seed.buildingUse ?? null,
    },
    complex: toComplex(seed),
    photos: seed.photos.map(([, caption], i) => ({
      id: mockUuid(`${seed.code}-P${i}`),
      url: photoUrl(seed, i),
      thumbUrl: photoUrl(seed, i),
      caption,
      isCover: i === 0,
    })),
    verifications: seed.verified
      ? [
          {
            method: VerificationMethod.REGISTRY,
            verifiedAt: iso(seed.published),
            note: '소유자 · 면적 일치',
          },
          {
            method: VerificationMethod.OWNER_CALL,
            verifiedAt: iso(seed.published),
            note: '전화 확인',
          },
          {
            method: VerificationMethod.SITE_VISIT,
            verifiedAt: iso(seed.verified),
            note: `사진 ${seed.photos.length}장`,
          },
        ]
      : [],
    agencies: seed.agencies.map((code, i) => agencyOf(code, i === 0)),
    nearby: [...(seed.nearby ?? nearbyFor(seed.lat, seed.lng))],
  };
}

function toSummary(seed: Seed): ListingSummary {
  const d = toDetail(seed);
  return toListingSummary({
    id: d.id,
    dealType: d.dealType,
    assetType: d.assetType,
    status: d.status,
    complexId: d.complex?.id ?? null,
    complexName: seed.complex ? seed.name : null,
    buildingName: seed.complex ? null : seed.name,
    dong: seed.dong ?? null,
    pyeongLabel: pyeongLabelOf(seed),
    emdName: seed.emdName,
    lat: seed.lat,
    lng: seed.lng,
    salePrice: d.salePrice,
    deposit: d.deposit,
    monthlyRent: d.monthlyRent,
    presalePrice: d.presalePrice,
    premium: d.premium,
    exclusiveArea: seed.excl ?? null,
    supplyArea: seed.supply ?? null,
    landArea: seed.land ?? null,
    floor: d.property.floor,
    totalFloors: seed.totalFloors ?? null,
    floorClass: d.floorClass,
    direction: seed.direction ?? null,
    rooms: seed.rooms ?? null,
    baths: seed.baths ?? null,
    builtYear: seed.builtYear ?? null,
    verifiedAt: d.verifiedAt,
    publishedAt: d.publishedAt,
    agencyCount: seed.agencies.length,
    photoCount: d.photos.length,
    coverPhotoUrl: d.photos[0]?.url ?? null,
  });
}

/**
 * Apartment listings generated by the complex mocks (`./_fixtures.ts`, w-complex) get a detail page
 * too: the public list item is expanded with the complex's 평형, offices and stock photos.
 */
function seedFromComplexListing(l: MockListing): Seed | undefined {
  const c = COMPLEX_SPECS.find((x) => x.code === l.complexCode);
  if (!c) return undefined;
  const type = Math.max(
    0,
    c.areas.findIndex((x) => areaTypeIdOf(c.code, x) === l.areaTypeId),
  );
  const total = l.totalFloors ?? c.floorsMax;
  const floor =
    l.floor ??
    (l.floorClass === 'LOW' ? 2 : l.floorClass === 'MID' ? Math.round(total / 2) : total - 2);
  const verified = (l.verifiedAt ?? l.publishedAt ?? '2026-11-20').slice(0, 10);
  const n = [...l.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return apt(
    `G${String(n % 90).padStart(2, '0')}`,
    String(110_000 + (n % 90_000)),
    c.code,
    type,
    l.dong ?? '',
    floor,
    l.direction ?? Direction.SOUTH,
    l.dealType,
    {
      price:
        l.salePrice ??
        (l.presalePrice !== null ? l.presalePrice + (l.premium ?? 0) : undefined) ??
        (l.dealType === DealType.JEONSE ? (l.deposit ?? undefined) : undefined),
      deposit: l.dealType === DealType.MONTHLY ? (l.deposit ?? undefined) : undefined,
      rent: l.monthlyRent ?? undefined,
      premium: l.premium ?? undefined,
    },
    verified,
    l.agencies.map((x) => x.code),
    {
      floorDisplay: l.floorDisplay === 'EXACT' ? FloorDisplay.EXACT : FloorDisplay.CLASS,
      moveIn: l.moveInDate ?? undefined,
      highlights: l.title ? [l.title] : [],
      photos: APT_PHOTOS.slice(0, Math.max(1, Math.min(APT_PHOTOS.length, l.photoCount))),
      ...(c.districtName === '신대지구' ? SINDAE : {}),
    },
  );
}

const OFFICE_CODES = AGENCIES.map((a) => a[0]);
/** Asset types without a seed of their own borrow the nearest kind. */
const SEED_ASSET: Partial<Record<AssetType, AssetType>> = {
  [AssetType.OFFICETEL]: AssetType.ONEROOM,
};
const sq = (n: number) => n * n;

/** The seed a generated card borrows photos, description and offices from: same kind, nearest. */
function closestSeed(l: ListingSummary): Seed {
  const asset = SEED_ASSET[l.assetType] ?? l.assetType;
  const pool = SEEDS.filter((s) => s.asset === asset && s.status !== ListingStatus.CLOSED);
  const candidates = pool.length > 0 ? pool : SEEDS;
  const score = (s: Seed) =>
    (s.deal === l.dealType ? 0 : 1) +
    (l.lat != null && l.lng != null ? sq(s.lat - l.lat) + sq(s.lng - l.lng) : 0);
  return [...candidates].sort((x, y) => score(x) - score(y))[0]!;
}

/** Index of the complex 평형 closest to the card's supply area. */
function closestType(c: MockComplexSpec, l: ListingSummary): number {
  const supply = l.supplyArea ?? 0;
  let best = 0;
  c.areas.forEach((a, i) => {
    if (Math.abs(a.supply - supply) < Math.abs(c.areas[best]!.supply - supply)) best = i;
  });
  return best;
}

/**
 * Detail seed for a card that only exists in another mock (map inventory, agency pages): the
 * closest seed of the same asset type supplies photos, description and offices; id, name, prices,
 * areas, floor, 동 and coordinates come from the card, so the detail page matches what was clicked.
 */
function seedFromSummary(hit: MockSummaryHit): Seed {
  const l = hit.listing;
  const base = closestSeed(l);
  const spec = l.complexId
    ? COMPLEX_SPECS.find((c) => complexIdOf(c.code) === l.complexId)
    : undefined;
  const n = [...l.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const emdName = l.emdName ?? spec?.emdName ?? base.emdName;
  const totalFloors = l.totalFloors ?? spec?.floorsMax ?? base.totalFloors;
  const floor =
    l.floor ??
    (totalFloors && l.floorClass
      ? l.floorClass === 'LOW'
        ? 2
        : l.floorClass === 'MID'
          ? Math.round(totalFloors / 2)
          : totalFloors - 2
      : base.floor);
  const lease = l.dealType === DealType.JEONSE;
  const money: Money =
    l.dealType === DealType.MONTHLY
      ? { deposit: l.deposit ?? undefined, rent: l.monthlyRent ?? undefined }
      : l.dealType === DealType.PRESALE
        ? {
            price:
              l.presalePrice !== null && l.presalePrice !== undefined
                ? l.presalePrice + (l.premium ?? 0)
                : undefined,
            premium: l.premium ?? undefined,
          }
        : { price: (lease ? l.deposit : l.salePrice) ?? undefined };
  // The advertising office (agency pages) leads; the seed's offices fill up to the card's count.
  const offices = [
    ...new Set([
      ...(hit.officeKey && OFFICE_CODES.includes(hit.officeKey) ? [hit.officeKey] : []),
      ...base.agencies,
      ...OFFICE_CODES,
    ]),
  ].slice(0, Math.max(1, l.agencyCount));
  const verified = l.verifiedAt?.slice(0, 10);
  return {
    ...base,
    code: `${base.code}${String(n % 900).padStart(3, '0')}`,
    no: String(110_000 + (n % 90_000)),
    asset: l.assetType,
    deal: l.dealType,
    status: l.status,
    complex: spec?.code,
    type: spec ? closestType(spec, l) : undefined,
    name: listingDisplayName(l),
    dong: l.dong ?? undefined,
    emdName,
    emdCode: hit.emdCode ?? spec?.emdCode ?? base.emdCode,
    region: spec ? regionOf(spec) : emdName,
    road: spec?.road ?? `순천시 ${emdName} [도로명 주소]`,
    lat: l.lat ?? spec?.lat ?? base.lat,
    lng: l.lng ?? spec?.lng ?? base.lng,
    floor,
    totalFloors,
    floorDisplay: l.floor != null ? FloorDisplay.EXACT : FloorDisplay.CLASS,
    excl: l.exclusiveArea ?? undefined,
    supply: l.supplyArea ?? undefined,
    land: l.landArea ?? undefined,
    rooms: l.rooms ?? base.rooms,
    roomType: l.roomType ?? base.roomType,
    baths: l.baths ?? base.baths,
    direction: l.direction ?? base.direction,
    price: undefined,
    deposit: undefined,
    rent: undefined,
    premium: undefined,
    ...money,
    builtYear: l.builtYear ?? spec?.builtYear ?? base.builtYear,
    verified,
    published: (l.publishedAt ?? l.verifiedAt ?? `${base.published}`).slice(0, 10),
    agencies: offices,
    highlights: l.title ? [l.title] : base.highlights,
    // Recomputed around the card's own position.
    nearby: undefined,
  };
}

/**
 * Accepts the canonical mock uuid, the short fixture code ("L01", "r02") or the id of any card
 * served by another mock (complex listings, map inventory, agency pages).
 */
function resolve(idOrCode: string): { seed: Seed; id: string } | undefined {
  const byId = BY_ID.get(idOrCode);
  if (byId) return { seed: byId, id: idOrCode };
  const byCode = SEEDS.find((s) => s.code === idOrCode.toUpperCase());
  if (byCode) return { seed: byCode, id: mockListingId(byCode.code) };
  const generated = findComplexListing(idOrCode);
  const seed = generated ? seedFromComplexListing(generated) : undefined;
  if (seed) return { seed, id: idOrCode };
  const hit = findMockListingSummary(idOrCode);
  return hit ? { seed: seedFromSummary(hit), id: idOrCode } : undefined;
}

/** GET /listings/:id */
export function findMockListingDetail(idOrCode: string): ListingDetail | undefined {
  const hit = resolve(idOrCode);
  return hit ? toDetail(hit.seed, hit.id) : undefined;
}

const headline = (s: Seed) =>
  s.deal === DealType.MONTHLY ? (s.deposit ?? 0) + (s.rent ?? 0) * 100 : (s.price ?? 0);
const eok = (manwon: number) => `${Math.floor(manwon / 10000)}억`;
const DEAL_WORD: Record<DealType, string> = {
  SALE: '매매',
  JEONSE: '전세',
  MONTHLY: '월세',
  PRESALE: '분양권',
};
const REGION_COUNT: Record<string, number> = {
  신대지구: 318,
  연향동: 412,
  조례동: 286,
  오천지구: 201,
  왕지동: 154,
  석현동: 121,
  선월지구: 97,
};

/** GET /listings/:id/similar */
export function findMockSimilar(idOrCode: string): SimilarListings | undefined {
  const seed = resolve(idOrCode)?.seed;
  if (!seed) return undefined;
  // Generated cards (map / agency mocks) compare against the seeds of their kind.
  const kind = (a: AssetType) => SEED_ASSET[a] ?? a;
  const others = SEEDS.filter((s) => s.code !== seed.code && kind(s.asset) === kind(seed.asset));
  const price = headline(seed);
  const size = (s: Seed) => s.excl ?? s.land ?? 0;
  const sameComplex = seed.complex ? others.filter((s) => s.complex === seed.complex) : [];
  const sameArea = others.filter(
    (s) => s.complex !== seed.complex && Math.abs(size(s) - size(seed)) <= 16,
  );
  const samePrice = others.filter(
    (s) =>
      s.deal === seed.deal &&
      !sameComplex.includes(s) &&
      Math.abs(headline(s) - price) <= Math.max(price * 0.2, 500),
  );
  const top = (list: Seed[]) => list.slice(0, 8).map(toSummary);
  const isL01 = seed.code === 'L01';
  const groups: SimilarListings['groups'] = [
    {
      key: 'SAME_COMPLEX',
      label: '같은 단지',
      total: isL01 ? 12 : sameComplex.length,
      items: top(sameComplex),
    },
    {
      key: 'SAME_AREA',
      label: `${seed.region} 같은 ${seed.asset === AssetType.LAND ? '면적' : '평형'}`,
      total: isL01 ? 41 : sameArea.length,
      items: top(sameArea),
    },
    {
      key: 'SAME_PRICE',
      label: '같은 가격대',
      total: isL01 ? 63 : samePrice.length,
      items: top(samePrice),
    },
  ];
  const band = price >= 10000 ? `${eok(price * 0.9)}~${eok(price * 1.1 + 10000)}` : null;
  return {
    criteria: [seed.region, DEAL_WORD[seed.deal], pyeongLabelOf(seed), band]
      .filter(Boolean)
      .join(' · '),
    regionName: seed.region,
    regionListingCount: REGION_COUNT[seed.region] ?? 88,
    groups: groups.filter((g) => g.items.length > 0),
  };
}
