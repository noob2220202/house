import { AssetType, DealType, Direction, ListingOption, ListingStatus } from '@house/shared';
import {
  LandCategory,
  LandZone,
  RoomType,
  type ComplexSummary,
  type ListingSummary,
  type Region,
} from '@/features/w-map/api/schemas';
import { mockUuid } from '@/lib/mock';
import {
  COMPLEX_SPECS,
  complexIdOf,
  seededRandom,
  type MockAreaSpec,
  type MockComplexSpec,
} from '../complexes/_fixtures';
import { allMockListings } from '../complexes/_listings';

/**
 * Listing fixtures for the map search mocks (all fictional — design/drafts/system/mockdata.md).
 * Owned by w-map; other groups may import from here.
 *
 * - 아파트: the w-complex inventory (`complexes/_fixtures.ts` + `_listings.ts`), so counts,
 *   coordinates and ids match the complex pages and `GET /complexes/:id/listings`.
 * - 원룸·투룸: mockdata §3 (R01–R06) + more rooms per building around the campuses.
 * - 주택 / 상업·업무 / 토지: deterministic samples per 동.
 * Everything is seeded, so screenshots and tests are stable.
 */

export interface MockListing extends ListingSummary {
  /** 법정동코드 of the 동 / 지구 (filter `emdCode`, region clusters). */
  emdCode: string;
  lat: number;
  lng: number;
}

// ---- regions ------------------------------------------------------------------------------------

export const REGIONS: readonly Region[] = [
  { code: '4615033028', name: '신대지구', parentName: '해룡면', lat: 34.9215, lng: 127.58 },
  { code: '4615033029', name: '선월지구', parentName: '해룡면', lat: 34.912, lng: 127.57 },
  { code: '4615012100', name: '연향동', parentName: null, lat: 34.947, lng: 127.53 },
  { code: '4615012000', name: '조례동', parentName: null, lat: 34.9645, lng: 127.529 },
  { code: '4615012200', name: '왕지동', parentName: null, lat: 34.978, lng: 127.551 },
  { code: '4615011900', name: '오천동', parentName: null, lat: 34.9175, lng: 127.501 },
  { code: '4615011800', name: '풍덕동', parentName: null, lat: 34.93, lng: 127.514 },
  { code: '4615011500', name: '덕연동', parentName: null, lat: 34.9555, lng: 127.506 },
  { code: '4615011000', name: '석현동', parentName: null, lat: 34.9715, lng: 127.486 },
  { code: '4615010900', name: '매곡동', parentName: null, lat: 34.962, lng: 127.4815 },
  { code: '4615010400', name: '장천동', parentName: null, lat: 34.945, lng: 127.4925 },
  { code: '4615011700', name: '덕월동', parentName: null, lat: 34.938, lng: 127.4765 },
  { code: '4615031000', name: '서면', parentName: null, lat: 34.9855, lng: 127.474 },
];

const REGION_BY_NAME = new Map(REGIONS.map((r) => [r.name, r]));
function region(name: string): Region {
  const r = REGION_BY_NAME.get(name);
  if (!r) throw new Error(`unknown mock region ${name}`);
  return r;
}
/** Region of a complex spec (matches by emdCode, falls back to the name). */
function regionOfSpec(spec: MockComplexSpec): Region {
  return (
    REGIONS.find((r) => r.code === spec.emdCode) ??
    REGIONS.find((r) => spec.emdName.includes(r.name)) ??
    REGIONS.find((r) => spec.districtName?.startsWith(r.name.slice(0, 2))) ??
    region('연향동')
  );
}
/** 법정동 text of a region: "해룡면 신대리", "연향동". */
function emdNameOf(r: Region): string {
  if (!r.parentName) return r.name;
  return `${r.parentName} ${r.name.replace('지구', '리')}`;
}

// ---- helpers ------------------------------------------------------------------------------------

