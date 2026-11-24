/**
 * Demo seed (FICTIONAL data, local/staging only): 단지 + 평형, 중개사무소 + 직원, ~200 매물 with
 * 공동중개 links, 실매물 확인 and photos, 실거래가, banners in every slot, a popup, notices, FAQ,
 * local videos. Idempotent: rows use deterministic ids and are only created when missing; the
 * denormalized counters and 실거래가 stats are recomputed at the end of every run.
 */
import path from 'node:path';
import {
  BANNER_SLOT_SPECS,
  checkPublishRequirements,
  MaintenanceFeeBillingType,
  MaintenanceFeeKind,
  sqmToPyeong,
  type BannerSlot,
  type MaintenanceFee,
} from '@house/shared';
import {
  AgencyMemberRole,
  AgencyMemberStatus,
  AgencyStatus,
  AssetType,
  BannerTargeting,
  BuildingUse,
  DealType,
  Direction,
  DirectionBasis,
  FloorDisplay,
  ListingAgencyStatus,
  ListingOption,
  ListingStatus,
  MediaPurpose,
  MoveInType,
  PopupPage,
  type Prisma,
  type PrismaClient,
  RoomType,
  TradeDealType,
  TradeSyncKind,
  UserRole,
  UserStatus,
  VerificationMethod,
} from '@prisma/client';
import type { CacheService } from '../../src/common/cache/cache.service';
import { pyeongLabel } from '../../src/common/utils/area';
import {
  listingWriteColumns,
  publishCheckInput,
  type ListingState,
  type PropertyState,
} from '../../src/modules/listings/domain/listing-state';
import { ListingCountersService } from '../../src/modules/listings/services/listing-counters.service';
import { TradeStatsService } from '../../src/modules/complexes/trade-sync/trade-stats.service';
import type { PrismaService } from '../../src/prisma/prisma.service';
import {
  AGENCIES,
  COMPLEXES,
  FAQS,
  NOTICES,
  SPOTS,
  VIDEOS,
  type SeedAgency,
  type SeedComplex,
} from './demo-data';
import { ensureImage } from './images';
import { REGION } from './regions';
import {
  dateOnly,
  daysAgo,
  intBetween,
  jitter,
  pick,
  rng,
  roundTo,
  seedId,
  type Rand,
} from './util';

const DAY = 86_400_000;
const AD_TTL_DAYS = 30;

interface AgencyCtx {
  id: string;
  data: SeedAgency;
  members: { id: string; userId: string; name: string; phone: string }[];
}

interface Counts {
  complexes: number;
  agencies: number;
  listings: number;
  trades: number;
  banners: number;
}

function regionCode(name: string): string {
  const r = REGION[name];
  if (!r) throw new Error(`unknown seed region ${name}`);
  return r.code;
}

/** 사업자등록번호 check digit (same rule as isValidBusinessNumber). */
function businessNumber(prefix9: string): string {
  const d = prefix9.split('').map(Number);
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = d.reduce((acc, v, i) => acc + v * (w[i] ?? 0), 0);
  sum += Math.floor(((d[8] ?? 0) * 5) / 10);
  return `${prefix9}${(10 - (sum % 10)) % 10}`;
}

const HOURS = {
  mon: { open: '09:00', close: '18:30' },
  tue: { open: '09:00', close: '18:30' },
  wed: { open: '09:00', close: '18:30' },
  thu: { open: '09:00', close: '18:30' },
  fri: { open: '09:00', close: '18:30' },
  sat: { open: '10:00', close: '15:00' },
  sun: null,
  note: '점심 12:00~13:00 · 방문 전 전화 예약 (가상 데이터)',
};

async function seedComplexes(prisma: PrismaClient, sggCode: string, r: Rand) {
  const out = new Map<string, { id: string; data: SeedComplex; areaTypeIds: string[] }>();
  for (const c of COMPLEXES) {
    const id = seedId('complex', c.key);
    const emd = REGION[c.emd];
    const approval = c.approval ? new Date(`${c.approval}T00:00:00Z`) : null;
    await prisma.complex.upsert({
      where: { id },
      update: {},
      create: {
        id,
        assetType: c.assetType,
        name: c.name,
        roadAddress: c.roadAddress,
        jibunAddress: `전남광주통합특별시 순천시 ${c.emd} ${c.jibun}`,
        sggCode,
        emdCode: regionCode(c.emd),
        emdName: emd?.name ?? null,
        jibun: c.jibun,
        lat: c.lat,
        lng: c.lng,
        households: c.households,
        buildings: c.buildings,
        floorsMin: c.floorsMin,
        floorsMax: c.floorsMax,
        approvalDate: approval,
        builtYear: c.builtYear,
        parkingTotal: Math.round(c.households * c.parkingPerHousehold),
        parkingPerHousehold: c.parkingPerHousehold,
        floorAreaRatio: c.far,
        buildingCoverageRatio: c.bcr,
        heatingType: c.heating,
        builder: c.builder,
        externalCode: `SEED-${c.key}`,
        viewCount: intBetween(r, 50, 3000),
      },
    });
    const areaTypeIds: string[] = [];
    for (const t of c.areaTypes) {
      const atId = seedId('area-type', `${c.key}:${t.type}`);
      await prisma.complexAreaType.upsert({
        where: { id: atId },
        update: {},
        create: {
          id: atId,
          complexId: id,
          exclusiveArea: t.ex,
          supplyArea: t.sup,
          typeName: t.type,
          pyeongLabel: pyeongLabel(t.sup),
          households: t.households,
          rooms: t.rooms,
          baths: t.baths,
        },
      });
      areaTypeIds.push(atId);
    }
    out.set(c.key, { id, data: c, areaTypeIds });
  }
  return out;
}

