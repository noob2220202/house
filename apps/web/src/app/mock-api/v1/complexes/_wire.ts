import {
  DealType,
  sqmToPyeong,
  type ComplexDetail as WireComplexDetail,
  type ComplexListingsSummary,
  type ComplexStatsView,
  type ComplexSummary,
  type TradeDealType,
  type TradeStatPoint,
  type TradeView,
} from '@house/shared';
import type { TradeRecord } from '@/features/w-complex/api/schemas';
import { areaTypeIdOf, toComplexDetail, tradeDataOf, type MockComplexSpec } from './_fixtures';
import { listingsOfComplex, type MockListing } from './_listings';

/**
 * Backend wire shapes of the complexes module (`@house/shared` complexes types) built from the
 * w-complex fixtures. The routes answer with these; the frontend schemas map them back.
 */

const minMax = (values: number[]): [number | null, number | null] =>
  values.length ? [Math.min(...values), Math.max(...values)] : [null, null];

/** Fixture trade → `TradeView`. */
export function toTradeView(t: TradeRecord): TradeView {
  return {
    id: t.id,
    dealType: t.dealType,
    dealDate: t.dealDate,
    yearMonth: t.dealYm,
    exclusiveArea: t.exclusiveArea,
    exclusivePyeong: sqmToPyeong(t.exclusiveArea),
    areaTypeId: t.areaTypeId,
    floor: t.floor,
    price: t.price,
    deposit: t.deposit,
    monthlyRent: t.monthlyRent,
    cancelled: t.cancelled,
    cancelledAt: null,
    contractType: t.contractType,
  };
}

/** `ComplexListingsSummary` of the complex's active listings (count + price range per deal type). */
export function toListingsSummary(spec: MockComplexSpec): ComplexListingsSummary {
  const all: MockListing[] = listingsOfComplex(spec);
  const id = toComplexDetail(spec).id;
  return {
    complexId: id,
    total: all.length,
    byDealType: Object.values(DealType).flatMap((dealType) => {
      const group = all.filter((l) => l.dealType === dealType);
      if (group.length === 0) return [];
      const [minPrice, maxPrice] = minMax(
        group.flatMap((l) => [l.priceSort, l.priceMax ?? l.priceSort]),
      );
      const [minMonthlyRent, maxMonthlyRent] = minMax(
        group.flatMap((l) => (l.monthlyRent === null ? [] : [l.monthlyRent])),
      );
      return [{ dealType, count: group.length, minPrice, maxPrice, minMonthlyRent, maxMonthlyRent }];
    }),
  };
}

/** `ComplexSummary` (list rows, popular, favourites). */
export function toComplexSummaryOf(spec: MockComplexSpec): ComplexSummary {
  const d = toComplexDetail(spec);
  return {
    id: d.id,
    name: d.name,
    assetType: d.assetType,
    roadAddress: d.roadAddress,
    jibunAddress: d.jibunAddress,
    sggCode: d.sggCode,
    emdCode: d.emdCode,
    emdName: d.emdName,
    lat: d.lat,
    lng: d.lng,
    households: d.households,
    buildings: d.buildings,
    builtYear: d.builtYear,
    approvalDate: d.approvalDate,
    activeListingCount: d.activeListingCount,
    favoriteCount: d.favoriteCount,
    viewCount: d.viewCount,
  };
}

/** `GET /complexes/:id` → `ComplexDetail`. */
export function toComplexDetailWire(spec: MockComplexSpec): WireComplexDetail {
  const d = toComplexDetail(spec);
  return {
    ...toComplexSummaryOf(spec),
    floorsMin: d.floorsMin,
    floorsMax: d.floorsMax,
    approvalYear: d.approvalDate ? Number(d.approvalDate.slice(0, 4)) : null,
    parkingTotal: d.parkingTotal,
    parkingPerHousehold: d.parkingPerHousehold,
    floorAreaRatio: d.floorAreaRatio,
    buildingCoverageRatio: d.buildingCoverageRatio,
    heatingType: d.heatingType,
    builder: d.builder,
    region: d.emdCode ? { code: d.emdCode, name: d.emdName ?? '', fullName: d.emdName ?? '' } : null,
    areaTypes: d.areaTypes.map((a) => ({
      id: a.id,
      exclusiveArea: a.exclusiveArea,
      supplyArea: a.supplyArea,
      exclusivePyeong: sqmToPyeong(a.exclusiveArea),
      supplyPyeong: a.supplyArea === null ? null : sqmToPyeong(a.supplyArea),
      typeName: a.typeName,
      pyeongLabel: a.pyeongLabel ?? `${Math.round(sqmToPyeong(a.supplyArea ?? a.exclusiveArea))}평`,
      households: a.households,
      rooms: a.rooms,
      baths: a.baths,
    })),
    // No media server in mock mode → the UI shows the branded placeholder.
    photos: [],
    latestTrades: tradeDataOf(spec).latest.map(toTradeView),
    listingSummary: toListingsSummary(spec),
    isFavorite: false,
  };
}