type Rnd = () => number;
const int = (rnd: Rnd, min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const pick = <T>(rnd: Rnd, items: readonly T[]): T => items[Math.floor(rnd() * items.length)] as T;
const roundTo = (n: number, step: number) => Math.round(n / step) * step;
const day = (d: number) => `2026-11-${String(d).padStart(2, '0')}T10:00:00+09:00`;
/** A day on or before the fixture "today" (2026-11-23). */
const recentDay = (rnd: Rnd, span = 12) => day(23 - int(rnd, 0, span));
const sample = <T>(rnd: Rnd, items: readonly T[], chance: number): T[] =>
  items.filter(() => rnd() < chance);

const DIRECTIONS: readonly Direction[] = [
  Direction.SOUTH,
  Direction.SOUTH,
  Direction.SOUTH,
  Direction.SOUTH_EAST,
  Direction.SOUTH_EAST,
  Direction.SOUTH_WEST,
  Direction.EAST,
  Direction.WEST,
];

const { SALE, JEONSE, MONTHLY, PRESALE } = DealType;

function base(
  id: string,
  assetType: AssetType,
  dealType: DealType,
  r: Region,
  at: { lat: number; lng: number },
): MockListing {
  return {
    id,
    assetType,
    dealType,
    status: ListingStatus.ACTIVE,
    emdCode: r.code,
    emdName: emdNameOf(r),
    lat: Number(at.lat.toFixed(6)),
    lng: Number(at.lng.toFixed(6)),
    options: [],
    agencyCount: 1,
    photoCount: 0,
    sameBuildingCount: 0,
    coverPhotoUrl: null,
  };
}

// ---- 아파트 (from the complex fixtures) ----------------------------------------------------------

const APT_OPTIONS: readonly ListingOption[] = [
  ListingOption.AIR_CONDITIONER,
  ListingOption.BUILT_IN_WARDROBE,
  ListingOption.SHOE_RACK,
  ListingOption.INDUCTION,
  ListingOption.DISHWASHER,
  ListingOption.VERANDA,
  ListingOption.BALCONY,
];
const APT_ALWAYS: readonly ListingOption[] = [
  ListingOption.ELEVATOR,
  ListingOption.PARKING,
  ListingOption.CCTV,
  ListingOption.SECURITY,
];

/**
 * The apartment inventory is the w-complex one (`complexes/_listings.ts`): same ids, prices and
 * counts as `GET /complexes/:id/listings`, so the map, the side list and the complex page agree.
 */
function aptListings(): MockListing[] {
  return allMockListings().map((l): MockListing => {
    const spec = COMPLEX_SPECS.find((s) => s.code === l.complexCode);
    const rnd = seededRandom(`w-map-${l.id}`);
    return {
      ...base(l.id, l.assetType, l.dealType, spec ? regionOfSpec(spec) : region('연향동'), l),
      status: l.status,
      title: l.title,
      emdName: spec?.emdName ?? null,
      complexId: l.complexId,
      complexName: l.complexName,
      dong: l.dong,
      pyeongLabel: l.pyeongLabel?.replace('평', '') ?? null,
      salePrice: l.salePrice,
      deposit: l.deposit,
      monthlyRent: l.monthlyRent,
      presalePrice: l.presalePrice,
      premium: l.premium,
      exclusiveArea: l.exclusiveArea,
      supplyArea: l.supplyArea,
      floor: l.floor,
      totalFloors: l.totalFloors,
      floorClass: l.floorClass,
      direction: l.direction,
      rooms: l.rooms,
      baths: l.baths,
      builtYear: l.builtYear,
      maintenanceFeeWon: roundTo((l.supplyArea ?? 100) * int(rnd, 1500, 2300), 10_000),
      options: [...APT_ALWAYS, ...sample(rnd, APT_OPTIONS, 0.55)],
      verifiedAt: l.verifiedAt,
      publishedAt: l.publishedAt,
      agencyCount: l.agencyCount,
      photoCount: l.photoCount,
      coverPhotoUrl: l.coverPhotoUrl,
    };
  });
}

// ---- 원룸·투룸 -----------------------------------------------------------------------------------

interface RoomMain {
  roomType: RoomType;
  floor: number;
  dealType: DealType;
  deposit: number;
  monthlyRent?: number;
  area: number;
  feeMan: number;
  photos: number;
  verifiedDay: number;
  agencies: number;
}

interface RoomBuilding {
  seed: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  builtYear: number;
  floors: number;
  note: string;
  /** Rooms generated in addition to the pinned mockdata row. */
  extra: number;
  main?: RoomMain;
}

const building = (
  seed: string,
  name: string,
  regionName: string,
  lat: number,
  lng: number,
  builtYear: number,
  floors: number,
  note: string,
  extra: number,
  main?: RoomMain,
): RoomBuilding => ({
  seed,
  name,
  region: regionName,
  lat,
  lng,
  builtYear,
  floors,
  note,
  extra,
  main,
});

const roomMain = (
  roomType: RoomType,
  floor: number,
  dealType: DealType,
  deposit: number,
  monthlyRent: number | undefined,
  area: number,
  feeMan: number,
  photos: number,
  verifiedDay: number,
  agencies: number,
): RoomMain => ({
  roomType,
  floor,
  dealType,
  deposit,
  monthlyRent,
  area,
  feeMan,
  photos,
  verifiedDay,
  agencies,
});

const ROOM_BUILDINGS: readonly RoomBuilding[] = [
  // mockdata.md §3 (R01–R06)
  building(
    'R01',
    '해오름빌',
    '석현동',
    34.9706,
    127.4893,
    2019,
    4,
    '순천대 정문 도보 6분',
    3,
    roomMain(RoomType.TWO_ROOM, 3, MONTHLY, 500, 42, 36, 7, 9, 21, 4),
  ),
  building(
    'R02',
    '청암하우스',
    '덕월동',
    34.9386,
    127.4778,
    2015,
    5,
    '청암대 후문 도보 4분',
    2,
    roomMain(RoomType.ONE_ROOM, 2, MONTHLY, 300, 32, 19, 5, 7, 22, 2),
  ),
  building(
    'R03',
    '그린캠퍼스',
    '석현동',
    34.9698,
    127.4838,
    2021,
    5,
    '순천대 도보 9분',
    4,
    roomMain(RoomType.ONE_HALF_ROOM, 4, MONTHLY, 500, 38, 28, 6, 12, 20, 3),
  ),
  building(
    'R04',
    '호수뷰 오피스텔',
    '조례동',
    34.9668,
    127.5352,
    2018,
    15,
    '조례호수공원 앞',
    6,
    roomMain(RoomType.ONE_ROOM, 9, MONTHLY, 1000, 45, 23, 10, 14, 20, 1),
  ),
  building(
    'R05',
    '센트로빌',
    '연향동',
    34.9462,
    127.5318,
    2012,
    4,
    '연향 패션거리 인근',
    2,
    roomMain(RoomType.TWO_ROOM, 2, JEONSE, 9500, undefined, 42, 3, 8, 19, 2),
  ),
  building(
    'R06',
    '역세권 스테이',
    '장천동',
    34.9441,
    127.4958,
    2016,
    6,
    '순천역 도보 8분',
    3,
    roomMain(RoomType.ONE_ROOM, 3, MONTHLY, 200, 35, 17, 5, 6, 18, 1),
  ),
  building(
    'RB07',
    '석현 스카이빌',
    '석현동',
    34.9722,
    127.4866,
    2017,
    4,
    '순천대 정문 도보 4분',
    3,
  ),
  building(
    'RB08',
    '대학로 원룸텔',
    '석현동',
    34.9728,
    127.4821,
    2014,
    4,
    '순천대 후문 도보 5분',
    2,
  ),
  building('RB09', '석현 하늘채', '석현동', 34.9688, 127.4872, 2020, 5, '순천대 정문 도보 8분', 1),
  building('RB10', '캠퍼스타운', '석현동', 34.9741, 127.4889, 2022, 5, '순천대 도보 7분', 4),
  building('RB11', '매곡 포레스트', '매곡동', 34.9638, 127.4848, 2016, 4, '순천대 도보 14분', 4),
  building('RB12', '매곡 리빙텔', '매곡동', 34.9612, 127.4802, 2013, 4, '매곡동 주민센터 인근', 1),
  building('RB13', '매곡 한울빌', '매곡동', 34.9596, 127.4841, 2018, 4, '중앙시장 도보 10분', 2),
  building('RB14', '덕월 스테이', '덕월동', 34.9368, 127.4801, 2019, 5, '청암대 정문 도보 6분', 3),
  building('RB15', '청암 드림빌', '덕월동', 34.9402, 127.4752, 2011, 4, '청암대 후문 도보 8분', 2),
  building('RB16', '조례 드림빌', '조례동', 34.9631, 127.5262, 2017, 5, '조례사거리 도보 5분', 2),
  building(
    'RB17',
    '조례 센텀 오피스텔',
    '조례동',
    34.9612,
    127.5311,
    2020,
    12,
    '조례호수공원 도보 6분',
    5,
  ),
  building(
    'RB18',
    '연향 패션빌',
    '연향동',
    34.9486,
    127.5279,
    2015,
    5,
    '연향 패션거리 도보 3분',
    3,
  ),
  building('RB19', '연향 미소가', '연향동', 34.9441, 127.5352, 2018, 4, '연향도서관 인근', 2),
  building('RB20', '장천 미소빌', '장천동', 34.9466, 127.4902, 2010, 4, '순천역 도보 12분', 2),
  building(
    'RB21',
    '터미널 스테이',
    '장천동',
    34.9428,
    127.4911,
    2021,
    7,
    '종합버스터미널 도보 5분',
    3,
  ),
  building('RB22', '덕연 리버빌', '덕연동', 34.9548, 127.5042, 2016, 4, '동천 산책로 앞', 2),
  building(
    'RB23',
    '신대 스마트빌',
    '신대지구',
    34.9242,
    127.5762,
    2020,
    5,
    '신대 중심상가 도보 4분',
    3,
  ),
  building('RB24', '오천 리버빌', '오천동', 34.9186, 127.5036, 2014, 4, '오천 생태공원 인근', 2),
  building('RB25', '풍덕 하임', '풍덕동', 34.9312, 127.5128, 2019, 5, '아랫장 도보 7분', 2),
];

const ROOM_OPTIONS: readonly ListingOption[] = [
  ListingOption.BED,
  ListingOption.DESK,
  ListingOption.CLOSET,
  ListingOption.INDUCTION,
  ListingOption.MICROWAVE,
  ListingOption.TV,
  ListingOption.WIFI,
  ListingOption.SHOE_RACK,
  ListingOption.CCTV,
];
/** "풀옵션" = 에어컨 + 냉장고 + 세탁기. */
export const FULL_OPTION: readonly ListingOption[] = [
  ListingOption.AIR_CONDITIONER,
  ListingOption.REFRIGERATOR,
  ListingOption.WASHER,
];

function roomListings(b: RoomBuilding): MockListing[] {
  const rnd = seededRandom(`w-map-room-${b.seed}`);
  const r = region(b.region);
  const total = (b.main ? 1 : 0) + b.extra;
  const out: MockListing[] = [];
  for (let i = 0; i < total; i++) {
    const main = i === 0 ? b.main : undefined;
    const roomType =
      main?.roomType ??
      pick(rnd, [RoomType.ONE_ROOM, RoomType.ONE_ROOM, RoomType.ONE_HALF_ROOM, RoomType.TWO_ROOM]);
    const size =
      main?.area ??
      (roomType === RoomType.ONE_ROOM
        ? int(rnd, 16, 24)
        : roomType === RoomType.ONE_HALF_ROOM
          ? int(rnd, 26, 33)
          : int(rnd, 34, 46));
    const jeonse = main ? main.dealType === JEONSE : rnd() < 0.18;
    const newer = b.builtYear >= 2018 ? 1.15 : 1;
    const rentBase =
      roomType === RoomType.ONE_ROOM ? 30 : roomType === RoomType.ONE_HALF_ROOM ? 36 : 42;
    const full = rnd() < 0.62;
    const listing: MockListing = {
      ...base(
        mockUuid(main ? b.seed : `listing-${b.seed}-${i}`),
        AssetType.ONEROOM,
        jeonse ? JEONSE : MONTHLY,
        r,
        b,
      ),
      buildingName: b.name,
      locationNote: b.note,
      roomType,
      rooms: roomType === RoomType.TWO_ROOM ? 2 : 1,
      baths: 1,
      exclusiveArea: size,
      floor: main?.floor ?? int(rnd, 1, b.floors),
      totalFloors: b.floors,
      direction: pick(rnd, DIRECTIONS),
      builtYear: b.builtYear,
      maintenanceFeeWon: (main?.feeMan ?? int(rnd, 3, 9)) * 10_000,
      options: [
        ...(full ? FULL_OPTION : sample(rnd, FULL_OPTION, 0.5)),
        ...sample(rnd, ROOM_OPTIONS, 0.5),
        ...(b.floors >= 5 ? [ListingOption.ELEVATOR] : []),
        ...(rnd() < 0.45 ? [ListingOption.PARKING] : []),
        ...(rnd() < 0.2 ? [ListingOption.PET_ALLOWED] : []),
      ],
      verifiedAt: main ? day(main.verifiedDay) : rnd() < 0.8 ? recentDay(rnd, 14) : null,
      publishedAt: day(23 - int(rnd, 0, 21)),
      agencyCount: main?.agencies ?? pick(rnd, [1, 1, 2, 2, 3]),
      photoCount: main?.photos ?? int(rnd, 4, 15),
      sameBuildingCount: total - 1,
    };
    if (jeonse) {
      listing.deposit = main?.deposit ?? roundTo(size * int(rnd, 190, 260) * newer, 500);
    } else {
      const deposit = main?.deposit ?? pick(rnd, [200, 300, 300, 500, 500, 1000]);
      listing.deposit = deposit;
      listing.monthlyRent =
        main?.monthlyRent ??
        Math.round(rentBase * newer + int(rnd, -4, 6) - (deposit >= 1000 ? 3 : 0));
    }
    out.push(listing);
  }
  return out;
}

// ---- 주택 ---------------------------------------------------------------------------------------

const HOUSE_KINDS = ['단독주택', '다가구주택', '빌라', '전원주택'] as const;
const HOUSE_SPOTS: readonly (readonly [string, number, number])[] = [
  ['매곡동', 34.9628, 127.4792],
  ['매곡동', 34.9602, 127.4836],
  ['장천동', 34.9462, 127.4938],
  ['덕연동', 34.9572, 127.5078],
  ['덕연동', 34.9538, 127.5036],
  ['왕지동', 34.9792, 127.5478],
  ['왕지동', 34.9762, 127.5546],
  ['풍덕동', 34.9288, 127.5152],
  ['풍덕동', 34.9318, 127.5098],
  ['석현동', 34.9752, 127.4842],
  ['조례동', 34.9668, 127.5236],
  ['연향동', 34.9492, 127.5262],
  ['오천동', 34.9158, 127.4978],
  ['서면', 34.9848, 127.4762],
  ['서면', 34.9872, 127.4712],
  ['신대지구', 34.9178, 127.5846],
  ['선월지구', 34.9098, 127.5672],
  ['덕월동', 34.9362, 127.4738],
];

function houseListings(): MockListing[] {
  const rnd = seededRandom('w-map-house');
  const out: MockListing[] = [];
  HOUSE_SPOTS.forEach(([name, lat, lng], si) => {
    const r = region(name);
    const rural = name === '서면' || !!r.parentName;
    const n = int(rnd, 1, 3);
    for (let i = 0; i < n; i++) {
      const kind = rural ? pick(rnd, ['전원주택', '단독주택'] as const) : pick(rnd, HOUSE_KINDS);
      const detached = kind === '단독주택' || kind === '전원주택';
      const dealType = detached
        ? pick(rnd, [SALE, SALE, SALE, JEONSE])
        : pick(rnd, [SALE, JEONSE, MONTHLY, MONTHLY]);
      const builtYear = int(rnd, 1994, 2024);
      const exclusive = detached ? int(rnd, 82, 168) : int(rnd, 48, 96);
      const land = detached ? int(rnd, 165, 520) : null;
      const totalFloors = detached ? int(rnd, 1, 2) : int(rnd, 3, 5);
      const listing: MockListing = {
        ...base(mockUuid(`listing-H${si}-${i}`), AssetType.HOUSE, dealType, r, {
          lat: lat + (rnd() - 0.5) * 0.0016,
          lng: lng + (rnd() - 0.5) * 0.002,
        }),
        title: `${emdNameOf(r).split(' ').pop() ?? name} ${kind}`,
        kindLabel: kind,
        exclusiveArea: exclusive,
        landArea: land,
        floor: detached ? null : int(rnd, 1, totalFloors),
        totalFloors,
        direction: pick(rnd, DIRECTIONS),
        rooms: exclusive > 120 ? 4 : exclusive > 70 ? 3 : 2,
        baths: exclusive > 100 ? 2 : 1,
        builtYear,
        maintenanceFeeWon: detached ? 0 : int(rnd, 2, 6) * 10_000,
        options: [
          ...sample(
            rnd,
            [
              ListingOption.AIR_CONDITIONER,
              ListingOption.BUILT_IN_WARDROBE,
              ListingOption.VERANDA,
              ListingOption.GAS_RANGE,
            ],
            0.5,
          ),
          ...(rnd() < 0.8 ? [ListingOption.PARKING] : []),
          ...(rnd() < 0.35 ? [ListingOption.PET_ALLOWED] : []),
        ],
        verifiedAt: rnd() < 0.78 ? recentDay(rnd, 16) : null,
        publishedAt: day(23 - int(rnd, 0, 22)),
        agencyCount: pick(rnd, [1, 1, 2, 3]),
        photoCount: int(rnd, 5, 18),
      };
      const age = Math.max(0.55, 1 - (2026 - builtYear) * 0.012);
      const value = detached
        ? roundTo((land ?? 200) * 62 * age + exclusive * 95 * age, 500)
        : roundTo(exclusive * 230 * age, 500);
      if (dealType === SALE) listing.salePrice = value;
      else if (dealType === JEONSE) listing.deposit = roundTo(value * 0.58, 500);
      else {
        listing.deposit = pick(rnd, [500, 1000, 2000, 3000]);
        listing.monthlyRent = roundTo(Math.max(30, exclusive * 0.75 * age), 5);
      }
      out.push(listing);
    }
  });
  return out;
}

// ---- 상업·업무 -----------------------------------------------------------------------------------

const SHOP_SPOTS: readonly (readonly [string, number, number, string])[] = [
  ['연향동', 34.9478, 127.5302, '연향 패션거리'],
  ['연향동', 34.9452, 127.5336, '연향 상업지구'],
  ['조례동', 34.9652, 127.5296, '조례 호수공원 상권'],
  ['조례동', 34.9626, 127.5252, '조례사거리'],
  ['신대지구', 34.9232, 127.5788, '신대 중심상가'],
  ['신대지구', 34.9206, 127.5826, '신대 호수공원 앞'],
  ['장천동', 34.9446, 127.4946, '순천역 앞'],
  ['장천동', 34.9432, 127.4902, '터미널 상권'],
  ['석현동', 34.9712, 127.4868, '순천대 정문 상권'],
  ['덕연동', 34.9562, 127.5068, '덕연 사거리'],
  ['왕지동', 34.9776, 127.5502, '왕지 법조타운'],
  ['오천동', 34.9172, 127.5012, '오천지구 상가'],
  ['풍덕동', 34.9306, 127.5136, '아랫장 인근'],
  ['매곡동', 34.9608, 127.4828, '중앙로 상권'],
];

function shopListings(): MockListing[] {
  const rnd = seededRandom('w-map-shop');
  const out: MockListing[] = [];
  SHOP_SPOTS.forEach(([name, lat, lng, note], si) => {
    const r = region(name);
    const n = int(rnd, 2, 3);
    for (let i = 0; i < n; i++) {
      const office = rnd() < 0.32;
      const totalFloors = int(rnd, 3, 9);
      const floor = office ? int(rnd, 2, totalFloors) : rnd() < 0.7 ? 1 : 2;
      const dealType = pick(rnd, [MONTHLY, MONTHLY, MONTHLY, SALE]);
      const size = office ? int(rnd, 40, 165) : int(rnd, 33, 132);
      const prime = floor === 1 ? 1.9 : 1;
      const kind = office ? '사무실' : `${floor}층 상가`;
      const listing: MockListing = {
        ...base(mockUuid(`listing-S${si}-${i}`), AssetType.COMMERCIAL, dealType, r, {
          lat: lat + (rnd() - 0.5) * 0.0012,
          lng: lng + (rnd() - 0.5) * 0.0016,
        }),
        title: `${note} ${kind}`,
        kindLabel: kind,
        locationNote: note,
        exclusiveArea: size,
        floor,
        totalFloors,
        direction: pick(rnd, DIRECTIONS),
        builtYear: int(rnd, 2003, 2024),
        maintenanceFeeWon: int(rnd, 5, 25) * 10_000,
        options: [
          ...(totalFloors >= 5 ? [ListingOption.ELEVATOR] : []),
          ...(rnd() < 0.7 ? [ListingOption.PARKING] : []),
          ...sample(
            rnd,
            [ListingOption.AIR_CONDITIONER, ListingOption.CCTV, ListingOption.SECURITY],
            0.5,
          ),
        ],
        verifiedAt: rnd() < 0.75 ? recentDay(rnd, 16) : null,
        publishedAt: day(23 - int(rnd, 0, 22)),
        agencyCount: pick(rnd, [1, 1, 2, 2, 3]),
        photoCount: int(rnd, 3, 12),
      };
      if (dealType === SALE) listing.salePrice = roundTo(size * 420 * prime, 1000);
      else {
        const rent = roundTo(size * 1.35 * prime, 5);
        listing.monthlyRent = rent;
        listing.deposit = roundTo(rent * 12, 500);
      }
      out.push(listing);
    }
  });
  return out;
}

// ---- 토지 ---------------------------------------------------------------------------------------

type LandSpot = readonly [string, number, number, LandCategory, LandZone, number];
const { DAE, JEON, DAP, GWASUWON, IMYA, JAPJONGJI } = LandCategory;
const Z = LandZone;

/** [동, lat, lng, 지목, 용도지역, 평당가(만원)] */
const LAND_SPOTS: readonly LandSpot[] = [
  ['신대지구', 34.9262, 127.5852, DAE, Z.RESIDENTIAL, 520],
  ['신대지구', 34.9168, 127.5872, DAE, Z.COMMERCIAL, 980],
  ['신대지구', 34.9288, 127.5742, JEON, Z.GREEN, 95],
  ['선월지구', 34.9082, 127.5742, DAP, Z.GREEN, 78],
  ['선월지구', 34.9142, 127.5626, JEON, Z.MANAGEMENT, 62],
  ['선월지구', 34.9072, 127.5652, IMYA, Z.MANAGEMENT, 18],
  ['연향동', 34.9512, 127.5386, DAE, Z.RESIDENTIAL, 610],
  ['연향동', 34.9426, 127.5398, JAPJONGJI, Z.GREEN, 240],
  ['왕지동', 34.9818, 127.5562, JEON, Z.GREEN, 110],
  ['왕지동', 34.9838, 127.5462, IMYA, Z.GREEN, 26],
  ['왕지동', 34.9768, 127.5586, DAE, Z.RESIDENTIAL, 430],
  ['서면', 34.9872, 127.4782, DAP, Z.AGRICULTURAL, 34],
  ['서면', 34.9836, 127.4692, JEON, Z.MANAGEMENT, 58],
  ['서면', 34.9882, 127.4856, GWASUWON, Z.AGRICULTURAL, 41],
  ['서면', 34.9826, 127.4816, DAE, Z.MANAGEMENT, 185],
  ['오천동', 34.9128, 127.5056, DAP, Z.GREEN, 88],
  ['오천동', 34.9152, 127.4952, JAPJONGJI, Z.GREEN, 150],
  ['풍덕동', 34.9272, 127.5186, DAE, Z.RESIDENTIAL, 480],
  ['풍덕동', 34.9252, 127.5112, JEON, Z.GREEN, 120],
  ['덕월동', 34.9342, 127.4712, IMYA, Z.GREEN, 22],
  ['덕월동', 34.9402, 127.4722, JEON, Z.GREEN, 92],
  ['석현동', 34.9772, 127.4812, DAE, Z.RESIDENTIAL, 390],
  ['조례동', 34.9702, 127.5226, DAE, Z.COMMERCIAL, 1150],
  ['덕연동', 34.9588, 127.5022, DAE, Z.RESIDENTIAL, 450],
];

const LAND_CATEGORY_WORD: Record<LandCategory, string> = {
  DAE: '대지',
  JEON: '밭(전)',
  DAP: '논(답)',
  GWASUWON: '과수원',
  IMYA: '임야',
  JAPJONGJI: '잡종지',
  ETC: '토지',
};

function landListings(): MockListing[] {
  const rnd = seededRandom('w-map-land');
  const out: MockListing[] = [];
  LAND_SPOTS.forEach(([name, lat, lng, category, zone, perPyeong], si) => {
    const r = region(name);
    const n = int(rnd, 1, 2);
    for (let i = 0; i < n; i++) {
      const pyeong =
        category === DAE
          ? int(rnd, 80, 320)
          : category === IMYA
            ? int(rnd, 900, 4200)
            : int(rnd, 200, 1400);
      out.push({
        ...base(mockUuid(`listing-T${si}-${i}`), AssetType.LAND, SALE, r, {
          lat: lat + (rnd() - 0.5) * 0.002,
          lng: lng + (rnd() - 0.5) * 0.0026,
        }),
        title: `${emdNameOf(r)} ${LAND_CATEGORY_WORD[category]}`,
        kindLabel: LAND_CATEGORY_WORD[category],
        landArea: Math.round(pyeong * 3.305785),
        landCategory: category,
        landZone: zone,
        salePrice: roundTo(pyeong * perPyeong * (0.9 + rnd() * 0.25), 500),
        locationNote:
          rnd() < 0.6
            ? pick(rnd, ['2차선 도로 접', '4m 도로 접', '계획도로 예정', '마을 안길 접'])
            : null,
        verifiedAt: rnd() < 0.7 ? recentDay(rnd, 18) : null,
        publishedAt: day(23 - int(rnd, 0, 22)),
        agencyCount: pick(rnd, [1, 1, 1, 2, 3]),
        photoCount: int(rnd, 2, 9),
      });
    }
  });
  return out;
}

// ---- catalog ------------------------------------------------------------------------------------

export const APT_LISTINGS: readonly MockListing[] = aptListings();
export const ROOM_LISTINGS: readonly MockListing[] = ROOM_BUILDINGS.flatMap(roomListings);
export const HOUSE_LISTINGS: readonly MockListing[] = houseListings();
export const SHOP_LISTINGS: readonly MockListing[] = shopListings();
export const LAND_LISTINGS: readonly MockListing[] = landListings();

/** Every active mock listing (co-brokered listings appear once). */
export const LISTINGS: readonly MockListing[] = [
  ...APT_LISTINGS,
  ...ROOM_LISTINGS,
  ...HOUSE_LISTINGS,
  ...SHOP_LISTINGS,
  ...LAND_LISTINGS,
];

// ---- complex summaries --------------------------------------------------------------------------

const range = (values: readonly number[]) =>
  values.length ? { min: Math.min(...values), max: Math.max(...values) } : null;

/** Headline amount used by price filters and sorts (만원). */
export function headlinePrice(l: ListingSummary): number {
  if (l.dealType === SALE) return l.salePrice ?? 0;
  if (l.dealType === PRESALE) return (l.presalePrice ?? 0) + (l.premium ?? 0);
  return l.deposit ?? 0;
}

export interface MockComplexSummary extends ComplexSummary {
  lat: number;
  lng: number;
  viewCount: number;
  emdCode: string;
}

export function toComplexSummary(spec: MockComplexSpec): MockComplexSummary {
  const id = complexIdOf(spec.code);
  const own = APT_LISTINGS.filter((l) => l.complexId === id);
  const of = (deal: DealType) => own.filter((l) => l.dealType === deal).map(headlinePrice);
  const main = [...spec.areas].sort((a, b) => b.households - a.households)[0] as MockAreaSpec;
  const presaleOnly = spec.approvalDate === null;
  const perPyeong = own
    .filter((l) => l.dealType === SALE || l.dealType === PRESALE)
    .map((l) => headlinePrice(l) / ((l.supplyArea ?? 1) / 3.305785));
  return {
    id,
    name: spec.name,
    assetType: AssetType.APT,
    emdName: spec.emdName,
    districtName: spec.districtName,
    lat: spec.lat,
    lng: spec.lng,
    households: spec.households,
    builtYear: spec.builtYear,
    moveInYm: presaleOnly ? `${spec.builtYear}.03` : null,
    pyeongLabels: spec.areas.map((a) => String(a.pyeong)),
    salePrice: range(of(SALE)),
    jeonsePrice: range(of(JEONSE)),
    presalePrice: range(of(PRESALE)),
    counts: {
      presale: spec.counts[0],
      sale: spec.counts[1],
      jeonse: spec.counts[2],
      monthly: spec.counts[3],
    },
    pricePerPyeong: perPyeong.length
      ? roundTo(perPyeong.reduce((a, b) => a + b, 0) / perPyeong.length, 10)
      : null,
    latestTrade: presaleOnly
      ? null
      : {
          price: main.sale,
          pyeongLabel: String(main.pyeong),
          dealYm: main.saleYm,
          delta: spec.code === 'C01' ? 2500 : null,
        },
    coverPhotoUrl: null,
    viewCount: spec.viewCount,
    emdCode: regionOfSpec(spec).code,
  };
}

/** All complexes, most viewed first ("자주 찾는 단지"). */
export const COMPLEX_SUMMARIES: readonly MockComplexSummary[] = [...COMPLEX_SPECS]
  .sort((a, b) => b.viewCount - a.viewCount)
  .map(toComplexSummary);
