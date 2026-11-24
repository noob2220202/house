import {
  AssetType,
  BuildingUse,
  DealType,
  Direction,
  DirectionBasis,
  FloorDisplay,
  ListingOption,
  ListingStatus,
  MaintenanceFeeBillingType,
  MaintenanceFeeKind,
  MoveInType,
  VerificationMethod,
} from '@house/shared';
import type {
  AgencyListing,
  AgencyListingAgency,
  AgencyListingPhoto,
  MaintenanceFeeView,
} from '@/features/a-listings/api/schemas';
import { mockUuid } from '@/lib/mock';
import { OFFICE_ID } from '../../agencies/mine/_fixtures';
import {
  areaTypeIdOf,
  complexIdOf,
  findComplexSpec,
  type MockComplexSpec,
} from '../../complexes/_fixtures';

/**
 * Seeds of the broker-side listings mock: the listings of the mock office (B01 신대중앙
 * 공인중개사사무소, mockdata.md §4) plus other offices' listings that can be co-brokered.
 * Codes L01… reuse the ids of the public listing mocks (`mockUuid('L01')`), so "공개 페이지 보기" opens
 * the matching public detail page.
 */

const DAY = 86_400_000;
const KST = 9 * 3_600_000;
/** YYYY-MM-DD (KST) `n` days ago (negative = in the future). */
export const dayString = (n: number) =>
  new Date(Date.now() - n * DAY + KST).toISOString().slice(0, 10);
export const isoAgo = (days: number, hour = 10) =>
  `${dayString(days)}T${String(hour).padStart(2, '0')}:00:00+09:00`;
export const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

export const MOCK_VERIFICATION_VALID_DAYS = 30;
export const MOCK_LISTING_TTL_DAYS = 60;

// ---- offices --------------------------------------------------------------------------------------

/** Other offices (mockdata.md §4). The mock office itself (B01) is read live from the agencies mock. */
const OFFICES: Record<string, Omit<AgencyListingAgency, 'isPrimary'>> = {
  B02: {
    agencyId: mockUuid('agency-B02'),
    name: '호수공원 공인중개사사무소',
    representativeName: '한서윤',
    registrationNumber: '46150-2018-00041',
    phone: '0610000000',
    roadAddress: '전라남도 순천시 호수공원길 24',
    addressDetail: '1층',
    contactName: '한서윤',
    contactPhone: '0610000000',
  },
  B03: {
    agencyId: mockUuid('agency-B03'),
    name: '연향센트럴 공인중개사사무소',
    representativeName: '박도현',
    registrationNumber: '46150-2016-00027',
    phone: '0610000000',
    roadAddress: '전라남도 순천시 연향3로 41',
    addressDetail: '102호',
    contactName: '박도현',
    contactPhone: '0610000000',
  },
  B05: {
    agencyId: mockUuid('agency-B05'),
    name: '선월 분양권 공인중개사사무소',
    representativeName: '정민재',
    registrationNumber: '46150-2021-00008',
    phone: '0610000000',
    roadAddress: '전라남도 순천시 해룡면 선월로 30',
    addressDetail: '상가 B동 101호',
    contactName: '정민재',
    contactPhone: '0610000000',
  },
};
export const MY_OFFICE_CODE = 'B01';
export const MY_OFFICE_ID = OFFICE_ID;
export const otherOffice = (code: string) => OFFICES[code];

// ---- photos ---------------------------------------------------------------------------------------

const SCENES: readonly (readonly [string, string])[] = [
  ['exterior', '외관'],
  ['living', '거실'],
  ['kitchen', '주방'],
  ['bedroom', '안방'],
  ['bath', '욕실'],
  ['view', '전망'],
  ['plan', '평면도'],
  ['entrance', '현관'],
];
const ROOM_SCENES: readonly (readonly [string, string])[] = [
  ['villa', '외관'],
  ['room', '방'],
  ['kitchen', '주방'],
  ['bath', '욕실'],
];

export function mockPhotos(code: string, count: number, scenes = SCENES): AgencyListingPhoto[] {
  const variant = (code.charCodeAt(code.length - 1) + code.length) % 6;
  return Array.from({ length: count }, (_, i) => {
    const [scene, caption] = scenes[i % scenes.length]!;
    const url = `/mock-api/v1/listings/mock-photo/${scene}-${(variant + i) % 6}`;
    return {
      id: `photo-${code}-${i}`,
      mediaId: `seed-${code}-${i}`,
      url,
      thumbUrl: url,
      caption,
      isCover: i === 0,
    };
  });
}

