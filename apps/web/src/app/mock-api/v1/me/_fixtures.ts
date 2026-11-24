import { mockUuid } from '@/lib/mock';
import { toListingSummary, type MockSummarySource } from '../listings/_summary';
import type {
  FavoriteComplex,
  Identity,
  ListingSummary,
  Notification,
} from '@/features/w-me/schemas';

/**
 * Fixtures for the my-page mock resources (all fictional, from design/drafts/system/mockdata.md).
 * Shapes = the zod schemas in src/features/w-me/schemas.ts.
 */

const iso = (date: string, time = '10:00:00') => `${date}T${time}+09:00`;
/** Canonical mock ids — the same `mockUuid(code)` used by /listings, /complexes and the map. */
const complexId = (seed: string) => mockUuid(seed);
export const listingId = (seed: string) => mockUuid(seed);

type ListingFixture = Omit<ListingSummary, 'isFavorite'>;
type FixtureRest = Partial<MockSummarySource> & Pick<MockSummarySource, 'dealType'>;

function apt(
  seed: string,
  complexSeed: string,
  complexName: string,
  emdName: string,
  rest: FixtureRest,
): ListingFixture {
  return toListingSummary({
    id: listingId(seed),
    assetType: 'APT',
    status: 'ACTIVE',
    complexName,
    emdName,
    complexId: complexId(complexSeed),
    agencyCount: 1,
    coverPhotoUrl: null,
    ...rest,
  });
}

function room(
  seed: string,
  buildingName: string,
  emdName: string,
  rest: FixtureRest,
): ListingFixture {
  return toListingSummary({
    id: listingId(seed),
    assetType: 'ONEROOM',
    status: 'ACTIVE',
    buildingName,
    emdName,
    complexId: null,
    agencyCount: 1,
    coverPhotoUrl: null,
    ...rest,
  });
}

