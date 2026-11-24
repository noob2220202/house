import type { DealType, Direction, FloorClass } from '@house/shared';
import type { ComplexListingItem, ListingAgency } from '@/features/w-complex/api/schemas';
import { mockUuid } from '@/lib/mock';
import { toListingSummary } from '../listings/_summary';
import {
  COMPLEX_SPECS,
  areaTypeIdOf,
  complexIdOf,
  seededRandom,
  type MockAreaSpec,
  type MockComplexSpec,
} from './_fixtures';

/**
 * Mock 아파트 매물 (all fictional). The rows drawn on Complex.dc.html and mockdata.md §2 (L01–L08)
 * are pinned with stable ids (`mockUuid('L01')` …); the rest of each complex's inventory is
 * generated deterministically so counts match mockdata.md (e.g. C01 = 매매 38 · 전세 12 · 월세 6).
 * Served by `GET /complexes/:id/listings`. Owned by w-complex; other groups may import from here
 * (do not rewrite). `GET /listings` and `GET /listings/:id` have their own fixtures (w-home / w-listing)
 * that share the pinned ids.
 */

// ---- 중개사무소 (mockdata.md §4) ----------------------------------------------------------------

export interface MockAgency {
  code: string;
  id: string;
  name: string;
  representativeName: string;
  phone: string;
  roadAddress: string;
  registrationNumber: string;
  specialtyLabel: string;
  activeListingCount: number;
  avgResponseMinutes: number;
}

const agency = (
  code: string,
  name: string,
  representativeName: string,
  roadAddress: string,
  specialtyLabel: string,
  activeListingCount: number,
  avgResponseMinutes: number,
): MockAgency => ({
  code,
  id: mockUuid(code),
  name,
  representativeName,
  phone: '0610000000',
  roadAddress,
  registrationNumber: `46150-2020-000${code.slice(1)}`,
  specialtyLabel,
  activeListingCount,
  avgResponseMinutes,
});

export const MOCK_AGENCIES: readonly MockAgency[] = [
  agency(
    'B01',
    '신대중앙 공인중개사사무소',
    '김서진',
    '전라남도 순천시 해룡면 신대1로 18, 105호',
    '레이크파크 단지 전문',
    62,
    12,
  ),
  agency(
    'B02',
    '호수공원 공인중개사사무소',
    '한서윤',
    '전라남도 순천시 조례동 호수공원길 24, 1층',
    '연향·조례 아파트 전문',
    46,
    8,
  ),
  agency(
    'B03',
    '연향센트럴 공인중개사사무소',
    '박도현',
    '전라남도 순천시 연향동 연향3로 41, 102호',
    '연향 센트럴 단지 전문',
    38,
    20,
  ),
  agency(
    'B04',
    '오천그린 공인중개사사무소',
    '이하린',
    '전라남도 순천시 오천동 오천2길 7, 1층',
    '오천지구 전문',
    29,
    15,
  ),
  agency(
    'B05',
    '선월 분양권 공인중개사사무소',
    '정민재',
    '전라남도 순천시 해룡면 선월로 30, 상가 B동 101호',
    '분양권 전문',
    51,
    10,
  ),
  agency(
    'B06',
    '순천대정문 공인중개사사무소',
    '최유나',
    '전라남도 순천시 석현동 대학로 15, 1층',
    '원룸·투룸 전문',
    74,
    6,
  ),
  agency(
    'B07',
    '금당리버 공인중개사사무소',
    '윤재희',
    '전라남도 순천시 연향동 금당로 9, 103호',
    '금당지구 전문',
    22,
    25,
  ),
  agency(
    'B08',
    '왕지숲 공인중개사사무소',
    '강태오',
    '전라남도 순천시 왕지동 왕지2로 33, 1층',
    '왕지·조례 전문',
    19,
    30,
  ),
];

const AGENCY_BY_CODE = new Map(MOCK_AGENCIES.map((a) => [a.code, a]));
export const findMockAgency = (codeOrId: string) =>
  AGENCY_BY_CODE.get(codeOrId) ?? MOCK_AGENCIES.find((a) => a.id === codeOrId);

