import {
  COMPLEX_ASSET_TYPES,
  DealType,
  FloorClass,
  ListingSort,
  MAP_MAX_MARKERS,
  MapResultKind,
  SQM_PER_PYEONG,
  mapResultKindForZoom,
  type Bbox,
  type DealTypeStatsMap,
  type ListingFilter,
  type MapSearchResult,
} from '@house/shared';
import {
  LandCategory,
  LandZone,
  RoomType,
  type MapCluster,
  type MapComplexMarker,
  type MapListingMarker,
  type MapSearchResponse,
} from '@/features/w-map/api/schemas';
import { mockCsv } from '@/lib/mock';
import { COMPLEX_SUMMARIES, REGIONS, headlinePrice, type MockListing } from './_fixtures';

/**
 * Search logic shared by the map mock (`GET /map/search`) and the list mock (`GET /listings`).
 * Filters are exactly `listingFilterSchema` from @house/shared, including `roomTypes`,
 * `landZones` and `landCategories` (the API matches them against the listing's effective 방 구성
 * and the 용도지역 / 지목 groups — shared `effectiveRoomType`, `landZoneOf`, `landCategoryOf`).
 */
export interface MockFilter extends ListingFilter {
  roomTypes?: RoomType[];
  landZones?: LandZone[];
  landCategories?: LandCategory[];
}

const isOneOf = <T extends string>(e: Record<string, T>, v: string): v is T =>
  Object.values<string>(e).includes(v);

export function parseExtraFilters(
  sp: URLSearchParams,
): Pick<MockFilter, 'roomTypes' | 'landZones' | 'landCategories'> {
  const list = <T extends string>(key: string, e: Record<string, T>) => {
    const values = mockCsv(sp, key).filter((v): v is T => isOneOf(e, v));
    return values.length ? values : undefined;
  };
  return {
    roomTypes: list('roomTypes', RoomType),
    landZones: list('landZones', LandZone),
    landCategories: list('landCategories', LandCategory),
  };
}

/** Area the `areaMin/areaMax` filter applies to: 토지면적 for land, 공급면적 (else 전용) for buildings. */
export function filterArea(l: MockListing): number | null {
  return l.landArea && !l.exclusiveArea ? l.landArea : (l.supplyArea ?? l.exclusiveArea ?? null);
}

function floorClassOf(l: MockListing): FloorClass | null {
  if (l.floorClass) return l.floorClass;
  if (!l.floor || !l.totalFloors) return null;
  if (l.floor <= 1) return FloorClass.LOW;
  const ratio = l.floor / l.totalFloors;
  return ratio <= 1 / 3 ? FloorClass.LOW : ratio <= 2 / 3 ? FloorClass.MID : FloorClass.HIGH;
}

const within = (v: number | null | undefined, min?: number, max?: number) =>
  v !== null &&
  v !== undefined &&
  (min === undefined || v >= min) &&
  (max === undefined || v <= max);
const hasRange = (min?: number, max?: number) => min !== undefined || max !== undefined;

/**
 * Price filters constrain only the deal types they describe: `price*` → 매매·분양권,
 * `deposit*` → 전세·월세 보증금, `rent*` → 월세. Listings of other deal types pass.
 */
export function matchesFilter(l: MockListing, f: MockFilter): boolean {
  if (f.assetTypes?.length && !f.assetTypes.includes(l.assetType)) return false;
  if (f.dealTypes?.length && !f.dealTypes.includes(l.dealType)) return false;
  const sale = l.dealType === DealType.SALE || l.dealType === DealType.PRESALE;
  if (sale && hasRange(f.priceMin, f.priceMax) && !within(headlinePrice(l), f.priceMin, f.priceMax))
    return false;
  if (
    !sale &&
    hasRange(f.depositMin, f.depositMax) &&
    !within(l.deposit, f.depositMin, f.depositMax)
  )
    return false;
  if (
    l.dealType === DealType.MONTHLY &&
    hasRange(f.rentMin, f.rentMax) &&
    !within(l.monthlyRent, f.rentMin, f.rentMax)
  )
    return false;
  if (hasRange(f.areaMin, f.areaMax) && !within(filterArea(l), f.areaMin, f.areaMax)) return false;
  if (f.roomsMin !== undefined && (l.rooms ?? 0) < f.roomsMin) return false;
  if (f.bathsMin !== undefined && (l.baths ?? 0) < f.bathsMin) return false;
  if (f.directions?.length && !(l.direction && f.directions.includes(l.direction))) return false;
  if (f.floorClasses?.length) {
    const cls = floorClassOf(l);
    if (!cls || !f.floorClasses.includes(cls)) return false;
  }
  if (
    hasRange(f.builtYearMin, f.builtYearMax) &&
    !within(l.builtYear, f.builtYearMin, f.builtYearMax)
  )
    return false;
  if (f.options?.length && !f.options.every((o) => l.options.includes(o))) return false;
  if (f.verifiedOnly && !l.verifiedAt) return false;
  if (f.complexId && l.complexId !== f.complexId) return false;
  if (f.emdCode && !l.emdCode.startsWith(f.emdCode)) return false;
  if (f.roomTypes?.length && !(l.roomType && f.roomTypes.includes(l.roomType))) return false;
  if (f.landZones?.length && !(l.landZone && f.landZones.includes(l.landZone))) return false;
  if (f.landCategories?.length && !(l.landCategory && f.landCategories.includes(l.landCategory)))
    return false;
  return true;
}