/** Listing catalog the my-page mocks can reference (mockdata.md §2 아파트 매물, §3 원룸·투룸). */
export const LISTINGS: readonly ListingFixture[] = [
  apt('L01', 'C01', '신대 레이크파크 1단지', '해룡면 신대리', {
    dealType: 'SALE',
    dong: '103동',
    salePrice: 44500,
    exclusiveArea: 84.98,
    supplyArea: 112.4,
    floorClass: 'HIGH',
    totalFloors: 25,
    direction: 'SOUTH',
    builtYear: 2019,
    verifiedAt: iso('2026-11-22'),
    agencyCount: 3,
  }),
  apt('L02', 'C03', '선월 하이츠 2차', '해룡면 선월리', {
    dealType: 'PRESALE',
    dong: '205동',
    presalePrice: 39200,
    premium: 2700,
    exclusiveArea: 84.9,
    supplyArea: 109.1,
    floorClass: 'MID',
    totalFloors: 20,
    direction: 'SOUTH_EAST',
    verifiedAt: iso('2026-11-22'),
    agencyCount: 2,
  }),
  apt('L03', 'C02', '연향 센트럴', '연향동', {
    dealType: 'JEONSE',
    dong: '108동',
    deposit: 24000,
    exclusiveArea: 84.9,
    supplyArea: 105.8,
    floorClass: 'MID',
    totalFloors: 15,
    direction: 'SOUTH',
    builtYear: 2016,
    verifiedAt: iso('2026-11-21'),
    agencyCount: 4,
  }),
  apt('L04', 'C04', '조례 호수마을', '조례동', {
    dealType: 'MONTHLY',
    dong: '102동',
    deposit: 2000,
    monthlyRent: 65,
    exclusiveArea: 59.9,
    supplyArea: 79.3,
    floorClass: 'LOW',
    totalFloors: 18,
    direction: 'SOUTH_WEST',
    builtYear: 2009,
    verifiedAt: iso('2026-11-21'),
    agencyCount: 1,
  }),
  apt('L05', 'C05', '오천 그린빌', '오천동', {
    dealType: 'SALE',
    status: 'CLOSED',
    dong: '107동',
    salePrice: 25200,
    exclusiveArea: 59.9,
    supplyArea: 79.3,
    floorClass: 'HIGH',
    totalFloors: 20,
    direction: 'SOUTH',
    builtYear: 2012,
    verifiedAt: iso('2026-11-20'),
    agencyCount: 2,
  }),
  apt('L06', 'C06', '신대 레이크파크 3단지', '해룡면 신대리', {
    dealType: 'SALE',
    dong: '301동',
    salePrice: 46000,
    exclusiveArea: 101.9,
    supplyArea: 128.9,
    floorClass: 'MID',
    totalFloors: 24,
    direction: 'SOUTH',
    builtYear: 2020,
    verifiedAt: iso('2026-11-20'),
    agencyCount: 3,
  }),
  apt('L07', 'C03', '선월 하이츠 2차', '해룡면 선월리', {
    dealType: 'PRESALE',
    dong: '210동',
    presalePrice: 35000,
    premium: -1200,
    exclusiveArea: 59.9,
    supplyArea: 82.6,
    floorClass: 'LOW',
    totalFloors: 20,
    direction: 'EAST',
    verifiedAt: iso('2026-11-19'),
    agencyCount: 1,
  }),
  apt('L08', 'C08', '왕지 숲속마을', '왕지동', {
    dealType: 'JEONSE',
    dong: '104동',
    deposit: 16500,
    exclusiveArea: 59.9,
    supplyArea: 82.6,
    floorClass: 'HIGH',
    totalFloors: 15,
    direction: 'SOUTH',
    builtYear: 2011,
    verifiedAt: iso('2026-11-19'),
    agencyCount: 2,
  }),
  room('R01', '석현동 해오름빌', '석현동', {
    dealType: 'MONTHLY',
    roomType: '투룸',
    locationNote: '순천대 정문 도보 6분',
    deposit: 500,
    monthlyRent: 42,
    exclusiveArea: 39.6,
    floor: 3,
    totalFloors: 4,
    builtYear: 2019,
    verifiedAt: iso('2026-11-21'),
    agencyCount: 4,
  }),
  room('R02', '덕월동 청암하우스', '덕월동', {
    dealType: 'MONTHLY',
    roomType: '원룸',
    locationNote: '청암대 후문 도보 4분',
    deposit: 300,
    monthlyRent: 32,
    exclusiveArea: 23.1,
    floor: 2,
    totalFloors: 5,
    builtYear: 2015,
    verifiedAt: iso('2026-11-22'),
    agencyCount: 2,
  }),
  room('R03', '석현동 그린캠퍼스', '석현동', {
    dealType: 'MONTHLY',
    roomType: '1.5룸',
    locationNote: '순천대 도보 9분',
    deposit: 500,
    monthlyRent: 38,
    exclusiveArea: 29.7,
    floor: 4,
    totalFloors: 5,
    builtYear: 2021,
    verifiedAt: iso('2026-11-20'),
    agencyCount: 3,
  }),
  {
    ...room('R04', '조례동 호수뷰 오피스텔', '조례동', {
      dealType: 'MONTHLY',
      roomType: '원룸',
      locationNote: '조례호수공원 앞',
      deposit: 1000,
      monthlyRent: 45,
      exclusiveArea: 26.4,
      floor: 9,
      totalFloors: 15,
      builtYear: 2018,
      verifiedAt: iso('2026-11-20'),
      agencyCount: 1,
    }),
    assetType: 'OFFICETEL',
  },
  room('R05', '연향동 센트로빌', '연향동', {
    dealType: 'JEONSE',
    roomType: '투룸',
    locationNote: '연향 패션거리 인근',
    deposit: 9500,
    exclusiveArea: 42.9,
    floor: 2,
    totalFloors: 4,
    builtYear: 2012,
    verifiedAt: iso('2026-11-19'),
    agencyCount: 2,
  }),
  room('R06', '장천동 역세권 스테이', '장천동', {
    dealType: 'MONTHLY',
    roomType: '원룸',
    locationNote: '순천역 도보 8분',
    deposit: 200,
    monthlyRent: 35,
    exclusiveArea: 19.8,
    floor: 3,
    totalFloors: 6,
    builtYear: 2016,
    verifiedAt: null,
    agencyCount: 1,
  }),
];