async function seedAgencies(
  prisma: PrismaClient,
  sggCode: string,
  now: Date,
): Promise<Map<string, AgencyCtx>> {
  const out = new Map<string, AgencyCtx>();
  for (const a of AGENCIES) {
    const id = seedId('agency', a.key);
    const ownerId = seedId('user', `${a.key}:owner`);
    await prisma.user.upsert({
      where: { id: ownerId },
      update: {},
      create: {
        id: ownerId,
        email: `${a.key}-owner@seed.example.invalid`,
        name: a.representative,
        nickname: a.representative,
        phone: a.mobile,
        role: UserRole.AGENCY_OWNER,
        status: UserStatus.ACTIVE,
        ageConfirmedAt: now,
      },
    });
    await prisma.agency.upsert({
      where: { id },
      update: {},
      create: {
        id,
        ownerUserId: ownerId,
        name: a.name,
        representativeName: a.representative,
        registrationNumber: a.regNo,
        businessNumber: businessNumber(a.bizPrefix),
        phone: a.phone,
        mobile: a.mobile,
        email: `${a.key}@seed.example.invalid`,
        roadAddress: a.roadAddress,
        sggCode,
        emdCode: regionCode(a.emd),
        lat: a.lat,
        lng: a.lng,
        intro: a.intro,
        businessHours: HOURS,
        specialties: a.specialties,
        status: AgencyStatus.APPROVED,
        approvedAt: daysAgo(now, 120),
      },
    });
    const historyId = seedId('agency-history', a.key);
    await prisma.agencyStatusHistory.upsert({
      where: { id: historyId },
      update: {},
      create: {
        id: historyId,
        agencyId: id,
        fromStatus: AgencyStatus.PENDING,
        toStatus: AgencyStatus.APPROVED,
        reason: '시드 데이터 (가상 중개사무소)',
      },
    });
    const members: AgencyCtx['members'] = [];
    const people = [
      {
        key: 'owner',
        name: a.representative,
        licensed: true,
        title: '대표 공인중개사',
        role: AgencyMemberRole.OWNER,
        phone: a.mobile,
      },
      ...a.staff.map((s, i) => ({
        key: `staff${i + 1}`,
        name: s.name,
        licensed: s.licensed,
        title: s.title,
        role: AgencyMemberRole.AGENT,
        phone: `0100000${a.key.slice(1).padStart(2, '0')}${i + 2}${i + 2}`.slice(0, 11),
      })),
    ];
    for (const p of people) {
      const userId = seedId('user', `${a.key}:${p.key}`);
      if (p.role === AgencyMemberRole.AGENT) {
        await prisma.user.upsert({
          where: { id: userId },
          update: {},
          create: {
            id: userId,
            email: `${a.key}-${p.key}@seed.example.invalid`,
            name: p.name,
            nickname: p.name,
            phone: p.phone,
            role: UserRole.AGENT,
            status: UserStatus.ACTIVE,
            ageConfirmedAt: now,
          },
        });
      }
      const memberId = seedId('agency-member', `${a.key}:${p.key}`);
      await prisma.agencyMember.upsert({
        where: { id: memberId },
        update: {},
        create: {
          id: memberId,
          agencyId: id,
          userId,
          role: p.role,
          status: AgencyMemberStatus.ACTIVE,
          displayName: p.name,
          title: p.title,
          phone: p.phone,
          isLicensed: p.licensed,
          joinedAt: daysAgo(now, 110),
        },
      });
      members.push({ id: memberId, userId, name: p.name, phone: p.phone });
    }
    out.set(a.key, { id, data: a, members });
  }
  return out;
}

// ---------------------------------------------------------------- listings

interface ListingPlan {
  n: number;
  agencyKey: string;
  property: PropertyState;
  listing: ListingState;
}

const DIRECTIONS = [
  Direction.SOUTH,
  Direction.SOUTH,
  Direction.SOUTH,
  Direction.SOUTH_EAST,
  Direction.SOUTH_WEST,
  Direction.EAST,
  Direction.WEST,
];
const ROOM_OPTIONS = [
  ListingOption.AIR_CONDITIONER,
  ListingOption.REFRIGERATOR,
  ListingOption.WASHER,
  ListingOption.BED,
  ListingOption.DESK,
  ListingOption.CLOSET,
  ListingOption.INDUCTION,
  ListingOption.WIFI,
  ListingOption.CCTV,
];
const APT_OPTIONS = [
  ListingOption.AIR_CONDITIONER,
  ListingOption.BUILT_IN_WARDROBE,
  ListingOption.ELEVATOR,
  ListingOption.PARKING,
  ListingOption.VERANDA,
  ListingOption.CCTV,
  ListingOption.DISHWASHER,
];

function someOf<T>(r: Rand, items: readonly T[], min: number, max: number): T[] {
  const n = intBetween(r, min, max);
  return [...items].sort(() => r() - 0.5).slice(0, n);
}

function moveIn(r: Rand, now: Date): { moveInType: MoveInType; moveInDate: Date | null } {
  const x = r();
  if (x < 0.45) return { moveInType: MoveInType.IMMEDIATE, moveInDate: null };
  if (x < 0.75) return { moveInType: MoveInType.NEGOTIABLE, moveInDate: null };
  const d = new Date(now.getTime() + intBetween(r, 20, 120) * DAY);
  return {
    moveInType: MoveInType.DATE,
    moveInDate: dateOnly(d.getUTCFullYear(), d.getUTCMonth() + 1, 1),
  };
}

function baseListing(dealType: DealType, title: string, description: string): ListingState {
  return {
    dealType,
    title: title.slice(0, 80),
    description,
    salePrice: null,
    deposit: null,
    monthlyRent: null,
    presalePrice: null,
    premium: null,
    maintenanceFeeWon: null,
    maintenanceFee: null,
    moveInType: null,
    moveInDate: null,
    floorDisplay: FloorDisplay.EXACT,
    options: [],
  };
}

