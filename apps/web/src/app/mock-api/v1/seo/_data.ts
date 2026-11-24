import {
  AssetType,
  DEFAULT_SGG_CODE,
  DealType,
  SQM_PER_PYEONG,
  addMonths,
  enumValues,
  yearMonthOf,
} from '@house/shared';
import { mockUuid } from '@/lib/mock';
import type {
  SeoComplexItem,
  SeoDealSummary,
  SeoRegion,
  SeoRegionIndex,
  SeoRegionLanding,
  SeoSaleSummary,
  SeoTradeReport,
} from '@/lib/seo/schemas';
import { OFFICES } from '../agencies/_offices';
import { agencyIdOf } from '../agencies/_fixtures';
import { COMPLEX_SPECS, complexIdOf, tradeDataOf } from '../complexes/_fixtures';
import { LISTINGS, REGIONS } from '../map/_fixtures';

/*
 * Mock of the apps/api seo module (`apps/api/src/modules/seo`): the same shapes, computed from
 * the map / complexes / agencies fixtures so landing pages, sitemaps and the report show the
 * numbers the other mock pages show. Fixture "today" is 2026-11-23.
 */

const ASSET_TYPES = enumValues(AssetType);
const COMPLEX_TYPES: AssetType[] = [AssetType.APT, AssetType.OFFICETEL];
const DEAL_ORDER: DealType[] = [DealType.PRESALE, DealType.SALE, DealType.JEONSE, DealType.MONTHLY];
const FIXTURE_NOW = new Date('2026-11-23T12:00:00+09:00');
const UPDATED_AT = FIXTURE_NOW.toISOString();
const CURRENT_YM = yearMonthOf(FIXTURE_NOW);
export const TRADE_WINDOW = { fromYm: addMonths(CURRENT_YM, -11), toYm: CURRENT_YM };

/** A mock listing that was published and then closed (exercises the gone-listing redirect). */
export const MOCK_CLOSED_LISTING_ID = mockUuid('L-closed-1');

const regionKeyOf = (code: string | null | undefined): string | null => {
  if (!code || !/^\d{8}(\d{2})?$/.test(code)) return null;
  return code.length === 10 && code.endsWith('00') ? code.slice(0, 8) : code;
};

interface MockRegionEntry {
  code: string;
  name: string;
  emdName: string;
  parentName: string | null;
  lat: number;
  lng: number;
}

/** The map fixture names 리 after their 지구 ("신대지구"); the 법정동 label uses 리. */
const REGION_ENTRIES: MockRegionEntry[] = REGIONS.map((r) => {
  const name = r.parentName ? r.name.replace('지구', '리') : r.name;
  return {
    code: regionKeyOf(r.code) ?? r.code,
    name,
    emdName: r.parentName ? `${r.parentName} ${name}` : name,
    parentName: r.parentName ?? null,
    lat: r.lat,
    lng: r.lng,
  };
});

const inRegion = (key: string | null, target: string) =>
  !!key && (target.length === 8 ? key.startsWith(target) : key === target);

const median = (values: readonly number[]): number | null => {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2
    ? (s[mid] as number)
    : Math.round(((s[mid - 1] as number) + (s[mid] as number)) / 2);
};
const mean = (values: readonly number[]) =>
  values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

function summarizeSales(rows: readonly { price: number; exclusiveArea: number }[]): SeoSaleSummary {
  const prices = rows.map((r) => r.price);
  return {
    count: rows.length,
    avgPrice: mean(prices),
    medianPrice: median(prices),
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    avgPricePerPyeong: mean(
      rows
        .filter((r) => r.exclusiveArea > 0)
        .map((r) => r.price / (r.exclusiveArea / SQM_PER_PYEONG)),
    ),
  };
}

interface MockTrade {
  complexId: string;
  complexName: string;
  emdName: string;
  regionKey: string | null;
  dealType: 'SALE' | 'JEONSE' | 'MONTHLY';
  dealDate: string;
  dealYm: number;
  exclusiveArea: number;
  floor: number | null;
  price: number | null;
  deposit: number | null;
}

const TRADES: MockTrade[] = COMPLEX_SPECS.flatMap((spec) =>
  tradeDataOf(spec)
    .trades.filter((t) => !t.cancelled)
    .map((t) => ({
      complexId: complexIdOf(spec.code),
      complexName: spec.name,
      emdName: spec.emdName,
      regionKey: regionKeyOf(spec.emdCode),
      dealType: t.dealType,
      dealDate: t.dealDate,
      dealYm: t.dealYm,
      exclusiveArea: t.exclusiveArea,
      floor: t.floor,
      price: t.price,
      deposit: t.deposit,
    })),
);

const PUBLIC_LISTINGS = LISTINGS.filter((l) => l.status === 'ACTIVE' || l.status === 'RESERVED');