type ComplexFixture = Omit<FavoriteComplex, 'favoritedAt'>;
const range = (min: number, max: number) => ({ min, max });

/** Complex catalog (mockdata.md §1 단지). */
export const COMPLEXES: readonly ComplexFixture[] = [
  {
    id: complexId('C01'),
    name: '신대 레이크파크 1단지',
    emdName: '해룡면 신대리',
    households: 1412,
    builtYear: 2019,
    pyeongLabels: ['25', '34', '41'],
    salePrice: range(39000, 48500),
    jeonsePrice: range(26000, 31000),
    counts: { presale: 0, sale: 38, jeonse: 12, monthly: 6 },
    pricePerPyeong: 1180,
    coverPhotoUrl: null,
  },
  {
    id: complexId('C02'),
    name: '연향 센트럴',
    emdName: '연향동',
    households: 980,
    builtYear: 2016,
    pyeongLabels: ['24', '32'],
    salePrice: range(32000, 39500),
    jeonsePrice: range(21000, 26000),
    counts: { presale: 0, sale: 24, jeonse: 9, monthly: 5 },
    pricePerPyeong: 1090,
    coverPhotoUrl: null,
  },
  {
    id: complexId('C03'),
    name: '선월 하이츠 2차',
    emdName: '해룡면 선월리',
    households: 1120,
    builtYear: null,
    moveInYm: '2027.03',
    pyeongLabels: ['25', '33'],
    presalePrice: range(33800, 43500),
    counts: { presale: 46, sale: 5, jeonse: 0, monthly: 2 },
    pricePerPyeong: 1240,
    coverPhotoUrl: null,
  },
  {
    id: complexId('C04'),
    name: '조례 호수마을',
    emdName: '조례동',
    households: 860,
    builtYear: 2009,
    pyeongLabels: ['24', '32'],
    salePrice: range(26500, 31000),
    jeonsePrice: range(18000, 22000),
    counts: { presale: 0, sale: 19, jeonse: 7, monthly: 4 },
    pricePerPyeong: 940,
    coverPhotoUrl: null,
  },
  {
    id: complexId('C05'),
    name: '오천 그린빌',
    emdName: '오천동',
    households: 724,
    builtYear: 2012,
    pyeongLabels: ['24', '33'],
    salePrice: range(23500, 29000),
    jeonsePrice: range(16000, 20500),
    counts: { presale: 0, sale: 17, jeonse: 6, monthly: 8 },
    pricePerPyeong: 1020,
    coverPhotoUrl: null,
  },
  {
    id: complexId('C06'),
    name: '신대 레이크파크 3단지',
    emdName: '해룡면 신대리',
    households: 1036,
    builtYear: 2020,
    pyeongLabels: ['33', '39'],
    salePrice: range(38000, 46000),
    jeonsePrice: range(25000, 29500),
    counts: { presale: 0, sale: 21, jeonse: 8, monthly: 2 },
    pricePerPyeong: 1160,
    coverPhotoUrl: null,
  },
  {
    id: complexId('C07'),
    name: '금당 리버뷰',
    emdName: '연향동',
    households: 808,
    builtYear: 2005,
    pyeongLabels: ['25', '31'],
    salePrice: range(24000, 29800),
    jeonsePrice: range(16500, 19000),
    counts: { presale: 0, sale: 14, jeonse: 5, monthly: 3 },
    pricePerPyeong: 880,
    coverPhotoUrl: null,
  },
  {
    id: complexId('C08'),
    name: '왕지 숲속마을',
    emdName: '왕지동',
    households: 652,
    builtYear: 2011,
    pyeongLabels: ['25', '32'],
    salePrice: range(21000, 26000),
    jeonsePrice: range(15000, 18000),
    counts: { presale: 0, sale: 12, jeonse: 4, monthly: 6 },
    pricePerPyeong: 860,
    coverPhotoUrl: null,
  },
];

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const ago = (now: number, ms: number) => new Date(now - ms).toISOString();

export interface MockStamp {
  id: string;
  at: string;
}