/** Offices that work each complex — the first one is the "단지 전문" office. */
const AGENCY_POOL: Record<string, readonly string[]> = {
  C01: ['B01', 'B02', 'B05', 'B03'],
  C02: ['B03', 'B02', 'B07', 'B01'],
  C03: ['B05', 'B01', 'B02'],
  C04: ['B02', 'B08', 'B03'],
  C05: ['B04', 'B07', 'B03'],
  C06: ['B01', 'B05', 'B02'],
  C07: ['B07', 'B03', 'B04'],
  C08: ['B08', 'B02'],
  C09: ['B05', 'B03', 'B02'],
};
const DEFAULT_POOL = ['B01', 'B05', 'B02'] as const;
export const agencyPoolOf = (complexCode: string): readonly string[] =>
  AGENCY_POOL[complexCode] ?? DEFAULT_POOL;

// ---- listings -----------------------------------------------------------------------------------

export interface MockListingAgency {
  code: string;
  /** This office's 호가 (만원) when it differs from the listing's headline price. */
  price?: number;
}

/** Every contract key present and never `undefined` (the fixture is the fully known row). */
type Concrete<T> = { [K in keyof T]-?: Exclude<T[K], undefined> };

export interface MockListing extends Omit<Concrete<ComplexListingItem>, 'agencies' | 'isFavorite'> {
  complexCode: string;
  areaTypeId: string;
  lat: number;
  lng: number;
  emdCode: string;
  builtYear: number;
  /** Sort key in 만원 (same rule as `listings.price_sort`). */
  priceSort: number;
  agencies: MockListingAgency[];
}

interface Seed {
  key: string;
  deal: DealType;
  /** 평 of the 평형. */
  pyeong: number;
  dong: string;
  floorClass: FloorClass;
  direction: Direction;
  /** 매매가 / 전세 보증금 / 월세 보증금 / 분양권 총액. */
  price: number;
  rent?: number;
  premium?: number;
  priceMax?: number;
  title: string;
  /** YYYY-MM-DDTHH:mm */
  verified: string;
  photos: number;
  agencies: readonly (string | MockListingAgency)[];
  moveInDate?: string;
}

const kst = (local: string) => `${local}:00+09:00`;