/**
 * 정액관리비 breakdown that adds up to `won`: the fixed 사용료 given in `usage`, the rest is
 * 일반관리비; `excluded` 사용료 are billed separately (표시·광고 세부기준).
 */
function fixedFee(
  won: number,
  usage: Partial<Record<MaintenanceFeeKind, number>>,
  excluded: MaintenanceFeeKind[],
): MaintenanceFee {
  const usageItems = Object.entries(usage).map(([kind, amountWon]) => ({
    kind: kind as MaintenanceFeeKind,
    included: true,
    amountWon,
  }));
  const usageSum = usageItems.reduce((acc, i) => acc + i.amountWon, 0);
  return {
    billingType: MaintenanceFeeBillingType.FIXED,
    items: [
      { kind: MaintenanceFeeKind.GENERAL, included: true, amountWon: won - usageSum },
      ...usageItems,
      ...excluded.map((kind) => ({ kind, included: false })),
    ],
  };
}

function emptyProperty(assetType: AssetType, sggCode: string): PropertyState {
  return {
    assetType,
    complexId: null,
    areaTypeId: null,
    roadAddress: '',
    jibunAddress: null,
    buildingName: null,
    dong: null,
    ho: null,
    sggCode,
    emdCode: null,
    lat: 0,
    lng: 0,
    floor: null,
    totalFloors: null,
    exclusiveArea: null,
    supplyArea: null,
    landArea: null,
    totalFloorArea: null,
    rooms: null,
    roomType: null,
    baths: null,
    direction: null,
    directionBasis: null,
    approvalDate: null,
    parkingSpaces: null,
    heatingType: null,
    zoning: null,
    landCategory: null,
    buildingUse: null,
  };
}

const AGENCY_FOR_COMPLEX: Record<string, string[]> = {
  'sindae-lake': ['a1', 'a2'],
  'sindae-central': ['a2', 'a1'],
  'ocheon-river': ['a3'],
  'yeonhyang-hanmaeum': ['a4', 'a7'],
  'jorye-lakepark': ['a5', 'a7'],
  'wangji-bonghwa': ['a6', 'a5'],
  'geumdang-sunshine': ['a7', 'a5'],
  'seonwol-sky': ['a2', 'a1'],
  'yeonhyang-station-ot': ['a4'],
};