/** Initial 관심 매물 (newest first). */
export function seedFavoriteListings(now: number): MockStamp[] {
  return [
    { id: listingId('L01'), at: ago(now, 3 * HOUR) },
    { id: listingId('R01'), at: ago(now, 1 * DAY + 2 * HOUR) },
    { id: listingId('L02'), at: ago(now, 2 * DAY) },
    { id: listingId('L03'), at: ago(now, 3 * DAY) },
    { id: listingId('L06'), at: ago(now, 5 * DAY) },
    { id: listingId('R04'), at: ago(now, 8 * DAY) },
    { id: listingId('L05'), at: ago(now, 16 * DAY) },
  ];
}

/** Initial 관심 단지 (newest first). */
export function seedFavoriteComplexes(now: number): MockStamp[] {
  return [
    { id: complexId('C01'), at: ago(now, 3 * HOUR) },
    { id: complexId('C03'), at: ago(now, 2 * DAY) },
    { id: complexId('C02'), at: ago(now, 6 * DAY) },
    { id: complexId('C05'), at: ago(now, 21 * DAY) },
  ];
}

/** Initial 최근 본 매물 (newest first): today, yesterday, this week, earlier. */
export function seedRecentViews(now: number): MockStamp[] {
  return [
    { id: listingId('L01'), at: ago(now, 12 * MIN) },
    { id: listingId('L06'), at: ago(now, 40 * MIN) },
    { id: listingId('L02'), at: ago(now, 2 * HOUR) },
    { id: listingId('R01'), at: ago(now, 1 * DAY + 1 * HOUR) },
    { id: listingId('R03'), at: ago(now, 1 * DAY + 3 * HOUR) },
    { id: listingId('L03'), at: ago(now, 3 * DAY) },
    { id: listingId('L04'), at: ago(now, 4 * DAY) },
    { id: listingId('R02'), at: ago(now, 5 * DAY) },
    { id: listingId('L08'), at: ago(now, 12 * DAY) },
    { id: listingId('L07'), at: ago(now, 19 * DAY) },
  ];
}

/** Ids of the w-deal mock requests (deal-requests/_store.ts): S1 내놓기, W1 구하기, S2 매칭된 내놓기. */
const dealRequestId = (seed: string) => mockUuid(`deal-request-${seed}`);

/**
 * Initial notifications (newest first). The first three are unread.
 *
 * Only what the backend sends to a REQUESTER today: PROPOSAL_RECEIVED, REPORT_RESOLVED and SYSTEM.
 * DEAL_REQUEST_RECEIVED / PROPOSAL_ACCEPTED / CONTACT_GRANTED are agency-side events (the console
 * mock adds them for the agent roles with `data.agencyId`); the requester-side confirmations
 * ("요청이 전달됐어요", "연결됐어요") are modelled as SYSTEM rows with a `dealRequestId` until the
 * backend defines them — see docs/frontend-integration/w-me.md.
 */
