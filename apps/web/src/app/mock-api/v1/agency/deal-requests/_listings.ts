import type { InboxListing } from '@/features/a-inbox/api/schemas';
import { mockUuid } from '@/lib/mock';

/**
 * ACTIVE listings of the mock office (B01 신대중앙 공인중개사사무소) offered in the proposal's
 * listing picker. Fictional (design/drafts/system/mockdata.md); ids reuse the public listing mocks
 * (`mockUuid('L01')`) where those exist so "매물 보기" opens a real page.
 */
const SINDAE = '4615033028';
const SEONWOL = '4615033029';
const C01 = mockUuid('C01');
const C03 = mockUuid('C03');
const C06 = mockUuid('C06');

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

type Seed = [
  code: string,
  title: string,
  assetType: InboxListing['assetType'],
  dealType: InboxListing['dealType'],
  /** 매매가 / 전세 보증금 / 분양권 매매가, or [보증금, 월세]. */
  price: number | [number, number],
  exclusiveArea: number,
  floorLabel: string | null,
  rooms: number | null,
  emdCode: string,
  complexId: string | null,
  verifiedDaysAgo: number,
];

const SEEDS: Seed[] = [
  ['L01', '신대 레이크파크 1단지 103동', 'APT', 'SALE', 44500, 84.98, '고/25층', 3, SINDAE, C01, 2],
  ['L06', '신대 레이크파크 3단지 301동', 'APT', 'SALE', 46000, 99.12, '중/24층', 4, SINDAE, C06, 4],
  ['L15', '신대 레이크파크 1단지 106동', 'APT', 'SALE', 33500, 59.92, '저/25층', 3, SINDAE, C01, 6],
  ['L13', '신대 레이크파크 3단지 305동', 'APT', 'SALE', 38000, 84.9, '저/24층', 3, SINDAE, C06, 21],
  [
    'L12',
    '신대 레이크파크 1단지 111동',
    'APT',
    'JEONSE',
    31000,
    101.87,
    '고/25층',
    4,
    SINDAE,
    C01,
    28,
  ],
  [
    'L14',
    '신대 레이크파크 1단지 104동',
    'APT',
    'JEONSE',
    28000,
    84.98,
    '중/25층',
    3,
    SINDAE,
    C01,
    24,
  ],
  [
    'L21',
    '신대 레이크파크 3단지 302동',
    'APT',
    'JEONSE',
    29500,
    99.12,
    '고/24층',
    4,
    SINDAE,
    C06,
    3,
  ],
  [
    'L11',
    '신대 레이크파크 1단지 108동',
    'APT',
    'MONTHLY',
    [3000, 90],
    59.92,
    '중/25층',
    3,
    SINDAE,
    C01,
    9,
  ],
  ['L02', '선월 하이츠 2차 205동', 'APT', 'PRESALE', 41900, 84.94, '중/20층', 3, SEONWOL, C03, 2],
  ['L16', '선월 하이츠 2차 201동', 'APT', 'PRESALE', 43800, 84.94, '고/20층', 3, SEONWOL, C03, 5],
  [
    'L17',
    '신대 센트럴 오피스텔 A동',
    'OFFICETEL',
    'MONTHLY',
    [500, 55],
    29.7,
    '7/15층',
    1,
    SINDAE,
    null,
    1,
  ],
  [
    'L18',
    '신대 센트럴 오피스텔 B동',
    'OFFICETEL',
    'MONTHLY',
    [1000, 48],
    26.4,
    '11/15층',
    1,
    SINDAE,
    null,
    7,
  ],
  [
    'L19',
    '신대 센트럴 오피스텔 A동',
    'OFFICETEL',
    'JEONSE',
    13000,
    33.1,
    '9/15층',
    1,
    SINDAE,
    null,
    12,
  ],
  [
    'L20',
    '신대지구 중심상가 1층',
    'COMMERCIAL',
    'MONTHLY',
    [3000, 180],
    66.1,
    '1/5층',
    null,
    SINDAE,
    null,
    10,
  ],
  ['L22', '신대리 2층 단독주택', 'HOUSE', 'SALE', 52000, 132.2, '2층', 4, SINDAE, null, 15],
  ['T01', '해룡면 신대리 대지', 'LAND', 'SALE', 38500, 330.6, null, null, SINDAE, null, 8],
];

export const OFFICE_LISTINGS: InboxListing[] = SEEDS.map(
  ([
    code,
    title,
    assetType,
    dealType,
    price,
    exclusiveArea,
    floorLabel,
    rooms,
    emdCode,
    complexId,
    verified,
  ]) => ({
    id: mockUuid(code),
    title,
    assetType,
    dealType,
    price: Array.isArray(price) ? null : price,
    deposit: Array.isArray(price) ? price[0] : null,
    monthlyRent: Array.isArray(price) ? price[1] : null,
    exclusiveArea,
    floorLabel,
    rooms,
    emdCode,
    emdName: emdCode === SEONWOL ? '해룡면 선월리' : '해룡면 신대리',
    complexId,
    thumbUrl: null,
    verifiedAt: day(verified),
  }),
);

export function officeListing(id: string): InboxListing | undefined {
  return OFFICE_LISTINGS.find((l) => l.id === id);
}