function planListings(
  r: Rand,
  now: Date,
  sggCode: string,
  complexes: Map<string, { id: string; data: SeedComplex; areaTypeIds: string[] }>,
): ListingPlan[] {
  const plans: ListingPlan[] = [];
  let n = 0;
  const per: Record<string, number> = {
    'sindae-lake': 20,
    'sindae-central': 20,
    'ocheon-river': 16,
    'yeonhyang-hanmaeum': 14,
    'jorye-lakepark': 14,
    'wangji-bonghwa': 12,
    'geumdang-sunshine': 12,
    'seonwol-sky': 12,
    'yeonhyang-station-ot': 16,
  };
  for (const [key, cx] of complexes) {
    const c = cx.data;
    for (let i = 0; i < (per[key] ?? 10); i++) {
      const tIdx = intBetween(r, 0, c.areaTypes.length - 1);
      const t = c.areaTypes[tIdx];
      const atId = cx.areaTypeIds[tIdx];
      if (!t || !atId) continue;
      const presale = c.approval === null;
      const isOt = c.assetType === AssetType.OFFICETEL;
      const dealType = presale
        ? DealType.PRESALE
        : pick(
            r,
            isOt
              ? [DealType.MONTHLY, DealType.MONTHLY, DealType.JEONSE, DealType.SALE]
              : [DealType.SALE, DealType.SALE, DealType.JEONSE, DealType.MONTHLY],
          );
      const floor = intBetween(r, 2, c.floorsMax);
      const pos = jitter(r, c.lat, c.lng, 120);
      const p: PropertyState = {
        ...emptyProperty(c.assetType, sggCode),
        complexId: cx.id,
        areaTypeId: atId,
        roadAddress: c.roadAddress,
        jibunAddress: `전남광주통합특별시 순천시 ${c.emd} ${c.jibun}`,
        buildingName: c.name,
        dong: isOt ? null : `${100 + intBetween(r, 1, c.buildings)}동`,
        ho: `${floor}${String(intBetween(r, 1, 4)).padStart(2, '0')}호`,
        emdCode: regionCode(c.emd),
        lat: pos.lat,
        lng: pos.lng,
        floor,
        totalFloors: c.floorsMax,
        exclusiveArea: t.ex,
        supplyArea: t.sup,
        rooms: t.rooms,
        baths: t.baths,
        direction: pick(r, DIRECTIONS),
        directionBasis: isOt ? DirectionBasis.MAIN_ROOM : DirectionBasis.LIVING_ROOM,
        approvalDate: c.approval ? new Date(`${c.approval}T00:00:00Z`) : null,
        parkingSpaces: Math.max(1, Math.round(c.parkingPerHousehold)),
        heatingType: c.heating,
      };
      const py = Math.round(sqmToPyeong(t.sup));
      const sale = roundTo(
        c.pricePerSqm * t.ex * (0.9 + r() * 0.25) * (floor > c.floorsMax * 0.3 ? 1.03 : 0.95),
        100,
      );
      const title = presale
        ? `${c.name} ${t.type} 분양권 ${py}평 ${floor}층`
        : `${c.name} ${py}평 ${floor > c.floorsMax * 0.6 ? '고층 ' : ''}${p.direction === Direction.SOUTH ? '남향' : ''}`.trim();
      const l = baseListing(
        dealType,
        title,
        `${c.name} ${t.type}(전용 ${t.ex}㎡) 매물입니다. 단지 내 관리 상태 양호, 주변 생활편의시설 이용이 편리합니다. (가상 매물)`,
      );
      if (dealType === DealType.SALE) l.salePrice = sale;
      if (dealType === DealType.JEONSE) l.deposit = roundTo(sale * (0.62 + r() * 0.12), 500);
      if (dealType === DealType.MONTHLY) {
        l.deposit = roundTo(isOt ? 300 + r() * 700 : 1000 + r() * 3000, 100);
        l.monthlyRent = roundTo(isOt ? 30 + r() * 35 : 50 + r() * 50, 5);
      }
      if (dealType === DealType.PRESALE) {
        l.presalePrice = roundTo(c.pricePerSqm * t.ex, 10);
        l.premium = roundTo(500 + r() * 3000, 100);
      }
      l.maintenanceFeeWon = roundTo((isOt ? 60_000 : 120_000) + t.ex * (800 + r() * 600), 1000);
      // 오피스텔: 정액 (인터넷·수도 포함), 아파트: 월별 실비 정산 (월평균 금액 + 포함 항목).
      l.maintenanceFee = isOt
        ? fixedFee(
            l.maintenanceFeeWon,
            { [MaintenanceFeeKind.INTERNET]: 10_000, [MaintenanceFeeKind.WATER]: 10_000 },
            [MaintenanceFeeKind.ELECTRICITY, MaintenanceFeeKind.GAS],
          )
        : {
            billingType: MaintenanceFeeBillingType.ACTUAL,
            items: [
              MaintenanceFeeKind.GENERAL,
              MaintenanceFeeKind.ELECTRICITY,
              MaintenanceFeeKind.WATER,
              MaintenanceFeeKind.HEATING,
            ].map((kind) => ({ kind, included: true })),
          };
      const mi = presale
        ? { moveInType: MoveInType.DATE, moveInDate: dateOnly(c.builtYear, 6, 1) }
        : moveIn(r, now);
      l.moveInType = mi.moveInType;
      l.moveInDate = mi.moveInDate;
      l.floorDisplay = r() < 0.3 ? FloorDisplay.CLASS : FloorDisplay.EXACT;
      l.options = someOf(r, APT_OPTIONS, 2, 5);
      plans.push({
        n: n++,
        agencyKey: pick(r, AGENCY_FOR_COMPLEX[key] ?? ['a1']),
        property: p,
        listing: l,
      });
    }
  }

  const spotListing = (
    assetType: AssetType,
    spot: { emd: string; street: string; lat: number; lng: number; agency: string },
    i: number,
    build: (p: PropertyState) => ListingState,
  ) => {
    const pos = jitter(r, spot.lat, spot.lng, 350);
    const p: PropertyState = {
      ...emptyProperty(assetType, sggCode),
      roadAddress: `전남광주통합특별시 순천시 ${spot.street} ${intBetween(r, 2, 120)}`,
      jibunAddress: `전남광주통합특별시 순천시 ${spot.emd} ${intBetween(r, 100, 999)}-${intBetween(r, 1, 30)}`,
      emdCode: regionCode(spot.emd),
      lat: pos.lat,
      lng: pos.lng,
    };
    const l = build(p);
    plans.push({
      n: n++,
      agencyKey:
        i % 4 === 3
          ? pick(
              r,
              AGENCIES.map((a) => a.key),
            )
          : spot.agency,
      property: p,
      listing: l,
    });
  };

  // 원룸·투룸
  for (let i = 0; i < 34; i++) {
    const spot = SPOTS.ONEROOM[i % SPOTS.ONEROOM.length];
    if (!spot) continue;
    spotListing(AssetType.ONEROOM, spot, i, (p) => {
      const two = r() < 0.35;
      p.buildingName = `${spot.emd} ${pick(r, ['하우스', '빌', '스테이', '리빙'])}${intBetween(r, 1, 9)}`;
      p.floor = intBetween(r, 1, 5);
      p.totalFloors = Math.max(p.floor, intBetween(r, 4, 6));
      p.exclusiveArea = Number((two ? 33 + r() * 12 : 18 + r() * 10).toFixed(2));
      p.rooms = two ? 2 : 1;
      // Some larger 원룸 have a separate sleeping space: 1.5룸 (stated; not derivable from rooms).
      if (!two && i % 5 === 2) p.roomType = RoomType.ONE_HALF_ROOM;
      p.baths = 1;
      p.direction = pick(r, DIRECTIONS);
      p.directionBasis = DirectionBasis.MAIN_ROOM;
      p.approvalDate = dateOnly(intBetween(r, 2004, 2022), intBetween(r, 1, 12), 15);
      p.parkingSpaces = intBetween(r, 0, 1);
      p.heatingType = '개별난방(도시가스)';
      p.buildingUse = i % 3 === 0 ? BuildingUse.MULTIPLEX_HOUSE : BuildingUse.MULTI_FAMILY_HOUSE;
      p.ho = `${p.floor}0${intBetween(r, 1, 6)}호`;
      const jeonse = r() < 0.2;
      const l = baseListing(
        jeonse ? DealType.JEONSE : DealType.MONTHLY,
        `${spot.emd} ${two ? '투룸' : '원룸'} ${p.floor}층 ${jeonse ? '전세' : '풀옵션'}`,
        `${spot.emd} ${two ? '투룸' : '원룸'}입니다. 버스정류장 도보 5분, 관리 잘 된 건물입니다. (가상 매물)`,
      );
      if (jeonse) l.deposit = roundTo(5000 + r() * 4500, 500);
      else {
        l.deposit = roundTo(200 + r() * 800, 100);
        l.monthlyRent = roundTo(two ? 38 + r() * 17 : 25 + r() * 15, 1);
      }
      l.maintenanceFeeWon = roundTo(40_000 + r() * 40_000, 5000);
      l.maintenanceFee = fixedFee(
        l.maintenanceFeeWon,
        { [MaintenanceFeeKind.WATER]: 10_000, [MaintenanceFeeKind.INTERNET]: 10_000 },
        [MaintenanceFeeKind.ELECTRICITY, MaintenanceFeeKind.GAS],
      );
      Object.assign(l, moveIn(r, now));
      l.options = someOf(r, ROOM_OPTIONS, 3, 7);
      return l;
    });
  }
  // 주택
  for (let i = 0; i < 14; i++) {
    const spot = SPOTS.HOUSE[i % SPOTS.HOUSE.length];
    if (!spot) continue;
    spotListing(AssetType.HOUSE, spot, i, (p) => {
      p.totalFloors = intBetween(r, 1, 2);
      p.totalFloorArea = Number((70 + r() * 130).toFixed(2));
      p.landArea = Number((150 + r() * 350).toFixed(2));
      p.rooms = intBetween(r, 3, 5);
      p.baths = intBetween(r, 1, 2);
      p.direction = pick(r, DIRECTIONS);
      p.directionBasis = DirectionBasis.ENTRANCE;
      p.approvalDate = dateOnly(intBetween(r, 1985, 2018), intBetween(r, 1, 12), 1);
      p.parkingSpaces = intBetween(r, 0, 2);
      p.buildingUse = BuildingUse.DETACHED_HOUSE;
      p.landCategory = '대';
      const sale = r() < 0.8;
      const l = baseListing(
        sale ? DealType.SALE : DealType.JEONSE,
        `${spot.emd} 단독주택 대지 ${Math.round(sqmToPyeong(p.landArea))}평`,
        `${spot.emd} 마당 있는 단독주택입니다. 리모델링 이력 있음. (가상 매물)`,
      );
      if (sale) l.salePrice = roundTo(9000 + r() * 30000, 500);
      else l.deposit = roundTo(6000 + r() * 6000, 500);
      l.maintenanceFeeWon = 0;
      Object.assign(l, moveIn(r, now));
      l.options = someOf(
        r,
        [ListingOption.PARKING, ListingOption.PET_ALLOWED, ListingOption.CCTV],
        0,
        2,
      );
      return l;
    });
  }
  // 상가·사무실
  for (let i = 0; i < 14; i++) {
    const spot = SPOTS.COMMERCIAL[i % SPOTS.COMMERCIAL.length];
    if (!spot) continue;
    spotListing(AssetType.COMMERCIAL, spot, i, (p) => {
      p.buildingName = `${spot.emd} ${pick(r, ['프라자', '타워', '스퀘어'])}`;
      p.floor = intBetween(r, 1, 4);
      p.totalFloors = Math.max(p.floor, intBetween(r, 4, 9));
      p.exclusiveArea = Number((33 + r() * 140).toFixed(2));
      p.supplyArea = Number((p.exclusiveArea * 1.45).toFixed(2));
      p.rooms = 0;
      p.baths = 1;
      p.direction = pick(r, DIRECTIONS);
      p.directionBasis = DirectionBasis.ENTRANCE;
      p.approvalDate = dateOnly(intBetween(r, 1999, 2021), intBetween(r, 1, 12), 1);
      p.parkingSpaces = intBetween(r, 2, 30);
      p.buildingUse =
        p.floor === 1 ? BuildingUse.NEIGHBORHOOD_FACILITY_1 : BuildingUse.NEIGHBORHOOD_FACILITY_2;
      const sale = r() < 0.3;
      const l = baseListing(
        sale ? DealType.SALE : DealType.MONTHLY,
        `${spot.emd} ${p.floor === 1 ? '1층 상가' : `${p.floor}층 사무실`} ${Math.round(sqmToPyeong(p.exclusiveArea))}평`,
        `${spot.emd} 유동인구 많은 ${p.floor === 1 ? '코너 상가' : '사무실'}입니다. 업종 상담 가능. (가상 매물)`,
      );
      if (sale) l.salePrice = roundTo(15000 + r() * 50000, 500);
      else {
        l.deposit = roundTo(1000 + r() * 4000, 500);
        l.monthlyRent = roundTo(60 + r() * 240, 5);
      }
      l.maintenanceFeeWon = roundTo(50_000 + p.exclusiveArea * 1500, 1000);
      l.maintenanceFee = fixedFee(l.maintenanceFeeWon, { [MaintenanceFeeKind.WATER]: 10_000 }, [
        MaintenanceFeeKind.ELECTRICITY,
      ]);
      Object.assign(l, moveIn(r, now));
      return l;
    });
  }
  // 토지
  for (let i = 0; i < 10; i++) {
    const spot = SPOTS.LAND[i % SPOTS.LAND.length];
    if (!spot) continue;
    spotListing(AssetType.LAND, spot, i, (p) => {
      p.landArea = Number((330 + r() * 3000).toFixed(2));
      p.landCategory = pick(r, ['전', '답', '임야', '대']);
      p.zoning = pick(r, ['계획관리지역', '생산관리지역', '자연녹지지역', '농림지역']);
      const l = baseListing(
        DealType.SALE,
        `${spot.emd} ${p.landCategory} ${Math.round(sqmToPyeong(p.landArea))}평`,
        `${spot.emd} ${p.zoning} ${p.landCategory}입니다. 도로 접함. (가상 매물)`,
      );
      l.salePrice = roundTo((p.landArea * (6 + r() * 30)) / 1, 100);
      return l;
    });
  }
  return plans;
}