/**
 * `GET /complexes/:id/stats?dealType&areaTypeId&months` → `ComplexStatsView`: with `areaTypeId`
 * only that 평형's series (and `overall` empty), otherwise every series plus `overall`.
 */
export function toStatsView(
  spec: MockComplexSpec,
  dealType: TradeDealType,
  areaTypeId: string | null,
  months: number,
): ComplexStatsView {
  const { monthly, latest } = tradeDataOf(spec);
  const rows = monthly.filter((m) => m.dealType === dealType);
  const toYm = rows.length ? Math.max(...rows.map((m) => m.yearMonth)) : null;
  const fromYm = toYm === null ? null : ymAdd(toYm, -(months - 1));
  const inWindow = rows.filter(
    (m) => fromYm !== null && toYm !== null && m.yearMonth >= fromYm && m.yearMonth <= toYm,
  );
  const point = (m: (typeof rows)[number]): TradeStatPoint => ({
    yearMonth: m.yearMonth,
    tradeCount: m.tradeCount,
    medianPrice: m.medianPrice,
    minPrice: m.minPrice ?? m.medianPrice,
    maxPrice: m.maxPrice ?? m.medianPrice,
    avgPrice: m.avgPrice ?? m.medianPrice,
    medianMonthlyRent: m.medianMonthlyRent,
  });
  const areas = spec.areas.filter((a) => !areaTypeId || areaTypeIdOf(spec.code, a) === areaTypeId);
  const series = areas.flatMap((a) => {
    const id = areaTypeIdOf(spec.code, a);
    const points = inWindow.filter((m) => m.areaTypeId === id).map(point);
    return points.length
      ? [
          {
            exclusiveArea: a.exclusive,
            exclusivePyeong: sqmToPyeong(a.exclusive),
            areaTypeId: id,
            pyeongLabel: `${a.pyeong}평`,
            points,
          },
        ]
      : [];
  });
  const overall: TradeStatPoint[] = areaTypeId ? [] : overallOf(inWindow.map(point));
  const latestOfDeal = latest.filter(
    (t) => t.dealType === dealType && (!areaTypeId || t.areaTypeId === areaTypeId),
  );
  return {
    complexId: toComplexDetail(spec).id,
    dealType,
    fromYm,
    toYm,
    series,
    overall,
    latest: latestOfDeal.map(toTradeView),
  };
}

function ymAdd(ym: number, delta: number): number {
  const total = Math.floor(ym / 100) * 12 + ((ym % 100) - 1) + delta;
  return Math.floor(total / 12) * 100 + (total % 12) + 1;
}

/** Monthly aggregate across 평형: trade-weighted median approximation (mock only). */
function overallOf(points: TradeStatPoint[]): TradeStatPoint[] {
  const byMonth = new Map<number, TradeStatPoint[]>();
  for (const p of points) byMonth.set(p.yearMonth, [...(byMonth.get(p.yearMonth) ?? []), p]);
  return [...byMonth.entries()]
    .sort(([a], [b]) => a - b)
    .map(([yearMonth, ps]) => {
      const count = ps.reduce((n, p) => n + p.tradeCount, 0);
      const sorted = ps.map((p) => p.medianPrice).sort((a, b) => a - b);
      return {
        yearMonth,
        tradeCount: count,
        medianPrice: sorted[Math.floor(sorted.length / 2)] ?? 0,
        minPrice: Math.min(...ps.map((p) => p.minPrice)),
        maxPrice: Math.max(...ps.map((p) => p.maxPrice)),
        avgPrice: Math.round(ps.reduce((n, p) => n + p.avgPrice * p.tradeCount, 0) / count),
        medianMonthlyRent: ps[0]?.medianMonthlyRent ?? null,
      };
    });
}