/** Rows that must look exactly like the design / mockdata.md. */
const PINNED: Record<string, readonly Seed[]> = {
  C01: [
    {
      key: 'C01-P1',
      deal: 'SALE',
      pyeong: 34,
      dong: '108동',
      floorClass: 'MID',
      direction: 'SOUTH_EAST',
      price: 42000,
      priceMax: 43000,
      // The row explains the price range itself ("중개사무소마다 호가가 달라요"); this is the headline.
      title: '호수공원 도보 5분 · 중간층 남동향',
      verified: '2026-11-22T15:30',
      photos: 9,
      agencies: [
        { code: 'B01', price: 42000 },
        { code: 'B02', price: 43000 },
      ],
    },
    {
      key: 'L01',
      deal: 'SALE',
      pyeong: 34,
      dong: '103동',
      floorClass: 'HIGH',
      direction: 'SOUTH',
      price: 44500,
      title: '올수리 · 호수공원 조망 · 입주 2027.02 협의',
      verified: '2026-11-22T11:00',
      photos: 14,
      agencies: ['B01', 'B02', 'B05'],
      moveInDate: '2027-02-01',
    },
    {
      key: 'C01-P3',
      deal: 'SALE',
      pyeong: 41,
      dong: '101동',
      floorClass: 'HIGH',
      direction: 'SOUTH',
      price: 48500,
      title: '단지 내 최고층 라인 · 확장형',
      verified: '2026-11-21T16:00',
      photos: 11,
      agencies: ['B01'],
    },
    {
      key: 'C01-P4',
      deal: 'JEONSE',
      pyeong: 34,
      dong: '106동',
      floorClass: 'LOW',
      direction: 'SOUTH_WEST',
      price: 28000,
      title: '2027년 1월 입주 가능',
      verified: '2026-11-21T10:00',
      photos: 7,
      agencies: ['B02', 'B01'],
      moveInDate: '2027-01-10',
    },
    {
      key: 'C01-P5',
      deal: 'MONTHLY',
      pyeong: 25,
      dong: '104동',
      floorClass: 'MID',
      direction: 'EAST',
      price: 3000,
      rent: 90,
      title: '관리비 별도 · 반려동물 협의',
      verified: '2026-11-20T17:00',
      photos: 6,
      agencies: ['B01'],
    },
  ],
  C02: [
    {
      key: 'L03',
      deal: 'JEONSE',
      pyeong: 32,
      dong: '108동',
      floorClass: 'MID',
      direction: 'SOUTH',
      price: 24000,
      title: '초등학교 도보 5분 · 도배 새로 했어요',
      verified: '2026-11-21T14:00',
      photos: 10,
      agencies: ['B03', 'B02', 'B07', 'B01'],
    },
  ],
  C03: [
    {
      key: 'L02',
      deal: 'PRESALE',
      pyeong: 33,
      dong: '205동',
      floorClass: 'MID',
      direction: 'SOUTH_EAST',
      price: 41900,
      premium: 2700,
      title: '2027년 3월 입주 · 중도금 무이자',
      verified: '2026-11-22T13:00',
      photos: 8,
      agencies: ['B05', 'B01'],
      moveInDate: '2027-03-31',
    },
    {
      key: 'L07',
      deal: 'PRESALE',
      pyeong: 25,
      dong: '210동',
      floorClass: 'LOW',
      direction: 'EAST',
      price: 33800,
      premium: -1200,
      title: '마이너스 프리미엄 · 빠른 명의 변경 가능',
      verified: '2026-11-19T15:00',
      photos: 5,
      agencies: ['B05'],
      moveInDate: '2027-03-31',
    },
  ],
  C04: [
    {
      key: 'L04',
      deal: 'MONTHLY',
      pyeong: 24,
      dong: '102동',
      floorClass: 'LOW',
      direction: 'SOUTH_WEST',
      price: 2000,
      rent: 65,
      title: '호수공원 산책로 앞 · 즉시 입주',
      verified: '2026-11-21T11:30',
      photos: 6,
      agencies: ['B02'],
    },
  ],
  C05: [
    {
      key: 'L05',
      deal: 'SALE',
      pyeong: 24,
      dong: '107동',
      floorClass: 'HIGH',
      direction: 'SOUTH',
      price: 25200,
      title: '탁 트인 전망 · 샷시 교체',
      verified: '2026-11-20T15:00',
      photos: 9,
      agencies: ['B04', 'B07'],
    },
  ],
  C06: [
    {
      key: 'L06',
      deal: 'SALE',
      pyeong: 39,
      dong: '301동',
      floorClass: 'MID',
      direction: 'SOUTH',
      price: 46000,
      title: '4베이 판상형 · 팬트리 넓은 집',
      verified: '2026-11-20T13:00',
      photos: 12,
      agencies: ['B01', 'B05', 'B02'],
    },
  ],
  C08: [
    {
      key: 'L08',
      deal: 'JEONSE',
      pyeong: 25,
      dong: '104동',
      floorClass: 'HIGH',
      direction: 'SOUTH',
      price: 16500,
      title: '숲 조망 · 조용한 동',
      verified: '2026-11-19T10:30',
      photos: 7,
      agencies: ['B08', 'B02'],
    },
  ],
};

/** 호가 ranges of C01 from mockdata.md (매매 3억 9,000 ~ 4억 8,500 · 전세 2억 6,000 ~ 3억 1,000). */
const RANGE_OVERRIDE: Record<string, Partial<Record<DealType, readonly [number, number]>>> = {
  'C01-34': { SALE: [39000, 45000], JEONSE: [26000, 29000] },
  'C01-41': { SALE: [46000, 48000], JEONSE: [30000, 31000] },
  'C03-25': { PRESALE: [34200, 36800] },
  'C03-33': { PRESALE: [40200, 43500] },
};