function statusFor(n: number): ListingStatus {
  if (n % 41 === 7) return ListingStatus.HIDDEN;
  if (n % 29 === 5) return ListingStatus.DRAFT;
  if (n % 23 === 3) return ListingStatus.CLOSED;
  if (n % 13 === 4) return ListingStatus.RESERVED;
  return ListingStatus.ACTIVE;
}

async function seedListings(
  prisma: PrismaClient,
  r: Rand,
  now: Date,
  sggCode: string,
  complexes: Map<string, { id: string; data: SeedComplex; areaTypeIds: string[] }>,
  agencies: Map<string, AgencyCtx>,
  photoPool: Record<string, string[]>,
): Promise<number> {
  const plans = planListings(r, now, sggCode, complexes);
  const builtYearOf = new Map([...complexes.values()].map((c) => [c.id, c.data.builtYear]));
  const agencyList = [...agencies.values()];
  for (const plan of plans) {
    const agency = agencies.get(plan.agencyKey);
    if (!agency) throw new Error(`unknown seed agency ${plan.agencyKey}`);
    const status = statusFor(plan.n);
    const p = plan.property;
    const l = plan.listing;
    if (status === ListingStatus.ACTIVE || status === ListingStatus.RESERVED) {
      const issues = checkPublishRequirements(
        publishCheckInput(l, p, {
          name: agency.data.name,
          roadAddress: agency.data.roadAddress,
          phone: agency.data.phone,
          registrationNumber: agency.data.regNo,
          representativeName: agency.data.representative,
        }),
      );
      if (issues.length > 0) {
        throw new Error(
          `seed listing #${plan.n} is not publishable: ${issues.map((i) => i.label).join(', ')}`,
        );
      }
    }
    const propertyId = seedId('property', plan.n);
    const listingId = seedId('listing', plan.n);
    const existing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true },
    });
    if (existing) continue;
    // Per-listing generator: re-runs and partial runs produce the same rows.
    const lr = rng(100_000 + plan.n);

    const publishedAt =
      status === ListingStatus.DRAFT ? null : daysAgo(now, intBetween(lr, 0, 25) + lr());
    const verified =
      publishedAt && lr() < 0.75
        ? new Date(Math.min(now.getTime(), publishedAt.getTime() + intBetween(lr, 0, 5) * DAY))
        : null;
    const lastFresh =
      verified && publishedAt
        ? new Date(Math.max(verified.getTime(), publishedAt.getTime()))
        : publishedAt;
    const photos =
      p.assetType === AssetType.LAND && lr() < 0.5
        ? []
        : lr() < 0.75
          ? someOf(lr, photoPool[p.assetType] ?? [], 1, 3)
          : [];
    const cols = listingWriteColumns(
      l,
      p,
      p.complexId ? (builtYearOf.get(p.complexId) ?? null) : null,
    );
    const primaryContact = pick(lr, agency.members);

    await prisma.$transaction(async (tx) => {
      await tx.property.create({
        data: {
          id: propertyId,
          assetType: p.assetType,
          complexId: p.complexId,
          areaTypeId: p.areaTypeId,
          roadAddress: p.roadAddress,
          jibunAddress: p.jibunAddress,
          buildingName: p.buildingName,
          dong: p.dong,
          ho: p.ho,
          sggCode: p.sggCode,
          emdCode: p.emdCode,
          lat: p.lat,
          lng: p.lng,
          floor: p.floor,
          totalFloors: p.totalFloors,
          exclusiveArea: p.exclusiveArea,
          supplyArea: p.supplyArea,
          landArea: p.landArea,
          totalFloorArea: p.totalFloorArea,
          rooms: p.rooms,
          roomType: p.roomType,
          baths: p.baths,
          direction: p.direction,
          directionBasis: p.directionBasis,
          approvalDate: p.approvalDate,
          parkingSpaces: p.parkingSpaces,
          heatingType: p.heatingType,
          zoning: p.zoning,
          landCategory: p.landCategory,
          buildingUse: p.buildingUse,
          createdById: primaryContact.userId,
        },
      });
      await tx.listing.create({
        data: {
          id: listingId,
          propertyId,
          ...cols,
          status,
          primaryAgencyId: agency.id,
          createdById: primaryContact.userId,
          publishedAt,
          closedAt: status === ListingStatus.CLOSED ? daysAgo(now, 1) : null,
          expiresAt:
            lastFresh && status !== ListingStatus.CLOSED
              ? new Date(lastFresh.getTime() + AD_TTL_DAYS * DAY)
              : null,
          hiddenReason: status === ListingStatus.HIDDEN ? '허위매물 신고 확인 (시드 예시)' : null,
          verifiedAt: verified,
          viewCount: publishedAt ? intBetween(lr, 0, 800) : 0,
          photoCount: photos.length,
        },
      });
      await tx.listingAgency.create({
        data: {
          listingId,
          agencyId: agency.id,
          isPrimary: true,
          status: ListingAgencyStatus.ACTIVE,
          contactMemberId: primaryContact.id,
          contactName: primaryContact.name,
          contactPhone: primaryContact.phone,
          joinedAt: publishedAt ?? now,
        },
      });
      // 공동중개: about a third of the live listings are shared with 1–2 other offices.
      if (publishedAt && lr() < 0.35) {
        const others = someOf(
          lr,
          agencyList.filter((a) => a.id !== agency.id),
          1,
          2,
        );
        for (const other of others) {
          const contact = pick(lr, other.members);
          await tx.listingAgency.create({
            data: {
              listingId,
              agencyId: other.id,
              isPrimary: false,
              status: ListingAgencyStatus.ACTIVE,
              contactMemberId: contact.id,
              contactName: contact.name,
              contactPhone: contact.phone,
              joinedAt: publishedAt,
            },
          });
        }
      }
      if (verified) {
        await tx.listingVerification.create({
          data: {
            listingId,
            method: pick(lr, [
              VerificationMethod.OWNER_CONFIRMED,
              VerificationMethod.SITE_VISIT,
              VerificationMethod.OWNER_CALL,
              VerificationMethod.DOCUMENT,
            ]),
            verifiedAt: verified,
            verifiedByUserId: primaryContact.userId,
            note: '시드 데이터: 소유자 확인 (가상)',
          },
        });
      }
      for (const [i, mediaId] of photos.entries()) {
        await tx.listingPhoto.create({
          data: { listingId, mediaId, sortOrder: i, isCover: i === 0 },
        });
      }
    });
  }
  return plans.length;
}