// ---- seeds ----------------------------------------------------------------------------------------

/**
 * 정액관리비 내역 whose included items add up to `feeWon` (10만원 이상 → 항목별 금액, 세부기준) —
 * the shape the API stores (`maintenanceFee`).
 */
export function fixedFee(feeWon: number): MaintenanceFeeView {
  return {
    billingType: MaintenanceFeeBillingType.FIXED,
    items: [
      { kind: MaintenanceFeeKind.GENERAL, included: true, amountWon: feeWon - 20_000 },
      { kind: MaintenanceFeeKind.WATER, included: true, amountWon: 12_000 },
      { kind: MaintenanceFeeKind.OTHER, included: true, amountWon: 8_000 },
    ],
    unavailableReason: null,
  };
}

export interface StoredListing extends AgencyListing {
  /** Short fixture code ("L01"), accepted as an id alias. */
  code: string;
  /** Office codes that co-broker, primary first. */
  offices: string[];
}

const APT_OPTIONS: ListingOption[] = [
  ListingOption.AIR_CONDITIONER,
  ListingOption.BUILT_IN_WARDROBE,
  ListingOption.INDUCTION,
  ListingOption.DISHWASHER,
  ListingOption.SHOE_RACK,
  ListingOption.BALCONY,
  ListingOption.ELEVATOR,
  ListingOption.CCTV,
];

interface AptSeed {
  code: string;
  no?: string;
  complex: string;
  /** Index into the complex's 평형. */
  type: number;
  dong: string;
  ho: string;
  floor: number;
  totalFloors?: number;
  direction: Direction;
  deal: DealType;
  /** 매매가 / 전세 보증금 / 월세 보증금 / 분양가. */
  price?: number;
  rent?: number;
  premium?: number;
  status: ListingStatus;
  /** Days since the last 실매물 확인 (undefined = never). */
  verified?: number;
  /** Days since publishing. */
  published?: number;
  updated: number;
  views?: number;
  favs?: number;
  inquiries?: number;
  offices: string[];
  photos?: number;
  hiddenReason?: string;
  title?: string;
  description?: string;
  floorDisplay?: FloorDisplay;
  /** Draft with holes: fields to blank out. */
  blank?: readonly ('price' | 'detail' | 'moveIn' | 'fee')[];
}