function regionView(entry: MockRegionEntry): SeoRegion {
  const own = (key: string | null) => inRegion(key, entry.code);
  const listingCounts = Object.fromEntries(ASSET_TYPES.map((t) => [t, 0])) as Record<
    AssetType,
    number
  >;
  for (const l of PUBLIC_LISTINGS) if (own(regionKeyOf(l.emdCode))) listingCounts[l.assetType] += 1;
  return {
    ...entry,
    listingCounts,
    complexCount: COMPLEX_SPECS.filter((c) => own(regionKeyOf(c.emdCode))).length,
    saleTradeCount: TRADES.filter(
      (t) =>
        own(t.regionKey) &&
        t.dealType === 'SALE' &&
        t.dealYm >= TRADE_WINDOW.fromYm &&
        t.dealYm <= TRADE_WINDOW.toYm,
    ).length,
    lastModified: UPDATED_AT,
  };
}

export function mockRegionIndex(): SeoRegionIndex {
  return {
    sggCode: DEFAULT_SGG_CODE,
    regionName: '순천시',
    tradePeriod: TRADE_WINDOW,
    regions: REGION_ENTRIES.map(regionView).filter(
      (r) =>
        r.complexCount > 0 ||
        r.saleTradeCount > 0 ||
        Object.values(r.listingCounts).some((n) => n > 0),
    ),
    updatedAt: UPDATED_AT,
  };
}

export function mockRegionLanding(
  code: string,
  assetTypes: readonly AssetType[],
): SeoRegionLanding | null {
  const key = regionKeyOf(code) ?? code;
  const entry = REGION_ENTRIES.find((r) => r.code === key);
  if (!entry) return null;
  const types = assetTypes.length ? [...new Set(assetTypes)].sort() : [...ASSET_TYPES];
  const listings = PUBLIC_LISTINGS.filter(
    (l) => inRegion(regionKeyOf(l.emdCode), key) && types.includes(l.assetType),
  );
  const byDealType: SeoDealSummary[] = DEAL_ORDER.flatMap((dealType) => {
    const rows = listings.filter((l) => l.dealType === dealType);
    if (!rows.length) return [];
    const prices = rows.map((l) => l.priceSort ?? 0).filter((p) => p > 0);
    const rents = rows.flatMap((l) =>
      dealType === DealType.MONTHLY && l.monthlyRent ? [l.monthlyRent] : [],
    );
    return [
      {
        dealType,
        count: rows.length,
        minPrice: prices.length ? Math.min(...prices) : null,
        maxPrice: prices.length ? Math.max(...prices) : null,
        avgPrice: mean(prices),
        minRent: rents.length ? Math.min(...rents) : null,
        maxRent: rents.length ? Math.max(...rents) : null,
      },
    ];
  });
  const complexTypes = types.filter((t) => COMPLEX_TYPES.includes(t));
  const specs = complexTypes.length
    ? COMPLEX_SPECS.filter((c) => inRegion(regionKeyOf(c.emdCode), key))
    : [];
  const complexes: SeoComplexItem[] = specs
    .map((spec) => {
      const id = complexIdOf(spec.code);
      const sale = TRADES.find((t) => t.complexId === id && t.dealType === 'SALE' && t.price);
      return {
        id,
        name: spec.name,
        assetType: AssetType.APT,
        households: spec.households,
        builtYear: spec.builtYear,
        approvalDate: spec.approvalDate,
        activeListingCount: spec.counts.reduce((a, b) => a + b, 0),
        latestSale: sale
          ? {
              price: sale.price as number,
              dealDate: sale.dealDate,
              exclusiveArea: sale.exclusiveArea,
              floor: sale.floor,
            }
          : null,
      };
    })
    .sort(
      (a, b) =>
        b.activeListingCount - a.activeListingCount || (b.households ?? 0) - (a.households ?? 0),
    );
  const own = TRADES.filter(
    (t) =>
      inRegion(t.regionKey, key) &&
      t.dealYm >= TRADE_WINDOW.fromYm &&
      t.dealYm <= TRADE_WINDOW.toYm,
  );
  const sales = own.filter((t) => t.dealType === 'SALE' && t.price);
  const deposits = own
    .filter((t) => t.dealType === 'JEONSE' && t.deposit)
    .map((t) => t.deposit as number);
  return {
    region: regionView(entry),
    assetTypes: types,
    listings: {
      total: listings.length,
      byDealType,
      lastPublishedAt:
        listings
          .map((l) => l.publishedAt ?? '')
          .sort()
          .pop() || null,
    },
    complexes,
    complexTotal: specs.length,
    trades: types.includes(AssetType.APT)
      ? {
          ...TRADE_WINDOW,
          sale: summarizeSales(
            sales.map((t) => ({ price: t.price as number, exclusiveArea: t.exclusiveArea })),
          ),
          jeonse: {
            count: deposits.length,
            avgDeposit: mean(deposits),
            medianDeposit: median(deposits),
          },
          recent: [...sales]
            .sort((a, b) => (a.dealDate < b.dealDate ? 1 : -1))
            .slice(0, 10)
            .map((t) => ({
              dealDate: t.dealDate,
              complexId: t.complexId,
              aptName: t.complexName,
              exclusiveArea: t.exclusiveArea,
              floor: t.floor,
              price: t.price as number,
            })),
        }
      : null,
    updatedAt: UPDATED_AT,
  };
}