export const inBbox = (l: { lat: number; lng: number }, b: Bbox) =>
  l.lng >= b.swLng && l.lng <= b.neLng && l.lat >= b.swLat && l.lat <= b.neLat;

/** One comparable amount per listing: 월세 is converted with 1만원/월 ≈ 보증금 100만원. */
export function sortPrice(l: MockListing): number {
  return l.dealType === DealType.MONTHLY
    ? (l.deposit ?? 0) + (l.monthlyRent ?? 0) * 100
    : headlinePrice(l);
}

export function sortListings(list: readonly MockListing[], sort: ListingSort): MockListing[] {
  const time = (s: string | null | undefined) => (s ? Date.parse(s) : 0);
  const by: Record<ListingSort, (a: MockListing, b: MockListing) => number> = {
    LATEST: (a, b) => time(b.publishedAt) - time(a.publishedAt),
    VERIFIED: (a, b) => time(b.verifiedAt) - time(a.verifiedAt),
    PRICE_ASC: (a, b) => sortPrice(a) - sortPrice(b),
    PRICE_DESC: (a, b) => sortPrice(b) - sortPrice(a),
    AREA_ASC: (a, b) => (filterArea(a) ?? 0) - (filterArea(b) ?? 0),
    AREA_DESC: (a, b) => (filterArea(b) ?? 0) - (filterArea(a) ?? 0),
    BUILT_YEAR_DESC: (a, b) => (b.builtYear ?? 0) - (a.builtYear ?? 0),
    PHOTO: (a, b) => b.photoCount - a.photoCount,
  };
  // Stable tie-breaker so pages never shuffle between requests.
  return [...list].sort((a, b) => by[sort](a, b) || a.id.localeCompare(b.id));
}

// ---- map aggregation ----------------------------------------------------------------------------