function aptListing(s: AptSeed): StoredListing {
  const spec = findComplexSpec(s.complex) as MockComplexSpec;
  const area = spec.areas[s.type] ?? spec.areas[0]!;
  const blank = new Set(s.blank ?? []);
  const verifiedAt = s.verified === undefined ? null : dayString(s.verified);
  const publishedAt = s.published === undefined ? null : isoAgo(s.published);
  const presale = s.deal === DealType.PRESALE;
  const noPrice = blank.has('price');
  return {
    id: mockUuid(s.code),
    code: s.code,
    offices: s.offices,
    listingNo: s.no ?? null,
    status: s.status,
    dealType: s.deal,
    title: s.title ?? null,
    description:
      s.description ??
      (s.status === ListingStatus.DRAFT
        ? null
        : `${spec.name} ${s.dong} ${area.pyeong}평 ${s.deal === DealType.SALE ? '매매' : s.deal === DealType.JEONSE ? '전세' : s.deal === DealType.MONTHLY ? '월세' : '분양권'} 매물이에요.\n직접 방문해서 채광과 관리 상태를 확인했어요. 입주 일정은 협의할 수 있어요.`),
    salePrice: s.deal === DealType.SALE && !noPrice ? (s.price ?? null) : null,
    deposit:
      (s.deal === DealType.JEONSE || s.deal === DealType.MONTHLY) && !noPrice
        ? (s.price ?? null)
        : null,
    monthlyRent: s.deal === DealType.MONTHLY && !noPrice ? (s.rent ?? null) : null,
    presalePrice: presale && !noPrice ? (s.price ?? null) : null,
    premium: presale && !noPrice ? (s.premium ?? 0) : null,
    maintenanceFeeWon: blank.has('fee') ? null : 150_000 + area.pyeong * 1000,
    maintenanceFee: blank.has('fee') ? null : fixedFee(150_000 + area.pyeong * 1000),
    moveInType: blank.has('moveIn') ? null : presale ? MoveInType.DATE : MoveInType.NEGOTIABLE,
    moveInDate: presale && !blank.has('moveIn') ? '2027-03-31' : null,
    floorDisplay: s.floorDisplay ?? FloorDisplay.CLASS,
    options: s.status === ListingStatus.DRAFT ? [] : APT_OPTIONS,
    publishedAt,
    expiresAt:
      publishedAt && (s.status === ListingStatus.ACTIVE || s.status === ListingStatus.RESERVED)
        ? `${addDays(publishedAt, MOCK_LISTING_TTL_DAYS)}T23:59:00+09:00`
        : null,
    closedAt: s.status === ListingStatus.CLOSED ? isoAgo(s.updated) : null,
    hiddenReason: s.hiddenReason ?? null,
    verifiedAt,
    verificationDueAt: verifiedAt ? addDays(verifiedAt, MOCK_VERIFICATION_VALID_DAYS) : null,
    viewCount: s.views ?? 0,
    favoriteCount: s.favs ?? 0,
    inquiryCount: s.inquiries ?? 0,
    createdAt: isoAgo((s.published ?? s.updated) + 1, 9),
    updatedAt: isoAgo(s.updated, 15),
    isPrimary: s.offices[0] === MY_OFFICE_CODE,
    property: {
      assetType: AssetType.APT,
      complexId: complexIdOf(spec.code),
      areaTypeId: areaTypeIdOf(spec.code, area),
      roadAddress: spec.road,
      jibunAddress: spec.jibun,
      buildingName: spec.name,
      dong: s.dong,
      ho: s.ho,
      emdCode: spec.emdCode,
      emdName: spec.emdName,
      lat: spec.lat,
      lng: spec.lng,
      floor: s.floor,
      totalFloors: s.totalFloors ?? spec.floorsMax,
      exclusiveArea: blank.has('detail') ? null : area.exclusive,
      supplyArea: blank.has('detail') ? null : area.supply,
      landArea: null,
      rooms: blank.has('detail') ? null : area.rooms,
      baths: blank.has('detail') ? null : area.baths,
      direction: blank.has('detail') ? null : s.direction,
      directionBasis: blank.has('detail') ? null : DirectionBasis.LIVING_ROOM,
      approvalDate: spec.approvalDate,
      parkingSpaces: blank.has('detail')
        ? null
        : Math.round(spec.households * spec.parkingPerHousehold),
      // 아파트: 건축물 용도 follows from the category (the API leaves it null).
      buildingUse: null,
    },
    complex: { id: complexIdOf(spec.code), name: spec.name, emdName: spec.emdName },
    photos: mockPhotos(s.code, s.photos ?? 8),
    verifications:
      s.verified === undefined
        ? []
        : [
            {
              id: `ver-${s.code}-2`,
              method: VerificationMethod.SITE_VISIT,
              verifiedAt: dayString(s.verified),
              note: '현장 방문, 내부 사진 촬영',
              verifiedByName: '김서진',
              byAdmin: false,
            },
            {
              id: `ver-${s.code}-1`,
              method: VerificationMethod.OWNER_CALL,
              verifiedAt: dayString(s.verified + 1),
              note: null,
              verifiedByName: '오세린',
              byAdmin: false,
            },
          ],
    agencies: [],
  };
}

const D = Direction;
const S = ListingStatus;
const ME = MY_OFFICE_CODE;