export function mockTradeReport(ym: number | undefined): SeoTradeReport | null {
  const saleTrades = TRADES.filter((t) => t.dealType === 'SALE' && t.price);
  const months = [...new Set(saleTrades.map((t) => t.dealYm))].sort((a, b) => b - a).slice(0, 36);
  const latest = months.find((m) => m < CURRENT_YM) ?? months[0];
  const target = ym ?? latest;
  if (target === undefined || latest === undefined || !months.includes(target)) return null;
  const rowsOf = (m: number) => saleTrades.filter((t) => t.dealYm === m);
  const summary = (m: number) => {
    const rows = rowsOf(m);
    return rows.length
      ? summarizeSales(
          rows.map((t) => ({ price: t.price as number, exclusiveArea: t.exclusiveArea })),
        )
      : null;
  };
  const rows = rowsOf(target);
  const regions = new Map<string, MockTrade[]>();
  for (const t of rows)
    regions.set(t.regionKey ?? t.emdName, [...(regions.get(t.regionKey ?? t.emdName) ?? []), t]);
  const complexes = new Map<string, MockTrade[]>();
  for (const t of rows) complexes.set(t.complexId, [...(complexes.get(t.complexId) ?? []), t]);
  const deposits = TRADES.filter(
    (t) => t.dealYm === target && t.dealType === 'JEONSE' && t.deposit,
  ).map((t) => t.deposit as number);
  const prev = addMonths(target, -1);
  const yearAgo = addMonths(target, -12);
  const prevSummary = summary(prev);
  const yearAgoSummary = summary(yearAgo);
  return {
    sggCode: DEFAULT_SGG_CODE,
    regionName: '순천시',
    yearMonth: target,
    latestYearMonth: latest,
    availableMonths: months,
    sale: {
      ...summarizeSales(
        rows.map((t) => ({ price: t.price as number, exclusiveArea: t.exclusiveArea })),
      ),
      cancelledCount: 0,
    },
    jeonse: { count: deposits.length, avgDeposit: mean(deposits), medianDeposit: median(deposits) },
    previous: prevSummary ? { yearMonth: prev, sale: prevSummary } : null,
    yearAgo: yearAgoSummary ? { yearMonth: yearAgo, sale: yearAgoSummary } : null,
    byRegion: [...regions.entries()]
      .map(([key, list]) => {
        const entry = REGION_ENTRIES.find((r) => r.code === key);
        return {
          regionCode: entry?.code ?? null,
          name: entry?.emdName ?? list[0]?.emdName ?? key,
          sale: summarizeSales(
            list.map((t) => ({ price: t.price as number, exclusiveArea: t.exclusiveArea })),
          ),
        };
      })
      .sort((a, b) => b.sale.count - a.sale.count),
    topComplexes: [...complexes.values()]
      .map((list) => ({
        complexId: list[0]?.complexId ?? null,
        name: list[0]?.complexName ?? '',
        emdName: list[0]?.emdName ?? null,
        count: list.length,
        medianPrice: median(list.map((t) => t.price as number)),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    syncedAt: '2026-11-16T04:20:00+09:00',
    updatedAt: UPDATED_AT,
  };
}

export function mockSitemapRows(kind: 'complexes' | 'listings' | 'agencies') {
  const ids =
    kind === 'complexes'
      ? COMPLEX_SPECS.map((c) => complexIdOf(c.code))
      : kind === 'listings'
        ? PUBLIC_LISTINGS.map((l) => l.id)
        : OFFICES.map((o) => agencyIdOf(o.key));
  return {
    kind,
    items: [...new Set(ids)].map((id) => ({ id, lastModified: UPDATED_AT })),
    truncated: false,
  };
}

export function mockListingStatus(id: string) {
  if (id === MOCK_CLOSED_LISTING_ID) {
    const spec = COMPLEX_SPECS[0];
    return {
      id,
      state: 'GONE' as const,
      status: 'CLOSED' as const,
      assetType: AssetType.APT,
      complexId: spec ? complexIdOf(spec.code) : null,
      regionCode: spec ? regionKeyOf(spec.emdCode) : null,
      endedAt: '2026-11-20T09:00:00+09:00',
    };
  }
  const live = PUBLIC_LISTINGS.find((l) => l.id === id);
  if (!live) return null;
  return {
    id,
    state: 'PUBLIC' as const,
    status: live.status,
    assetType: live.assetType,
    complexId: live.complexId ?? null,
    regionCode: regionKeyOf(live.emdCode),
    endedAt: null,
  };
}