// ---------------------------------------------------------------- 실거래가

async function seedTrades(
  prisma: PrismaClient,
  now: Date,
  sggCode: string,
  complexes: Map<string, { id: string; data: SeedComplex; areaTypeIds: string[] }>,
): Promise<number> {
  const r = rng(2024);
  let count = 0;
  const rows: Prisma.TradeRecordCreateManyInput[] = [];
  for (const [key, cx] of complexes) {
    const c = cx.data;
    if (c.assetType !== AssetType.APT || c.approval === null) continue;
    for (const [ti, t] of c.areaTypes.entries()) {
      const areaTypeId = cx.areaTypeIds[ti] ?? null;
      for (let m = 23; m >= 0; m--) {
        const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, 1));
        const ym = month.getUTCFullYear() * 100 + month.getUTCMonth() + 1;
        // Gentle upward trend (~4%/yr) with noise.
        const trend = 1 - (m / 12) * 0.04;
        const kinds: [TradeDealType, number][] = [
          [TradeDealType.SALE, intBetween(r, 0, 3)],
          [TradeDealType.JEONSE, intBetween(r, 0, 2)],
          [TradeDealType.MONTHLY, intBetween(r, 0, 1)],
        ];
        for (const [dealType, n] of kinds) {
          for (let i = 0; i < n; i++) {
            // No trade dated after yesterday (data.go.kr reports with a delay anyway).
            const current = ym === now.getUTCFullYear() * 100 + now.getUTCMonth() + 1;
            const day = intBetween(r, 1, current ? Math.max(1, now.getUTCDate() - 1) : 28);
            const sale = roundTo(c.pricePerSqm * t.ex * trend * (0.9 + r() * 0.2), 50);
            const monthly = dealType === TradeDealType.MONTHLY;
            rows.push({
              sourceKey: `seed:${key}:${t.type}:${ym}:${dealType}:${i}`,
              kind:
                dealType === TradeDealType.SALE ? TradeSyncKind.APT_TRADE : TradeSyncKind.APT_RENT,
              complexId: cx.id,
              areaTypeId,
              sggCode,
              emdName: c.emd,
              aptName: c.name,
              jibun: c.jibun,
              dealType,
              dealDate: dateOnly(month.getUTCFullYear(), month.getUTCMonth() + 1, day),
              dealYm: ym,
              exclusiveArea: t.ex,
              floor: intBetween(r, 2, c.floorsMax),
              price: dealType === TradeDealType.SALE ? sale : null,
              deposit:
                dealType === TradeDealType.SALE
                  ? null
                  : monthly
                    ? roundTo(1000 + r() * 3000, 100)
                    : roundTo(sale * (0.65 + r() * 0.1), 100),
              monthlyRent: monthly ? roundTo(45 + r() * 50, 5) : null,
              builtYear: c.builtYear,
              cancelled: false,
              contractType: dealType === TradeDealType.SALE ? null : '신규',
            });
            count++;
          }
        }
      }
    }
  }
  await prisma.tradeRecord.createMany({ data: rows, skipDuplicates: true });
  const stats = new TradeStatsService(prisma as unknown as PrismaService);
  await stats.recompute([...complexes.values()].map((c) => c.id));
  return count;
}

