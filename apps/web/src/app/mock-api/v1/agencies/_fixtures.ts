import {
  AgencyMemberRole,
  pyeongToSqm,
  toAgencyDisclosure,
  type AgencyProfile,
  type AssetType,
  type DealType,
  type Direction,
} from '@house/shared';
import { mockUuid } from '@/lib/mock';
import { toListingSummary, type MockSummarySource } from '../listings/_summary';
import type {
  AgencyDealCounts,
  AgencyDetail,
  AgencyListing,
  AgencyRegion,
  AgencySummary,
} from '@/features/w-agencies/api/schemas';
import {
  COMPLEXES,
  DEFAULT_SIMPLE,
  SIMPLE_BY_ASSET,
  type ComplexDef,
  type PriceBase,
} from './_catalog';
import { EMD, OFFICES, at, type EmdKey, type OfficeDef } from './_offices';

/**
 * Payloads of the public agencies mock (w-agencies), derived from `_offices.ts` + `_catalog.ts`.
 * Listings are generated deterministically from each office's deal counts, so the counters on the
 * profile always add up. Other groups' mocks (`agencies/mine/**`, a-agency) are independent.
 */

const PHONE = '0610000000'; // placeholder 061-000-0000 only

/** Canonical mock id of an office — the same convention the banner mocks use. */
export const agencyIdOf = (key: string) => mockUuid(`agency-${key}`);
const complexIdOf = (code: string) => mockUuid(code); // same ids as the complexes / listings mocks

/**
 * Other groups' fixtures point at the same offices with different ids; accept them all so links
 * between mock pages work: `mockUuid('B01')` (listing detail), the raw code, and the id of the mock
 * broker session's agency (a-agency, `agencies/mine/_fixtures.ts`).
 */
const MOCK_SESSION_AGENCY_ID = '0b6f2c1e-0000-4000-8000-0000000000b1';
const byId = new Map<string, OfficeDef>();
for (const o of OFFICES) {
  byId.set(agencyIdOf(o.key), o);
  byId.set(mockUuid(o.key), o);
  byId.set(o.key, o);
}
const b01 = OFFICES.find((o) => o.key === 'B01');
if (b01) byId.set(MOCK_SESSION_AGENCY_ID, b01);

// ---- listings -----------------------------------------------------------------------------------

function hash(seed: string): number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}
const pick = <T>(arr: readonly T[], n: number): T => arr[n % arr.length] as T;

const DIRECTIONS: readonly Direction[] = [
  'SOUTH',
  'SOUTH_EAST',
  'SOUTH',
  'SOUTH_WEST',
  'EAST',
  'SOUTH',
];
const DEAL_ORDER: readonly DealType[] = ['PRESALE', 'SALE', 'JEONSE', 'MONTHLY'];

const floorClassOf = (floor: number, total: number) => {
  const ratio = floor / total;
  return ratio <= 1 / 3 ? ('LOW' as const) : ratio <= 2 / 3 ? ('MID' as const) : ('HIGH' as const);
};

/** A day in the two weeks before the mock "today" (2026-11-23). */
const verifiedDay = (n: number) => `2026-11-${String(22 - (n % 14)).padStart(2, '0')}`;

function priceFields(
  dealType: DealType,
  base: PriceBase,
  jitter: number,
): Partial<MockSummarySource> {
  const adjust = (value: number, step: number) =>
    Math.max(step, Math.round((value * (1 + jitter)) / step) * step);
  switch (dealType) {
    case 'MONTHLY':
      return { deposit: base.monthly[0], monthlyRent: adjust(base.monthly[1], 1) };
    case 'JEONSE':
      return { deposit: adjust(base.jeonse, 500) };
    case 'PRESALE': {
      const [presalePrice, premium] = base.presale ?? [base.sale, 0];
      return { presalePrice, premium: premium + Math.round(jitter * 100) * 100 };
    }
    default:
      return { salePrice: adjust(base.sale, 100) };
  }
}