const avg = (values: readonly number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

function regionClusters(list: readonly MockListing[]): MapCluster[] {
  const counts = new Map<string, number>();
  for (const l of list) counts.set(l.emdCode, (counts.get(l.emdCode) ?? 0) + 1);
  return [...counts].flatMap(([code, count]) => {
    const r = REGIONS.find((x) => x.code === code);
    return r ? [{ id: code, regionCode: code, name: r.name, lat: r.lat, lng: r.lng, count }] : [];
  });
}

function gridClusters(list: readonly MockListing[], zoom: number): MapCluster[] {
  // ≈ ST_SnapToGrid: 0.02° cells at zoom 13, halving per zoom level.
  const cell = 0.02 / 2 ** (Math.floor(zoom) - 13);
  const cells = new Map<string, { lat: number; lng: number; count: number }>();
  for (const l of list) {
    const key = `${Math.floor(l.lng / cell)}:${Math.floor(l.lat / cell)}`;
    const c = cells.get(key) ?? { lat: 0, lng: 0, count: 0 };
    c.lat += l.lat;
    c.lng += l.lng;
    c.count += 1;
    cells.set(key, c);
  }
  return [...cells].map(([key, c]) => ({
    id: `g:${Math.floor(zoom)}:${key}`,
    name: null,
    regionCode: null,
    lat: Number((c.lat / c.count).toFixed(6)),
    lng: Number((c.lng / c.count).toFixed(6)),
    count: c.count,
  }));
}

const DEAL_PRIORITY: readonly DealType[] = [
  DealType.SALE,
  DealType.PRESALE,
  DealType.JEONSE,
  DealType.MONTHLY,
];

function complexMarker(complexId: string, list: readonly MockListing[]): MapComplexMarker | null {
  const summary = COMPLEX_SUMMARIES.find((c) => c.id === complexId);
  if (!summary) return null;
  const dealType = DEAL_PRIORITY.find((d) => list.some((l) => l.dealType === d));
  let representative: MapComplexMarker['representative'] = null;
  if (dealType) {
    const ofDeal = list.filter((l) => l.dealType === dealType);
    const byPyeong = new Map<string, MockListing[]>();
    for (const l of ofDeal) {
      const key = l.pyeongLabel ?? '';
      byPyeong.set(key, [...(byPyeong.get(key) ?? []), l]);
    }
    const [pyeongLabel, group] = [...byPyeong].sort((a, b) => b[1].length - a[1].length)[0] ?? [];
    const cheapest = group ? sortListings(group, ListingSort.PRICE_ASC)[0] : undefined;
    if (cheapest)
      representative = {
        pyeongLabel: pyeongLabel || null,
        supplyArea: cheapest.supplyArea,
        price: headlinePrice(cheapest),
        dealType,
      };
  }
  const { viewCount: _viewCount, emdCode: _emdCode, ...rest } = summary;
  return { ...rest, type: 'COMPLEX', count: list.length, representative };
}

function listingMarker(list: readonly MockListing[]): MapListingMarker {
  const rep = sortListings(list, ListingSort.PRICE_ASC)[0] as MockListing;
  return {
    type: 'LISTING',
    id: rep.id,
    lat: rep.lat,
    lng: rep.lng,
    dealType: rep.dealType,
    salePrice: rep.salePrice,
    deposit: rep.deposit,
    monthlyRent: rep.monthlyRent,
    presalePrice: rep.presalePrice,
    premium: rep.premium,
    count: list.length,
    title: rep.buildingName ?? rep.title ?? null,
  };
}

function markers(list: readonly MockListing[]): MapSearchResponse['markers'] {
  const byComplex = new Map<string, MockListing[]>();
  const byPoint = new Map<string, MockListing[]>();
  for (const l of list) {
    if (l.complexId && COMPLEX_ASSET_TYPES.includes(l.assetType)) {
      byComplex.set(l.complexId, [...(byComplex.get(l.complexId) ?? []), l]);
    } else {
      const key = `${l.lat},${l.lng}`;
      byPoint.set(key, [...(byPoint.get(key) ?? []), l]);
    }
  }
  return [
    ...[...byComplex].flatMap(([id, group]) => complexMarker(id, group) ?? []),
    ...[...byPoint.values()].map(listingMarker),
  ];
}

export function searchMap(
  all: readonly MockListing[],
  bbox: Bbox,
  zoom: number,
  filter: MockFilter,
): MapSearchResponse {
  const inView = all.filter(
    (l) =>
      inBbox(l, bbox) && (!filter.assetTypes?.length || filter.assetTypes.includes(l.assetType)),
  );
  const matched = inView.filter((l) => matchesFilter(l, filter));
  const kind = mapResultKindForZoom(zoom);
  const allMarkers = kind === MapResultKind.MARKERS ? markers(matched) : [];
  const sales = matched.filter(
    (l) => l.dealType === DealType.SALE || l.dealType === DealType.PRESALE,
  );
  const monthly = matched.filter((l) => l.dealType === DealType.MONTHLY);
  const perPyeong = avg(
    sales.flatMap((l) => {
      const area = filterArea(l);
      return area ? [headlinePrice(l) / (area / SQM_PER_PYEONG)] : [];
    }),
  );
  const avgRent = avg(monthly.flatMap((l) => (l.monthlyRent ? [l.monthlyRent] : [])));
  const avgDeposit = avg(monthly.flatMap((l) => (l.deposit ? [l.deposit] : [])));
  return {
    kind,
    clusters:
      kind === MapResultKind.REGION_CLUSTERS
        ? regionClusters(matched)
        : kind === MapResultKind.GRID_CLUSTERS
          ? gridClusters(matched, zoom)
          : [],
    markers: allMarkers.slice(0, MAP_MAX_MARKERS),
    total: matched.length,
    truncated: allMarkers.length > MAP_MAX_MARKERS,
    summary: {
      listingCount: inView.length,
      complexCount: new Set(inView.flatMap((l) => (l.complexId ? [l.complexId] : []))).size,
      avgPricePerPyeong: perPyeong === null ? null : Math.round(perPyeong / 10) * 10,
      avgDeposit: avgDeposit === null ? null : Math.round(avgDeposit / 10) * 10,
      avgMonthlyRent: avgRent === null ? null : Math.round(avgRent),
    },
  };
}

// ---- wire ---------------------------------------------------------------------------------------

function dealStats(list: readonly MockListing[]): DealTypeStatsMap {
  const out: DealTypeStatsMap = {};
  for (const dealType of DEAL_PRIORITY) {
    const group = list.filter((l) => l.dealType === dealType);
    if (group.length === 0) continue;
    const prices = group.map(headlinePrice);
    const rents = group.flatMap((l) => (typeof l.monthlyRent === 'number' ? [l.monthlyRent] : []));
    out[dealType] = {
      count: group.length,
      priceMin: Math.min(...prices),
      priceMax: Math.max(...prices),
      ...(dealType === DealType.MONTHLY && rents.length
        ? { rentMin: Math.min(...rents), rentMax: Math.max(...rents) }
        : {}),
    };
  }
  return out;
}

/**
 * `GET /map/search` in the backend wire shape (`MapSearchResult` of `@house/shared`): clusters
 * keyed by `key`, one complex marker per 단지 and ONE listing marker per listing (the client groups
 * listings of one building). Kind, clusters and totals come from `searchMap()`.
 */
export function searchMapWire(
  all: readonly MockListing[],
  bbox: Bbox,
  zoom: number,
  filter: MockFilter,
): MapSearchResult {
  const res = searchMap(all, bbox, zoom, filter);
  const matched = all.filter(
    (l) =>
      inBbox(l, bbox) &&
      (!filter.assetTypes?.length || filter.assetTypes.includes(l.assetType)) &&
      matchesFilter(l, filter),
  );
  const clusterOf = (c: MapCluster) =>
    matched.filter((l) => (c.regionCode ? l.emdCode === c.regionCode : false));
  const clusters = res.clusters.map((c) => ({
    key: c.id,
    regionCode: c.regionCode ?? null,
    name: c.name ?? null,
    lat: c.lat,
    lng: c.lng,
    count: c.count,
    byDealType: dealStats(clusterOf(c)),
  }));
  const complexes: MapSearchResult['complexes'] = [];
  const listings: MapSearchResult['listings'] = [];
  if (res.kind === MapResultKind.MARKERS) {
    const byComplex = new Map<string, MockListing[]>();
    for (const l of matched) {
      if (l.complexId && COMPLEX_ASSET_TYPES.includes(l.assetType)) {
        byComplex.set(l.complexId, [...(byComplex.get(l.complexId) ?? []), l]);
      } else {
        listings.push({
          id: l.id,
          dealType: l.dealType,
          assetType: l.assetType,
          lat: l.lat,
          lng: l.lng,
          salePrice: l.salePrice ?? null,
          deposit: l.deposit ?? null,
          monthlyRent: l.monthlyRent ?? null,
          presalePrice: l.presalePrice ?? null,
          premium: l.premium ?? null,
          priceSort: headlinePrice(l),
          exclusiveArea: l.exclusiveArea ?? null,
          floorClass: l.floorClass ?? null,
          rooms: l.rooms ?? null,
        });
      }
    }
    for (const [complexId, group] of byComplex) {
      const c = COMPLEX_SUMMARIES.find((x) => x.id === complexId);
      if (!c) continue;
      complexes.push({
        complexId,
        name: c.name,
        assetType: c.assetType,
        lat: c.lat,
        lng: c.lng,
        households: c.households ?? null,
        builtYear: c.builtYear ?? null,
        count: group.length,
        byDealType: dealStats(group),
      });
    }
  }
  const markerCount = complexes.length + listings.length;
  return {
    kind: res.kind,
    zoom,
    bbox,
    total: res.total,
    clusters,
    complexes: complexes.slice(0, MAP_MAX_MARKERS),
    listings: listings.slice(0, Math.max(0, MAP_MAX_MARKERS - complexes.length)),
    truncated: markerCount > MAP_MAX_MARKERS,
  };
}