// ---------------------------------------------------------------- ads + content

const SLOT_COLORS: Record<BannerSlot, string> = {
  MAIN_HERO: '#2563eb',
  MAIN_STRIP: '#0d9488',
  MAP_AD: '#ea580c',
  COMPLEX_FEATURED_AGENCY: '#7c3aed',
  LISTING_SIDE: '#db2777',
  AGENCY_SEARCH_TOP: '#16a34a',
  MOBILE_MAIN: '#0284c7',
};

async function seedAds(
  prisma: PrismaClient,
  uploadDir: string,
  now: Date,
  complexes: Map<string, { id: string }>,
  agencies: Map<string, AgencyCtx>,
): Promise<number> {
  let n = 0;
  const firstComplexes = [...complexes.values()].slice(0, 3).map((c) => c.id);
  for (const [slot, spec] of Object.entries(BANNER_SLOT_SPECS) as [
    BannerSlot,
    (typeof BANNER_SLOT_SPECS)[BannerSlot],
  ][]) {
    const count = slot === 'MAIN_HERO' ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const id = seedId('banner', `${slot}:${i}`);
      const pcMediaId = await ensureImage(prisma, uploadDir, {
        id: seedId('media', `banner:${slot}:${i}:pc`),
        name: `banner-${slot.toLowerCase()}-${i}-pc`,
        purpose: MediaPurpose.BANNER,
        width: spec.pc.width,
        height: spec.pc.height,
        label: `${slot} #${i + 1}`,
        color: SLOT_COLORS[slot],
      });
      const mobileMediaId = spec.mobile
        ? await ensureImage(prisma, uploadDir, {
            id: seedId('media', `banner:${slot}:${i}:mobile`),
            name: `banner-${slot.toLowerCase()}-${i}-mobile`,
            purpose: MediaPurpose.BANNER,
            width: spec.mobile.width,
            height: spec.mobile.height,
            label: `${slot} M#${i + 1}`,
            color: SLOT_COLORS[slot],
          })
        : null;
      const agency = spec.requiresAgency ? agencies.get(i % 2 === 0 ? 'a1' : 'a2') : undefined;
      const targeting = spec.requiredTargeting ?? BannerTargeting.ALL;
      // The third MAIN_HERO banner is scheduled (starts next week) to show the SCHEDULED state.
      const scheduled = slot === 'MAIN_HERO' && i === 2;
      const existing = await prisma.banner.findUnique({ where: { id }, select: { id: true } });
      if (!existing) {
        await prisma.banner.create({
          data: {
            id,
            slot,
            title: `(샘플) ${spec.label} 배너 ${i + 1}`,
            advertiserName: agency ? null : '(샘플 광고주)',
            agencyId: agency?.id ?? null,
            pcMediaId,
            mobileMediaId,
            linkUrl: agency ? `/agencies/${agency.id}` : slot === 'MAP_AD' ? '/map' : '/notices',
            newWindow: false,
            startAt: scheduled ? new Date(now.getTime() + 7 * DAY) : daysAgo(now, 3),
            endAt: new Date(now.getTime() + 90 * DAY),
            priority: count - i,
            sortOrder: i,
            targeting,
            memo: '시드 데이터',
          },
        });
        if (targeting === BannerTargeting.COMPLEXES) {
          await prisma.bannerTargetComplex.createMany({
            data: firstComplexes.map((complexId) => ({ bannerId: id, complexId })),
            skipDuplicates: true,
          });
        }
      }
      n++;
    }
  }
  const popupId = seedId('popup', 'welcome');
  const popupMedia = await ensureImage(prisma, uploadDir, {
    id: seedId('media', 'popup:welcome'),
    name: 'popup-welcome',
    purpose: MediaPurpose.POPUP,
    width: 600,
    height: 800,
    label: 'WELCOME POPUP',
    color: '#9333ea',
  });
  await prisma.popup.upsert({
    where: { id: popupId },
    update: {},
    create: {
      id: popupId,
      title: '(샘플) 서비스 오픈 안내',
      mediaId: popupMedia,
      linkUrl: '/notices',
      targetPages: [PopupPage.MAIN],
      startAt: daysAgo(now, 1),
      endAt: new Date(now.getTime() + 30 * DAY),
      dismissDays: 1,
      sortOrder: 0,
    },
  });
  return n;
}