function buildListings(o: OfficeDef): MockSummarySource[] {
  const out: MockSummarySource[] = [];
  const complexes = o.complexes
    .map((code) => COMPLEXES[code])
    .filter((c): c is ComplexDef => c !== undefined);
  const simple = o.specialties.flatMap((s) => SIMPLE_BY_ASSET[s] ?? []);
  let n = 0;
  DEAL_ORDER.forEach((wanted, dealIndex) => {
    const count = o.deals[dealIndex] ?? 0;
    for (let i = 0; i < count; i += 1, n += 1) {
      const h = hash(`${o.key}-${wanted}-${i}`);
      const jitter = ((h % 13) - 6) / 100; // ±6 %
      const common = {
        id: mockUuid(`listing-${o.key}-${n}`),
        verifiedAt: h % 9 === 0 ? null : verifiedDay(n + (h % 3)),
        coverPhotoUrl: null,
        agencyCount: 1 + (h % 4),
        emdName: EMD[o.emd].name,
      };
      // Offices with a second specialty mix other property types in (about one in four).
      const useComplex =
        complexes.length > 0 &&
        (simple.length === 0 || wanted === 'PRESALE' || (h >>> 5) % 4 !== 0);
      if (useComplex) {
        const presalePool = complexes.filter((c) => c.types.some((t) => t.presale));
        const pool = wanted === 'PRESALE' && presalePool.length > 0 ? presalePool : complexes;
        const complex = pick(pool, i + (h % 2));
        const types = wanted === 'PRESALE' ? complex.types.filter((t) => t.presale) : complex.types;
        const type = pick(types.length > 0 ? types : complex.types, h >>> 7);
        const floor = 1 + ((h >>> 9) % complex.floors);
        const supply = pyeongToSqm(type.py);
        out.push({
          ...common,
          assetType: 'APT',
          dealType: wanted,
          complexId: complexIdOf(complex.id),
          complexName: complex.name,
          dong: `${101 + ((h >>> 4) % 9)}동`,
          supplyArea: supply,
          exclusiveArea: Math.round(supply * 0.756 * 100) / 100,
          totalFloors: complex.floors,
          floorClass: floorClassOf(floor, complex.floors), // 공동주택: 저/중/고만 공개
          direction: pick(DIRECTIONS, h >>> 3),
          rooms: type.py >= 30 ? 3 : 2,
          ...priceFields(wanted, type, jitter),
        });
        continue;
      }
      // 분양권 only exists for complexes; land is only ever sold.
      const dealType: DealType = wanted === 'PRESALE' ? 'SALE' : wanted;
      const catalogue = (simple.length > 0 ? simple : DEFAULT_SIMPLE).filter(
        (s) => s.assetType !== 'LAND' || dealType === 'SALE',
      );
      const item = pick(catalogue.length > 0 ? catalogue : DEFAULT_SIMPLE, i + (h % 3));
      const isLand = item.assetType === 'LAND';
      const area = pyeongToSqm(item.py);
      out.push({
        ...common,
        assetType: item.assetType,
        dealType,
        // 원룸·오피스텔 rows are named by their building; houses, shops and land by the headline.
        ...(item.assetType === 'ONEROOM' || item.assetType === 'OFFICETEL'
          ? { buildingName: item.title }
          : { title: item.title }),
        supplyArea: isLand ? null : area,
        exclusiveArea: isLand ? null : Math.round(area * 0.8 * 100) / 100,
        landArea: isLand || item.assetType === 'HOUSE' ? area : null,
        floor: item.floors > 0 ? 1 + ((h >>> 9) % item.floors) : null,
        totalFloors: item.floors > 0 ? item.floors : null,
        direction: isLand ? null : pick(DIRECTIONS, h >>> 3),
        rooms: item.rooms ?? null,
        ...priceFields(dealType, item, jitter),
      });
    }
  });
  return out;
}

/**
 * Hand-written listings that replace the first generated listing of their deal type:
 * the 대표 매물 of 호수공원 exactly as drawn on the Agents design, and L01 for 신대중앙.
 * Ids that exist in the listing-detail mock (`mockUuid('L0x')`) make the links work in mock mode.
 */