/** Which 평형 a deal type is offered in (C01: no 25평 매매, 월세 mostly 25평). */
function areaFor(spec: MockComplexSpec, deal: DealType, i: number): MockAreaSpec {
  const areas = spec.areas;
  if (spec.code === 'C01') {
    const [a25, a34, a41] = areas as [MockAreaSpec, MockAreaSpec, MockAreaSpec];
    if (deal === 'MONTHLY') return i % 3 === 2 ? a34 : a25;
    return i % 3 === 2 ? a41 : a34;
  }
  return areas[i % areas.length] as MockAreaSpec;
}

const TITLES = [
  '올수리 · 즉시 입주 가능',
  '로열층 · 확장형',
  '남향 · 채광 좋은 집',
  '초등학교 도보 5분',
  '입주 시기 협의 가능',
  '시스템 에어컨 4대 · 붙박이장',
  '관리 잘된 집 · 첫 입주 상태',
  '세입자 거주 중 · 2027.03 만기',
  '저층 · 정원 조망',
  '가격 조정 가능',
  '주차 편한 동 · 지하 연결',
  '커뮤니티 센터 바로 앞',
  '앞 동 간섭 없는 전망',
  '중문 · 줄눈 시공 완료',
] as const;

const DIRECTIONS: readonly Direction[] = [
  'SOUTH',
  'SOUTH',
  'SOUTH',
  'SOUTH',
  'SOUTH_EAST',
  'SOUTH_EAST',
  'SOUTH_EAST',
  'SOUTH_WEST',
  'SOUTH_WEST',
  'EAST',
];
const FLOOR_CLASSES: readonly FloorClass[] = ['LOW', 'MID', 'MID', 'HIGH', 'HIGH'];
const DEALS: readonly DealType[] = ['PRESALE', 'SALE', 'JEONSE', 'MONTHLY'];