async function seedContent(
  prisma: PrismaClient,
  now: Date,
  complexes: Map<string, { id: string }>,
): Promise<void> {
  for (const [i, notice] of NOTICES.entries()) {
    const id = seedId('notice', notice.key);
    await prisma.notice.upsert({
      where: { id },
      update: {},
      create: {
        id,
        title: notice.title,
        content: notice.content,
        isPinned: notice.pinned,
        isPublished: true,
        publishedAt: daysAgo(now, 10 - i),
      },
    });
  }
  for (const [i, faq] of FAQS.entries()) {
    const id = seedId('faq', i);
    await prisma.faq.upsert({
      where: { id },
      update: {},
      create: {
        id,
        category: faq.category,
        question: faq.q,
        answer: faq.a,
        sortOrder: i,
      },
    });
  }
  for (const [i, v] of VIDEOS.entries()) {
    const id = seedId('video', v.key);
    await prisma.localVideo.upsert({
      where: { id },
      update: {},
      create: {
        id,
        title: v.title,
        youtubeUrl: `https://www.youtube.com/watch?v=${v.id}`,
        youtubeVideoId: v.id,
        description: '샘플 영상 항목입니다. 관리자 화면에서 실제 지역 영상으로 바꿔 주세요.',
        regionCode: v.emd ? regionCode(v.emd) : null,
        complexId: v.key === 'v2' ? (complexes.get('sindae-lake')?.id ?? null) : null,
        sortOrder: i,
        publishedAt: daysAgo(now, 5),
      },
    });
  }
}

async function photoPool(
  prisma: PrismaClient,
  uploadDir: string,
): Promise<Record<string, string[]>> {
  const colors: Record<AssetType, string> = {
    APT: '#2563eb',
    OFFICETEL: '#0891b2',
    ONEROOM: '#65a30d',
    HOUSE: '#b45309',
    COMMERCIAL: '#be123c',
    LAND: '#15803d',
  };
  const out: Record<string, string[]> = {};
  for (const asset of Object.values(AssetType)) {
    out[asset] = [];
    for (let i = 0; i < 4; i++) {
      out[asset].push(
        await ensureImage(prisma, uploadDir, {
          id: seedId('media', `photo:${asset}:${i}`),
          name: `listing-${asset.toLowerCase()}-${i}`,
          purpose: MediaPurpose.LISTING_PHOTO,
          width: 1280,
          height: 960,
          label: `${asset} PHOTO ${i + 1}`,
          color: colors[asset],
        }),
      );
    }
  }
  return out;
}

export async function seedDemo(
  prisma: PrismaClient,
  options: { sggCode: string; uploadDir: string; now: Date },
): Promise<Counts> {
  // Fixed RNG seed (a number, not a region code) so the demo data stays the same across runs.
  const r = rng(46150);
  const uploadDir = path.resolve(options.uploadDir);
  const complexes = await seedComplexes(prisma, options.sggCode, r);
  const agencies = await seedAgencies(prisma, options.sggCode, options.now);
  const pool = await photoPool(prisma, uploadDir);
  const listings = await seedListings(
    prisma,
    r,
    options.now,
    options.sggCode,
    complexes,
    agencies,
    pool,
  );
  const trades = await seedTrades(prisma, options.now, options.sggCode, complexes);
  const banners = await seedAds(prisma, uploadDir, options.now, complexes, agencies);
  await seedContent(prisma, options.now, complexes);

  // Denormalized active_listing_count of every 단지 / 중개사무소 (same SQL as the listings module).
  const counters = new ListingCountersService({} as CacheService);
  await prisma.$transaction((tx) =>
    counters.refresh(tx, {
      complexIds: [...complexes.values()].map((c) => c.id),
      agencyIds: [...agencies.values()].map((a) => a.id),
    }),
  );
  return { complexes: complexes.size, agencies: agencies.size, listings, trades, banners };
}
