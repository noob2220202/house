import { AssetType, DealType, Direction, FloorClass, ListingStatus } from '@house/shared';
import { mockUuid } from '@/lib/mock';

/**
 * List-item fixtures for `GET /listings` (w-home: "방금 확인된 실매물"). All fictional, from
 * design/drafts/system/mockdata.md §2–3. Codes and ids match the detail seeds in
 * `_detail-fixtures.ts` (w-listing) so cards link to an existing detail page:
 * id = mockUuid('L01'), complex id = mockUuid('C01').
 *
 * Public fields only — never 호수 or owner contact. Served through `toListingSummary()`
 * (`./_summary.ts`), like every other listing-card mock.
 */
export interface MockListingItem {
  code: string;
  id: string;
  assetType: AssetType;
  dealType: DealType;
  status: ListingStatus;
  /** Broker headline (Listing.title) — houses, shops and land are named by it. */
  title: string | null;
  /** Complex.name (아파트). */
  complexName: string | null;
  /** Property.buildingName (원룸·투룸). */
  buildingName: string | null;
  /** 동 (public). */
  dong: string | null;
  complexId: string | null;
  emdCode: string;
  emdName: string;
  /** Free location hint for non-complex listings ("순천대 정문 도보 6분"). */
  locationNote: string | null;
  /** "투룸" · "원룸" · "1.5룸" for ONEROOM listings. */
  roomType: string | null;
  salePrice: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  presalePrice: number | null;
  premium: number | null;
  exclusiveArea: number | null;
  supplyArea: number | null;
  landArea: number | null;
  floor: number | null;
  totalFloors: number | null;
  floorClass: FloorClass | null;
  rooms: number | null;
  baths: number | null;
  direction: Direction | null;
  builtYear: number | null;
  /** Sort key in 만원 (see listings.price_sort). */
  priceSort: number;
  verifiedAt: string | null;
  publishedAt: string;
  agencyCount: number;
  photoCount: number;
  coverPhotoUrl: string | null;
  lat: number;
  lng: number;
}

const at = (date: string, time: string) => `${date}T${time}+09:00`;

type Price =
  | { sale: number }
  | { jeonse: number }
  | { monthly: [number, number] }
  | { presale: [number, number] };

function price(p: Price) {
  const base = {
    salePrice: null,
    deposit: null,
    monthlyRent: null,
    presalePrice: null,
    premium: null,
  };
  if ('sale' in p)
    return { ...base, salePrice: p.sale, dealType: DealType.SALE, priceSort: p.sale };
  if ('jeonse' in p)
    return { ...base, deposit: p.jeonse, dealType: DealType.JEONSE, priceSort: p.jeonse };
  if ('monthly' in p)
    return {
      ...base,
      deposit: p.monthly[0],
      monthlyRent: p.monthly[1],
      dealType: DealType.MONTHLY,
      priceSort: p.monthly[0],
    };
  // 분양권: headline = 분양가 + 프리미엄.
  return {
    ...base,
    presalePrice: p.presale[0] - p.presale[1],
    premium: p.presale[1],
    dealType: DealType.PRESALE,
    priceSort: p.presale[0],
  };
}

const COMPLEX: Record<
  string,
  { name: string; emdName: string; emdCode: string; built: number; lat: number; lng: number }
> = {
  C01: {
    name: '신대 레이크파크 1단지',
    emdName: '해룡면 신대리',
    emdCode: '1215032021',
    built: 2019,
    lat: 34.9335,
    lng: 127.556,
  },
  C02: {
    name: '연향 센트럴',
    emdName: '연향동',
    emdCode: '1215011200',
    built: 2016,
    lat: 34.9395,
    lng: 127.5215,
  },
  C03: {
    name: '선월 하이츠 2차',
    emdName: '해룡면 선월리',
    emdCode: '1215032022',
    built: 2027,
    lat: 34.92,
    lng: 127.57,
  },
  C04: {
    name: '조례 호수마을',
    emdName: '조례동',
    emdCode: '1215011100',
    built: 2009,
    lat: 34.96,
    lng: 127.523,
  },
  C05: {
    name: '오천 그린빌',
    emdName: '오천동',
    emdCode: '1215012000',
    built: 2012,
    lat: 34.929,
    lng: 127.501,
  },
  C06: {
    name: '신대 레이크파크 3단지',
    emdName: '해룡면 신대리',
    emdCode: '1215032021',
    built: 2020,
    lat: 34.9318,
    lng: 127.5592,
  },
  C08: {
    name: '왕지 숲속마을',
    emdName: '왕지동',
    emdCode: '1215012300',
    built: 2011,
    lat: 34.97,
    lng: 127.54,
  },
};