const OVERRIDES: Record<string, Partial<MockSummarySource>[]> = {
  B01: [
    {
      id: mockUuid('L01'),
      dealType: 'SALE',
      complexName: '신대 레이크파크 1단지',
      dong: '103동',
      salePrice: 44500,
      supplyArea: pyeongToSqm(34),
      totalFloors: 25,
      floorClass: 'HIGH',
      direction: 'SOUTH',
      verifiedAt: '2026-11-22',
      agencyCount: 3,
    },
  ],
  B02: [
    {
      dealType: 'SALE',
      complexName: '조례 호수마을',
      dong: '103동',
      salePrice: 30500,
      supplyArea: pyeongToSqm(32),
      totalFloors: 18,
      floorClass: 'HIGH',
      direction: 'SOUTH',
      verifiedAt: '2026-11-22',
      agencyCount: 3,
    },
    {
      id: mockUuid('L03'),
      dealType: 'JEONSE',
      complexName: '연향 센트럴',
      dong: '108동',
      deposit: 24000,
      supplyArea: pyeongToSqm(32),
      totalFloors: 15,
      floorClass: 'MID',
      direction: 'SOUTH',
      verifiedAt: '2026-11-21',
      agencyCount: 4,
    },
    {
      id: mockUuid('L04'),
      dealType: 'MONTHLY',
      complexName: '조례 호수마을',
      dong: '102동',
      deposit: 2000,
      monthlyRent: 65,
      supplyArea: pyeongToSqm(24),
      totalFloors: 18,
      floorClass: 'LOW',
      direction: 'SOUTH_WEST',
      verifiedAt: '2026-11-21',
      agencyCount: 1,
    },
  ],
};

const listingCache = new Map<string, AgencyListing[]>();

function listingsOf(o: OfficeDef): AgencyListing[] {
  let list = listingCache.get(o.key);
  if (!list) {
    const rows = buildListings(o);
    for (const override of OVERRIDES[o.key] ?? []) {
      const index = rows.findIndex((l) => l.dealType === override.dealType);
      const current = rows[index];
      if (current) rows[index] = { ...current, ...override };
    }
    list = rows.map(toListingSummary);
    listingCache.set(o.key, list);
  }
  return list;
}

/** One listing per deal type first — the office's biggest deal type leads — filled up to four. */
function featuredOf(o: OfficeDef): AgencyListing[] {
  const list = listingsOf(o);
  const base: readonly DealType[] = ['SALE', 'JEONSE', 'MONTHLY', 'PRESALE'];
  const count = (deal: DealType) => o.deals[DEAL_ORDER.indexOf(deal)] ?? 0;
  // 분양권 전문 사무소는 분양권부터; otherwise keep 매매 → 전세 → 월세.
  const order = count('PRESALE') > count('SALE') ? (['PRESALE', ...base] as const) : base;
  const out: AgencyListing[] = [];
  for (const deal of order) {
    const first = list.find((l) => l.dealType === deal);
    if (first) out.push(first);
  }
  for (const l of list) {
    if (out.length >= 4) break;
    if (!out.includes(l)) out.push(l);
  }
  return out.slice(0, 4);
}

// ---- offices ------------------------------------------------------------------------------------

function toSummary(o: OfficeDef): AgencySummary {
  const emd = EMD[o.emd];
  return {
    id: agencyIdOf(o.key),
    name: o.name,
    representativeName: o.ceo,
    registrationNumber: o.reg,
    phone: PHONE,
    roadAddress: `전라남도 순천시 ${emd.name} ${o.street}`,
    addressDetail: o.detail,
    emdCode: emd.emdCode,
    emdName: emd.name,
    ...at(o.pos[0], o.pos[1]),
    specialties: o.specialties,
    activeListingCount: o.deals.reduce((sum, v) => sum + v, 0),
    logoUrl: null,
    tagline: o.tagline ?? null,
    topComplexes: o.complexes.map((code) => ({
      id: complexIdOf(code),
      name: COMPLEXES[code]?.name ?? code,
    })),
    handlesPresale: o.deals[0] > 0,
    businessHours: o.hours,
  };
}

function toDetail(o: OfficeDef): AgencyDetail {
  const listingCounts: AgencyDealCounts = { presale: 0, sale: 0, jeonse: 0, monthly: 0 };
  const listingCountsByAsset: Partial<Record<AssetType, number>> = {};
  for (const l of listingsOf(o)) {
    listingCounts[l.dealType.toLowerCase() as keyof AgencyDealCounts] += 1;
    listingCountsByAsset[l.assetType] = (listingCountsByAsset[l.assetType] ?? 0) + 1;
  }
  const hasStats = o.deals30d !== undefined || o.responseMin !== undefined;
  return {
    ...toSummary(o),
    mobile: null,
    jibunAddress: null,
    intro: o.intro ?? null,
    coverUrl: null,
    approvedAt: `${o.reg.split('-')[1] ?? '2020'}-03-02T09:00:00+09:00`,
    listingCounts,
    listingCountsByAsset,
    stats: hasStats
      ? { deals30d: o.deals30d ?? null, avgResponseMinutes: o.responseMin ?? null }
      : null,
    featuredListings: featuredOf(o),
    members: o.members ?? [{ displayName: o.ceo, title: '대표', isLicensed: true, role: 'OWNER' }],
  };
}