const APT_SEEDS: AptSeed[] = [
  {
    code: 'L01',
    no: '26-0412',
    complex: 'C01',
    type: 1,
    dong: '103동',
    ho: '1502호',
    floor: 20,
    direction: D.SOUTH,
    deal: DealType.SALE,
    price: 44500,
    status: S.ACTIVE,
    verified: 1,
    published: 58,
    updated: 1,
    views: 1284,
    favs: 37,
    inquiries: 9,
    offices: [ME, 'B02', 'B05'],
    photos: 14,
    title: '호수공원 정면 조망, 올확장 34평',
  },
  {
    code: 'L06',
    no: '26-0398',
    complex: 'C06',
    type: 1,
    dong: '301동',
    ho: '1203호',
    floor: 12,
    direction: D.SOUTH,
    deal: DealType.SALE,
    price: 46000,
    status: S.ACTIVE,
    verified: 3,
    published: 56,
    updated: 3,
    views: 842,
    favs: 21,
    inquiries: 5,
    offices: [ME, 'B05', 'B02'],
    photos: 11,
  },
  {
    code: 'L11',
    no: '26-0391',
    complex: 'C01',
    type: 0,
    dong: '108동',
    ho: '904호',
    floor: 9,
    direction: D.SOUTH_EAST,
    deal: DealType.MONTHLY,
    price: 3000,
    rent: 90,
    status: S.ACTIVE,
    verified: 9,
    published: 54,
    updated: 9,
    views: 516,
    favs: 12,
    inquiries: 4,
    offices: [ME],
    photos: 9,
  },
  {
    code: 'L12',
    no: '26-0377',
    complex: 'C01',
    type: 2,
    dong: '111동',
    ho: '2201호',
    floor: 22,
    direction: D.SOUTH,
    deal: DealType.JEONSE,
    price: 31000,
    status: S.ACTIVE,
    verified: 29,
    published: 29,
    updated: 12,
    views: 398,
    favs: 8,
    inquiries: 2,
    offices: [ME, 'B02'],
    photos: 10,
  },
  {
    code: 'L13',
    no: '26-0371',
    complex: 'C06',
    type: 0,
    dong: '305동',
    ho: '302호',
    floor: 3,
    direction: D.SOUTH_WEST,
    deal: DealType.SALE,
    price: 38000,
    status: S.ACTIVE,
    verified: 27,
    published: 27,
    updated: 20,
    views: 274,
    favs: 5,
    inquiries: 1,
    offices: [ME],
    photos: 7,
  },
  {
    code: 'L02',
    no: '26-0405',
    complex: 'C03',
    type: 1,
    dong: '205동',
    ho: '1101호',
    floor: 11,
    direction: D.SOUTH_EAST,
    deal: DealType.PRESALE,
    price: 39200,
    premium: 2700,
    status: S.ACTIVE,
    verified: 25,
    published: 25,
    updated: 6,
    views: 961,
    favs: 28,
    inquiries: 7,
    offices: ['B05', ME],
    photos: 6,
  },
  {
    code: 'L14',
    no: '26-0366',
    complex: 'C01',
    type: 1,
    dong: '104동',
    ho: '1304호',
    floor: 13,
    direction: D.SOUTH,
    deal: DealType.JEONSE,
    price: 28000,
    status: S.ACTIVE,
    verified: 24,
    published: 24,
    updated: 24,
    views: 331,
    favs: 9,
    inquiries: 3,
    offices: [ME],
    photos: 8,
  },
  {
    code: 'L16',
    no: '26-0312',
    complex: 'C06',
    type: 1,
    dong: '303동',
    ho: '1801호',
    floor: 18,
    direction: D.SOUTH,
    deal: DealType.JEONSE,
    price: 29500,
    status: S.ACTIVE,
    verified: 34,
    published: 49,
    updated: 34,
    views: 205,
    favs: 4,
    inquiries: 0,
    offices: [ME],
    photos: 8,
  },
  {
    code: 'L15',
    no: '26-0358',
    complex: 'C01',
    type: 1,
    dong: '106동',
    ho: '702호',
    floor: 7,
    direction: D.SOUTH,
    deal: DealType.SALE,
    price: 43000,
    status: S.RESERVED,
    verified: 12,
    published: 40,
    updated: 2,
    views: 1102,
    favs: 31,
    inquiries: 11,
    offices: [ME, 'B02'],
    photos: 12,
  },
  {
    code: 'L17',
    no: '26-0290',
    complex: 'C01',
    type: 0,
    dong: '110동',
    ho: '401호',
    floor: 4,
    direction: D.SOUTH_EAST,
    deal: DealType.SALE,
    price: 39000,
    status: S.CLOSED,
    verified: 20,
    published: 70,
    updated: 6,
    views: 1540,
    favs: 44,
    inquiries: 13,
    offices: [ME],
    photos: 9,
  },
  {
    code: 'L18',
    no: '26-0333',
    complex: 'C06',
    type: 0,
    dong: '302동',
    ho: '1505호',
    floor: 15,
    direction: D.SOUTH,
    deal: DealType.MONTHLY,
    price: 3000,
    rent: 85,
    status: S.HIDDEN,
    verified: 16,
    published: 44,
    updated: 5,
    views: 187,
    favs: 3,
    inquiries: 1,
    offices: [ME],
    photos: 6,
  },
  {
    code: 'L19',
    no: '26-0301',
    complex: 'C01',
    type: 2,
    dong: '102동',
    ho: '2403호',
    floor: 24,
    direction: D.SOUTH,
    deal: DealType.SALE,
    price: 48500,
    status: S.HIDDEN,
    verified: 40,
    published: 62,
    updated: 8,
    views: 720,
    favs: 15,
    inquiries: 2,
    offices: [ME],
    photos: 10,
    hiddenReason: '허위매물 신고가 접수되어 운영팀이 확인하고 있어요. 확인이 끝나면 다시 게시돼요.',
  },
  {
    code: 'D01',
    complex: 'C01',
    type: 1,
    dong: '105동',
    ho: '803호',
    floor: 8,
    direction: D.SOUTH,
    deal: DealType.SALE,
    status: S.DRAFT,
    updated: 0,
    offices: [ME],
    photos: 2,
    blank: ['price', 'moveIn', 'fee'],
  },
  // ---- other offices' listings (공동중개 후보) ----
  {
    code: 'X01',
    no: '26-0420',
    complex: 'C01',
    type: 1,
    dong: '107동',
    ho: '1102호',
    floor: 11,
    direction: D.SOUTH,
    deal: DealType.SALE,
    price: 44000,
    status: S.ACTIVE,
    verified: 2,
    published: 6,
    updated: 2,
    views: 320,
    favs: 11,
    offices: ['B02'],
    photos: 9,
  },
  {
    code: 'X02',
    no: '26-0418',
    complex: 'C01',
    type: 0,
    dong: '103동',
    ho: '305호',
    floor: 3,
    direction: D.SOUTH_EAST,
    deal: DealType.JEONSE,
    price: 22500,
    status: S.ACTIVE,
    verified: 4,
    published: 9,
    updated: 4,
    views: 211,
    favs: 6,
    offices: ['B02', 'B05'],
    photos: 7,
  },
  {
    code: 'X03',
    no: '26-0409',
    complex: 'C01',
    type: 2,
    dong: '112동',
    ho: '1901호',
    floor: 19,
    direction: D.SOUTH,
    deal: DealType.SALE,
    price: 48000,
    status: S.ACTIVE,
    verified: 6,
    published: 15,
    updated: 6,
    views: 402,
    favs: 13,
    offices: ['B05'],
    photos: 10,
  },
  {
    code: 'X04',
    no: '26-0402',
    complex: 'C01',
    type: 1,
    dong: '109동',
    ho: '602호',
    floor: 6,
    direction: D.SOUTH_WEST,
    deal: DealType.MONTHLY,
    price: 5000,
    rent: 80,
    status: S.RESERVED,
    verified: 8,
    published: 21,
    updated: 3,
    views: 188,
    favs: 2,
    offices: ['B02'],
    photos: 6,
  },
  {
    code: 'X05',
    no: '26-0415',
    complex: 'C06',
    type: 1,
    dong: '304동',
    ho: '1004호',
    floor: 10,
    direction: D.SOUTH,
    deal: DealType.SALE,
    price: 45500,
    status: S.ACTIVE,
    verified: 3,
    published: 8,
    updated: 3,
    views: 256,
    favs: 9,
    offices: ['B05', 'B02'],
    photos: 8,
  },
  {
    code: 'X06',
    no: '26-0407',
    complex: 'C03',
    type: 0,
    dong: '210동',
    ho: '402호',
    floor: 4,
    direction: D.EAST,
    deal: DealType.PRESALE,
    price: 35000,
    premium: -1200,
    status: S.ACTIVE,
    verified: 5,
    published: 12,
    updated: 5,
    views: 510,
    favs: 17,
    offices: ['B05'],
    photos: 5,
  },
  {
    code: 'X07',
    no: '26-0399',
    complex: 'C02',
    type: 1,
    dong: '108동',
    ho: '901호',
    floor: 9,
    direction: D.SOUTH,
    deal: DealType.JEONSE,
    price: 24000,
    status: S.ACTIVE,
    verified: 3,
    published: 14,
    updated: 3,
    views: 344,
    favs: 10,
    offices: ['B03', 'B02'],
    photos: 8,
  },
  {
    code: 'X08',
    no: '26-0393',
    complex: 'C02',
    type: 0,
    dong: '103동',
    ho: '1203호',
    floor: 12,
    direction: D.SOUTH_EAST,
    deal: DealType.SALE,
    price: 32500,
    status: S.ACTIVE,
    verified: 7,
    published: 18,
    updated: 7,
    views: 199,
    favs: 5,
    offices: ['B03'],
    photos: 7,
  },
];