function apt(
  code: string,
  complex: keyof typeof COMPLEX,
  dong: string,
  floorClass: FloorClass,
  totalFloors: number,
  areas: [exclusive: number, supply: number],
  direction: Direction,
  p: Price,
  verified: [string, string],
  agencyCount: number,
): MockListingItem {
  const c = COMPLEX[complex]!;
  return {
    code,
    id: mockUuid(code),
    assetType: AssetType.APT,
    status: ListingStatus.ACTIVE,
    title: null,
    complexName: c.name,
    buildingName: null,
    dong,
    complexId: mockUuid(complex),
    emdCode: c.emdCode,
    emdName: c.emdName,
    locationNote: null,
    roomType: null,
    exclusiveArea: areas[0],
    supplyArea: areas[1],
    landArea: null,
    floor: null, // 공동주택: the broker shows 저/중/고 only
    totalFloors,
    floorClass,
    rooms: 3,
    baths: 2,
    direction,
    builtYear: c.built,
    verifiedAt: at(verified[0], verified[1]),
    publishedAt: at(verified[0], '09:00:00'),
    agencyCount,
    photoCount: 0,
    coverPhotoUrl: null,
    lat: c.lat,
    lng: c.lng,
    ...price(p),
  };
}

function room(
  code: string,
  name: string,
  emdName: string,
  emdCode: string,
  locationNote: string,
  roomType: string,
  floors: [number, number],
  builtYear: number,
  exclusiveArea: number,
  p: Price,
  verified: [string, string],
  agencyCount: number,
  pos: [number, number],
): MockListingItem {
  return {
    code,
    id: mockUuid(code),
    assetType: AssetType.ONEROOM,
    status: ListingStatus.ACTIVE,
    title: null,
    complexName: null,
    buildingName: name,
    dong: null,
    complexId: null,
    emdCode,
    emdName,
    locationNote,
    roomType,
    exclusiveArea,
    supplyArea: null,
    landArea: null,
    floor: floors[0],
    totalFloors: floors[1],
    floorClass: null,
    rooms: roomType === '투룸' ? 2 : 1,
    baths: 1,
    direction: null,
    builtYear,
    verifiedAt: at(verified[0], verified[1]),
    publishedAt: at(verified[0], '09:00:00'),
    agencyCount,
    photoCount: 0,
    coverPhotoUrl: null,
    lat: pos[0],
    lng: pos[1],
    ...price(p),
  };
}

const { HIGH, MID, LOW } = FloorClass;
const D = Direction;