const pad = (n: number) => String(n).padStart(2, '0');
/** `days` before 2026-11-20 (C03: 2026-11-18) at a deterministic time of day. */
function verifiedLocal(spec: MockComplexSpec, days: number, hour: number): string {
  const start = Date.UTC(2026, 10, spec.code === 'C03' ? 18 : 20) - days * 86_400_000;
  const d = new Date(start);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(hour)}:00`;
}

function floorOf(cls: FloorClass, total: number, r: number): number {
  const third = total / 3;
  const [lo, hi] =
    cls === 'LOW' ? [1, third] : cls === 'MID' ? [third + 1, third * 2] : [third * 2 + 1, total];
  return Math.max(1, Math.min(total, Math.round(lo + r * (hi - lo))));
}

function toListing(spec: MockComplexSpec, seed: Seed, r: number): MockListing {
  const a = spec.areas.find((x) => x.pyeong === seed.pyeong) ?? spec.areas[0];
  if (!a) throw new Error(`mock complex ${spec.code} has no 평형`);
  const agencies = seed.agencies.map((x) => (typeof x === 'string' ? { code: x } : x));
  const isPresale = seed.deal === 'PRESALE';
  const exact = r < 0.3;
  return {
    id: mockUuid(seed.key),
    dealType: seed.deal,
    status: 'ACTIVE',
    assetType: 'APT',
    title: seed.title,
    buildingName: null,
    kindLabel: null,
    emdName: spec.emdName,
    locationNote: null,
    landArea: null,
    roomType: null,
    landZone: null,
    landCategory: null,
    maintenanceFeeWon: null,
    options: [],
    sameBuildingCount: 0,
    salePrice: seed.deal === 'SALE' ? seed.price : null,
    deposit: seed.deal === 'JEONSE' || seed.deal === 'MONTHLY' ? seed.price : null,
    monthlyRent: seed.deal === 'MONTHLY' ? (seed.rent ?? null) : null,
    presalePrice: isPresale ? seed.price - (seed.premium ?? 0) : null,
    premium: isPresale ? (seed.premium ?? 0) : null,
    priceMin: seed.priceMax ? seed.price : null,
    priceMax: seed.priceMax ?? null,
    complexId: complexIdOf(spec.code),
    complexName: spec.name,
    dong: seed.dong,
    floor: exact ? floorOf(seed.floorClass, spec.floorsMax, r) : null,
    totalFloors: spec.floorsMax,
    floorClass: seed.floorClass,
    floorDisplay: exact ? 'EXACT' : 'CLASS',
    exclusiveArea: a.exclusive,
    supplyArea: a.supply,
    pyeongLabel: `${a.pyeong}평`,
    rooms: a.rooms,
    baths: a.baths,
    direction: seed.direction,
    moveInType: seed.moveInDate ? 'DATE' : r < 0.5 ? 'NEGOTIABLE' : 'IMMEDIATE',
    moveInDate: seed.moveInDate ?? null,
    verifiedAt: kst(seed.verified),
    publishedAt: kst(seed.verified.replace(/T.*/, 'T09:00')),
    photoCount: seed.photos,
    // No media server in mock mode → the UI shows the branded placeholder.
    coverPhotoUrl: null,
    agencyCount: agencies.length,
    complexCode: spec.code,
    areaTypeId: areaTypeIdOf(spec.code, a),
    lat: spec.lat,
    lng: spec.lng,
    emdCode: spec.emdCode,
    builtYear: spec.builtYear,
    priceSort: seed.price,
    agencies,
  };
}

function buildComplexListings(spec: MockComplexSpec): MockListing[] {
  const rand = seededRandom(`listings-${spec.code}`);
  const pinned = PINNED[spec.code] ?? [];
  const pool = agencyPoolOf(spec.code);
  const out: MockListing[] = pinned.map((seed) => toListing(spec, seed, 0.9));
  let serial = 0;

  DEALS.forEach((deal, dealIdx) => {
    const target = spec.counts[dealIdx] ?? 0;
    const n = Math.max(0, target - pinned.filter((p) => p.deal === deal).length);
    // Evenly spaced positions inside each 평형's 호가 range, visited in a shuffled order.
    const slots = Array.from({ length: n }, (_, i) => areaFor(spec, deal, i));
    const position = new Map<number, number>();
    for (const a of new Set(slots)) {
      const mine = slots.flatMap((s, i) => (s === a ? [i] : []));
      const ranks = mine.map((_, k) => k).sort(() => rand() - 0.5);
      mine.forEach((i, k) =>
        position.set(i, mine.length <= 1 ? 0.5 : (ranks[k] as number) / (mine.length - 1)),
      );
    }
    for (let i = 0; i < n; i++) {
      const a = slots[i] as MockAreaSpec;
      const t = position.get(i) ?? 0.5;
      const override = RANGE_OVERRIDE[`${spec.code}-${a.pyeong}`]?.[deal];
      const r = rand();
      const r2 = rand();
      const r3 = rand();
      let price: number;
      let rent: number | undefined;
      let premium: number | undefined;
      if (deal === 'MONTHLY') {
        price = a.monthly[0] + (r < 0.3 ? 1000 : 0);
        rent = a.monthly[1] - (price > a.monthly[0] ? 5 : 0) + (r2 < 0.3 ? 5 : r2 > 0.8 ? -5 : 0);
      } else {
        const latest = deal === 'JEONSE' ? a.jeonse : a.sale;
        const [min, max] = override ?? [latest * 0.95, latest * 1.05];
        price = Math.round((min + (max - min) * t) / 500) * 500;
        if (deal === 'PRESALE') premium = Math.round((-1500 + r2 * 5000) / 100) * 100;
      }
      const agencyCount = r3 < 0.45 ? 1 : r3 < 0.75 ? 2 : r3 < 0.93 ? 3 : 4;
      const start = Math.floor(r2 * pool.length);
      const codes = Array.from(
        new Set(
          Array.from({ length: agencyCount }, (_, k) => pool[(start + k) % pool.length] as string),
        ),
      );
      const differs = deal === 'SALE' && codes.length > 1 && r < 0.12;
      const floorClass = FLOOR_CLASSES[Math.floor(r * FLOOR_CLASSES.length)] as FloorClass;
      serial += 1;
      out.push(
        toListing(
          spec,
          {
            key: `${spec.code}-G${serial}`,
            deal,
            pyeong: a.pyeong,
            dong: `${spec.dongStart + Math.floor(r2 * spec.buildings)}동`,
            floorClass,
            direction: DIRECTIONS[Math.floor(r3 * DIRECTIONS.length)] as Direction,
            price,
            rent,
            premium,
            priceMax: differs ? price + 500 : undefined,
            title: TITLES[Math.floor(rand() * TITLES.length)] as string,
            verified: verifiedLocal(spec, Math.floor(serial * 0.55), 9 + Math.floor(r * 9)),
            photos: r3 < 0.06 ? 0 : 4 + Math.floor(r * 12),
            agencies: differs
              ? codes.map((code, k) => ({ code, price: price + (k === 0 ? 0 : 500) }))
              : codes,
          },
          r,
        ),
      );
    }
  });
  return out;
}

const LISTING_CACHE = new Map<string, MockListing[]>();

export function listingsOfComplex(spec: MockComplexSpec): MockListing[] {
  let list = LISTING_CACHE.get(spec.code);
  if (!list) {
    list = buildComplexListings(spec);
    LISTING_CACHE.set(spec.code, list);
  }
  return list;
}

/** Every active mock listing (아파트 only — other asset types belong to their page groups). */
export function allMockListings(): MockListing[] {
  return COMPLEX_SPECS.flatMap(listingsOfComplex);
}

export function findMockListing(id: string): MockListing | undefined {
  return allMockListings().find((l) => l.id === id);
}

/** The design shows "이 단지 매물 18 / 4 / 3" for the three offices of 레이크파크 1단지. */
const DESIGN_COUNTS: Record<string, Record<string, number>> = {
  C01: { B01: 18, B02: 4, B05: 3, B03: 2 },
};

/** Active listings of an office inside a complex. */
export function complexListingCountOf(spec: MockComplexSpec, agencyCode: string): number {
  return (
    DESIGN_COUNTS[spec.code]?.[agencyCode] ??
    listingsOfComplex(spec).filter((l) => l.agencies.some((a) => a.code === agencyCode)).length
  );
}

function toListingAgency(
  spec: MockComplexSpec,
  l: MockListing,
  a: MockListingAgency,
  i: number,
): ListingAgency[] {
  const office = findMockAgency(a.code);
  if (!office) return [];
  return [
    {
      agencyId: office.id,
      name: office.name,
      representativeName: office.representativeName,
      phone: office.phone,
      roadAddress: office.roadAddress,
      registrationNumber: office.registrationNumber,
      logoUrl: null,
      isPrimary: i === 0,
      specialtyTag: agencyPoolOf(spec.code)[0] === a.code ? '단지 전문' : null,
      complexListingCount: complexListingCountOf(spec, a.code),
      avgResponseMinutes: office.avgResponseMinutes,
      price: a.price ?? l.priceSort,
    },
  ];
}

/** Public list item: the shared listing summary (`toListingSummary`) + the complex extras. */
export function toListingItem(spec: MockComplexSpec, l: MockListing): ComplexListingItem {
  return {
    ...toListingSummary(l),
    assetType: l.assetType,
    priceMin: l.priceMin,
    priceMax: l.priceMax,
    floorDisplay: l.floorDisplay,
    moveInType: l.moveInType,
    moveInDate: l.moveInDate,
    agencies: l.agencies.flatMap((a, i) => toListingAgency(spec, l, a, i)),
  };
}