/** Non-complex listings of the mock office: land (public mock T01), a draft 투룸. */
function extraListings(): StoredListing[] {
  const base = aptListing({
    code: 'T01',
    no: '26-0339',
    complex: 'C01',
    type: 0,
    dong: '',
    ho: '',
    floor: 1,
    direction: D.SOUTH,
    deal: DealType.SALE,
    price: 18500,
    status: S.ACTIVE,
    verified: 14,
    published: 33,
    updated: 14,
    views: 148,
    favs: 6,
    inquiries: 2,
    offices: [ME, 'B05'],
    photos: 3,
  });
  const land: StoredListing = {
    ...base,
    title: '신대지구 초입 대지, 2면 도로 접함',
    description:
      '신대지구 진입로와 가까운 대지예요. 남측과 동측 2면이 도로에 접해 있고, 경계 측량을 마쳤어요.',
    maintenanceFeeWon: null,
    maintenanceFee: null,
    moveInType: null,
    floorDisplay: FloorDisplay.EXACT,
    options: [],
    property: {
      assetType: AssetType.LAND,
      complexId: null,
      areaTypeId: null,
      roadAddress: '전라남도 순천시 해룡면 신대3길 9',
      jibunAddress: '전라남도 순천시 해룡면 신대리 2011',
      buildingName: null,
      dong: null,
      ho: null,
      emdCode: '1215033028',
      emdName: '해룡면 신대리',
      lat: 34.9338,
      lng: 127.5532,
      floor: null,
      totalFloors: null,
      exclusiveArea: null,
      supplyArea: null,
      landArea: 512,
      rooms: null,
      baths: null,
      direction: null,
      directionBasis: null,
      approvalDate: null,
      parkingSpaces: null,
      buildingUse: null,
    },
    complex: null,
    photos: mockPhotos('T01', 3, [['land', '전경']]),
  };

  const draft = aptListing({
    code: 'D02',
    complex: 'C01',
    type: 0,
    dong: '',
    ho: '302호',
    floor: 3,
    totalFloors: 4,
    direction: D.SOUTH,
    deal: DealType.MONTHLY,
    price: 500,
    rent: 42,
    status: S.DRAFT,
    updated: 2,
    offices: [ME],
    photos: 4,
    blank: ['fee'],
  });
  const tworoom: StoredListing = {
    ...draft,
    title: '순천대 정문 도보 6분, 채광 좋은 투룸',
    description: null,
    floorDisplay: FloorDisplay.EXACT,
    options: [ListingOption.AIR_CONDITIONER, ListingOption.REFRIGERATOR, ListingOption.WASHER],
    moveInType: MoveInType.IMMEDIATE,
    property: {
      assetType: AssetType.ONEROOM,
      complexId: null,
      areaTypeId: null,
      roadAddress: '전라남도 순천시 석현동 대학로 15',
      jibunAddress: '전라남도 순천시 석현동 77',
      buildingName: '석현동 해오름빌',
      dong: null,
      ho: '302호',
      emdCode: '1215010900',
      emdName: '석현동',
      lat: 34.9689,
      lng: 127.4812,
      floor: 3,
      totalFloors: 4,
      exclusiveArea: 39.6,
      supplyArea: null,
      landArea: null,
      rooms: 2,
      baths: 1,
      direction: null,
      directionBasis: null,
      approvalDate: '2019-04-12',
      parkingSpaces: null,
      buildingUse: BuildingUse.MULTI_FAMILY_HOUSE,
    },
    complex: null,
    photos: mockPhotos('D02', 4, ROOM_SCENES),
  };
  return [land, tworoom];
}

export function seedListings(): StoredListing[] {
  return [...APT_SEEDS.map(aptListing), ...extraListings()];
}