export function seedNotifications(now: number): Notification[] {
  const rows: (Omit<Notification, 'id' | 'createdAt' | 'readAt'> & {
    age: number;
    read?: boolean;
  })[] = [
    {
      type: 'PROPOSAL_RECEIVED',
      title: '신대중앙 공인중개사사무소가 제안을 보냈어요',
      body: '내놓기 요청 “신대 레이크파크 1단지 103동 · 매매”에 제안이 도착했습니다. 내용을 확인하고 연락처 공개 여부를 정해 주세요.',
      data: { dealRequestId: dealRequestId('S1') },
      age: 18 * MIN,
    },
    {
      type: 'PROPOSAL_RECEIVED',
      title: '선월 분양권 공인중개사사무소가 제안을 보냈어요',
      body: '구하기 요청 “신대지구 아파트 · 매매 · 4억 5,000 이하”에 매물 1건을 제안했습니다.',
      data: { dealRequestId: dealRequestId('W1') },
      age: 3 * HOUR,
    },
    {
      type: 'PROPOSAL_RECEIVED',
      title: '호수공원 공인중개사사무소가 제안을 보냈어요',
      body: '내놓기 요청 “신대 레이크파크 1단지 103동 · 매매”에 제안이 도착했습니다.',
      data: { dealRequestId: dealRequestId('S1') },
      age: 7 * HOUR,
    },
    {
      type: 'REPORT_RESOLVED',
      title: '허위매물 신고가 처리됐어요',
      body: '신고하신 “조례 호수마을 102동 월세” 매물이 확인 후 숨김 처리되었습니다. 신고해 주셔서 고맙습니다.',
      data: { reportId: mockUuid('report-01') },
      age: 2 * DAY,
      read: true,
    },
    {
      type: 'SYSTEM',
      title: '내놓기 요청이 중개사무소 12곳에 전달됐어요',
      body: '신대 지역 중개사무소가 요청을 확인하고 있습니다. 제안이 도착하면 알려 드릴게요.',
      data: { dealRequestId: dealRequestId('S1') },
      age: 4 * DAY,
      read: true,
    },
    {
      type: 'SYSTEM',
      title: '허위매물을 신고하면 확인 후 포상해 드려요',
      body: '2026.11.10 – 11.30 · 자세한 내용은 공지사항에서 확인하세요.',
      data: { url: '/notices' },
      age: 6 * DAY,
      read: true,
    },
    {
      type: 'SYSTEM',
      title: '구하기 요청이 중개사무소 12곳에 전달됐어요',
      body: '신대 지역 중개사무소가 조건에 맞는 매물을 찾고 있습니다.',
      data: { dealRequestId: dealRequestId('W1') },
      age: 9 * DAY,
      read: true,
    },
    {
      type: 'SYSTEM',
      title: '11월 12일 새벽 서비스 점검이 있어요',
      body: '2026.11.12 02:00 – 04:00 동안 접속이 잠시 중단됩니다.',
      data: { url: '/notices' },
      age: 12 * DAY,
      read: true,
    },
    {
      type: 'SYSTEM',
      title: '순천대정문 공인중개사사무소와 연결됐어요',
      body: '내놓기 요청 “석현동 해오름빌 투룸 · 월세”의 제안을 수락해 연락처가 공개됐습니다. 중개사무소에서 곧 연락드릴 거예요.',
      data: { dealRequestId: dealRequestId('S2') },
      age: 15 * DAY,
      read: true,
    },
    {
      type: 'SYSTEM',
      title: '개인정보처리방침이 2026년 11월 1일부터 변경됩니다',
      body: '변경 내용은 개인정보처리방침에서 확인하실 수 있습니다.',
      data: { url: '/terms/privacy' },
      age: 24 * DAY,
      read: true,
    },
    {
      type: 'SYSTEM',
      title: '회원이 되신 것을 환영합니다',
      body: '지도에서 순천시 매물을 둘러보고, 마음에 드는 매물은 하트로 담아 두세요.',
      data: { url: '/map/apt' },
      age: 37 * DAY,
      read: true,
    },
  ];
  return rows.map(({ age, read, ...rest }, i) => ({
    ...rest,
    id: mockUuid(`notification-${i + 1}`),
    createdAt: ago(now, age),
    readAt: read ? ago(now, age - 5 * MIN) : null,
  }));
}

export function seedIdentities(now: number): Identity[] {
  return [
    {
      id: mockUuid('identity-kakao'),
      provider: 'KAKAO',
      email: 'user@example.com',
      lastUsedAt: ago(now, 2 * HOUR),
      createdAt: ago(now, 37 * DAY),
    },
    {
      id: mockUuid('identity-naver'),
      provider: 'NAVER',
      email: 'user@example.com',
      lastUsedAt: ago(now, 5 * DAY),
      createdAt: ago(now, 12 * DAY),
    },
  ];
}

/** The one identity of a member who just signed up with `provider` (mock signup). */
export function seedIdentityFor(provider: Identity['provider'], now: number): Identity {
  const slug = provider.toLowerCase();
  return {
    id: mockUuid(`identity-${slug}`),
    provider,
    email: `${slug}.user@example.com`,
    lastUsedAt: new Date(now).toISOString(),
    createdAt: new Date(now).toISOString(),
  };
}

export const SEED_OFFSETS = { accountAge: 37 * DAY, marketingChanged: 37 * DAY } as const;