export const LISTING_ITEMS: readonly MockListingItem[] = [
  apt(
    'L01',
    'C01',
    '103동',
    HIGH,
    25,
    [84.98, 112.4],
    D.SOUTH,
    { sale: 44500 },
    ['2026-11-22', '16:40:00'],
    3,
  ),
  apt(
    'L02',
    'C03',
    '205동',
    MID,
    20,
    [84.9, 109.1],
    D.SOUTH_EAST,
    { presale: [41900, 2700] },
    ['2026-11-22', '15:10:00'],
    2,
  ),
  apt(
    'L03',
    'C02',
    '108동',
    MID,
    15,
    [84.7, 105.8],
    D.SOUTH,
    { jeonse: 24000 },
    ['2026-11-21', '17:30:00'],
    4,
  ),
  room(
    'R01',
    '석현동 해오름빌',
    '석현동',
    '1215010900',
    '순천대 정문 도보 6분',
    '투룸',
    [3, 4],
    2019,
    39.6,
    { monthly: [500, 42] },
    ['2026-11-21', '14:20:00'],
    4,
    [34.9682, 127.4812],
  ),
  apt(
    'L04',
    'C04',
    '102동',
    LOW,
    18,
    [59.9, 79.3],
    D.SOUTH_WEST,
    { monthly: [2000, 65] },
    ['2026-11-21', '11:00:00'],
    1,
  ),
  room(
    'R02',
    '덕월동 청암하우스',
    '덕월동',
    '1215011500',
    '청암대 후문 도보 4분',
    '원룸',
    [2, 5],
    2015,
    23.1,
    { monthly: [300, 32] },
    ['2026-11-21', '09:30:00'],
    2,
    [34.9281, 127.4893],
  ),
  apt(
    'L05',
    'C05',
    '107동',
    HIGH,
    20,
    [59.8, 79.4],
    D.SOUTH,
    { sale: 25200 },
    ['2026-11-20', '16:00:00'],
    2,
  ),
  apt(
    'L06',
    'C06',
    '301동',
    MID,
    24,
    [99.6, 128.9],
    D.SOUTH,
    { sale: 46000 },
    ['2026-11-20', '13:40:00'],
    3,
  ),
  room(
    'R03',
    '석현동 그린캠퍼스',
    '석현동',
    '1215010900',
    '순천대 도보 9분',
    '1.5룸',
    [4, 5],
    2021,
    29.7,
    { monthly: [500, 38] },
    ['2026-11-20', '12:10:00'],
    3,
    [34.9668, 127.4835],
  ),
  room(
    'R04',
    '조례동 호수뷰 오피스텔',
    '조례동',
    '1215011100',
    '조례호수공원 앞',
    '원룸',
    [9, 15],
    2018,
    26.4,
    { monthly: [1000, 45] },
    ['2026-11-20', '10:00:00'],
    1,
    [34.9588, 127.5248],
  ),
  apt(
    'L07',
    'C03',
    '210동',
    LOW,
    20,
    [59.9, 82.6],
    D.EAST,
    { presale: [33800, -1200] },
    ['2026-11-19', '15:00:00'],
    1,
  ),
  apt(
    'L08',
    'C08',
    '104동',
    HIGH,
    15,
    [59.9, 82.6],
    D.SOUTH,
    { jeonse: 16500 },
    ['2026-11-19', '11:30:00'],
    2,
  ),
  room(
    'R05',
    '연향동 센트로빌',
    '연향동',
    '1215011200',
    '연향 패션거리 인근',
    '투룸',
    [2, 4],
    2012,
    42.9,
    { jeonse: 9500 },
    ['2026-11-19', '10:00:00'],
    2,
    [34.9402, 127.5188],
  ),
  room(
    'R06',
    '장천동 역세권 스테이',
    '장천동',
    '1215010500',
    '순천역 도보 8분',
    '원룸',
    [3, 6],
    2016,
    21.5,
    { monthly: [200, 35] },
    ['2026-11-18', '17:00:00'],
    1,
    [34.9447, 127.4992],
  ),
  {
    code: 'H01',
    id: mockUuid('H01'),
    assetType: AssetType.HOUSE,
    status: ListingStatus.ACTIVE,
    title: '왕지동 2층 단독주택',
    complexName: null,
    buildingName: null,
    dong: null,
    complexId: null,
    emdCode: '1215012300',
    emdName: '왕지동',
    locationNote: '남향 마당 · 주차 2대',
    roomType: null,
    exclusiveArea: 132.4,
    supplyArea: 148.2,
    landArea: 231,
    floor: null,
    totalFloors: 2,
    floorClass: null,
    rooms: 4,
    baths: 2,
    direction: D.SOUTH,
    builtYear: 2008,
    verifiedAt: at('2026-11-18', '15:00:00'),
    publishedAt: at('2026-11-15', '09:00:00'),
    agencyCount: 2,
    photoCount: 0,
    coverPhotoUrl: null,
    lat: 34.9712,
    lng: 127.5372,
    ...price({ sale: 32000 }),
  },
  {
    code: 'M01',
    id: mockUuid('M01'),
    assetType: AssetType.COMMERCIAL,
    status: ListingStatus.ACTIVE,
    title: '연향동 1층 코너 상가',
    complexName: null,
    buildingName: null,
    dong: null,
    complexId: null,
    emdCode: '1215011200',
    emdName: '연향동',
    locationNote: '연향 패션거리 초입',
    roomType: null,
    exclusiveArea: 66.1,
    supplyArea: 82.6,
    landArea: null,
    floor: 1,
    totalFloors: 5,
    floorClass: null,
    rooms: null,
    baths: 1,
    direction: D.SOUTH_EAST,
    builtYear: 2014,
    verifiedAt: at('2026-11-17', '14:00:00'),
    publishedAt: at('2026-11-14', '09:00:00'),
    agencyCount: 3,
    photoCount: 0,
    coverPhotoUrl: null,
    lat: 34.9408,
    lng: 127.5206,
    ...price({ monthly: [3000, 180] }),
  },
  {
    code: 'T01',
    id: mockUuid('T01'),
    assetType: AssetType.LAND,
    status: ListingStatus.ACTIVE,
    title: '해룡면 신대리 대지',
    complexName: null,
    buildingName: null,
    dong: null,
    complexId: null,
    emdCode: '1215032021',
    emdName: '해룡면 신대리',
    locationNote: '6m 도로 접함',
    roomType: null,
    exclusiveArea: null,
    supplyArea: null,
    landArea: 512,
    floor: null,
    totalFloors: null,
    floorClass: null,
    rooms: null,
    baths: null,
    direction: null,
    builtYear: null,
    verifiedAt: at('2026-11-16', '11:00:00'),
    publishedAt: at('2026-11-12', '09:00:00'),
    agencyCount: 2,
    photoCount: 0,
    coverPhotoUrl: null,
    lat: 34.9302,
    lng: 127.5601,
    ...price({ sale: 38500 }),
  },
];