export const AGENCY_SUMMARIES: readonly AgencySummary[] = OFFICES.map(toSummary);

export function findAgencySummary(id: string): AgencySummary | null {
  const o = byId.get(id);
  return o ? toSummary(o) : null;
}

export function findAgencyDetail(id: string): AgencyDetail | null {
  const o = byId.get(id);
  return o ? toDetail(o) : null;
}

export function findAgencyListings(id: string): AgencyListing[] | null {
  const o = byId.get(id);
  return o ? listingsOf(o) : null;
}

/** The office that advertises a listing of the agency mock (its key = the listing-detail agency code). */
export function findAgencyListingById(
  id: string,
): { officeKey: string; listing: AgencyListing } | undefined {
  for (const o of OFFICES) {
    const listing = listingsOf(o).find((l) => l.id === id);
    if (listing) return { officeKey: o.key, listing };
  }
  return undefined;
}

export const AGENCY_REGIONS: readonly AgencyRegion[] = (Object.keys(EMD) as EmdKey[])
  .map((key) => ({
    emdCode: EMD[key].emdCode,
    name: EMD[key].name,
    count: OFFICES.filter((o) => o.emd === key).length,
    ...EMD[key].center,
  }))
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'));

/**
 * `GET /agencies/:id` wire shape (`AgencyProfile`): listing counts keyed by deal / asset type,
 * 대표 매물 as `AgencyListingCard`, the 표시·광고 disclosure block, `coverUrl`. Mock-only display
 * extras (tagline, 전문 단지, 30일 통계) are left out like the backend does.
 */
export function toAgencyProfileWire(d: AgencyDetail): AgencyProfile {
  const c = d.listingCounts;
  const byDealType: AgencyProfile['listingCounts']['byDealType'] = {};
  if (c.presale) byDealType.PRESALE = c.presale;
  if (c.sale) byDealType.SALE = c.sale;
  if (c.jeonse) byDealType.JEONSE = c.jeonse;
  if (c.monthly) byDealType.MONTHLY = c.monthly;
  return {
    id: d.id,
    name: d.name,
    representativeName: d.representativeName,
    registrationNumber: d.registrationNumber,
    phone: d.phone,
    roadAddress: d.roadAddress,
    addressDetail: d.addressDetail ?? null,
    emdCode: d.emdCode ?? null,
    lat: d.lat,
    lng: d.lng,
    specialties: d.specialties,
    logoUrl: d.logoUrl ?? null,
    coverUrl: d.coverUrl ?? null,
    activeListingCount: d.activeListingCount,
    mobile: d.mobile ?? null,
    email: null,
    jibunAddress: d.jibunAddress ?? null,
    intro: d.intro ?? null,
    businessHours: d.businessHours ?? null,
    approvedAt: d.approvedAt ?? null,
    warningCount: 0,
    members: d.members.map((m, i) => ({
      id: mockUuid(`${d.id}-M${i}`),
      displayName: m.displayName,
      title: m.title ?? null,
      role: m.role ?? AgencyMemberRole.AGENT,
      isLicensed: m.isLicensed,
    })),
    listingCounts: {
      total: c.presale + c.sale + c.jeonse + c.monthly,
      byAssetType: d.listingCountsByAsset,
      byDealType,
    },
    representativeListings: d.featuredListings.map((l) => ({
      id: l.id,
      assetType: l.assetType,
      dealType: l.dealType,
      title: l.title ?? null,
      complexName: l.complexName ?? null,
      salePrice: l.salePrice ?? null,
      deposit: l.deposit ?? null,
      monthlyRent: l.monthlyRent ?? null,
      presalePrice: l.presalePrice ?? null,
      premium: l.premium ?? null,
      exclusiveArea: l.exclusiveArea ?? null,
      rooms: l.rooms ?? null,
      thumbnailUrl: l.coverPhotoUrl ?? null,
      verifiedAt: l.verifiedAt ?? null,
      publishedAt: l.publishedAt ?? null,
    })),
    disclosure: toAgencyDisclosure({ ...d, addressDetail: d.addressDetail ?? null }),
  };
}
