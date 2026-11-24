import { SQM_PER_PYEONG, addMonths, normalizeEmdName, type RegionView } from '@house/shared';
import type { SeoJeonseSummary, SeoSaleSummary } from './seo.types';

/** 읍면동 rows may be stored with 10 digits ending in 00 (Kakao bcode); the key is 8 digits. */
export function regionKeyOf(code: string | null | undefined): string | null {
  if (!code || !/^\d{8}(\d{2})?$/.test(code)) return null;
  return code.length === 10 && code.endsWith('00') ? code.slice(0, 8) : code;
}

export interface RegionEntry {
  code: string;
  name: string;
  emdName: string;
  parentName: string | null;
  lat: number | null;
  lng: number | null;
  /** 법정동코드 order. */
  order: number;
}

/** Indexes the 읍면동 / 리 rows of the service 시군구 by region key (the 8-digit row wins). */
export function buildRegionIndex(regions: readonly RegionView[]): Map<string, RegionEntry> {
  const byCode = new Map(regions.map((r) => [r.code, r]));
  const out = new Map<string, RegionEntry>();
  regions.forEach((r, i) => {
    if (r.level !== 'EMD' && r.level !== 'RI') return;
    const key = regionKeyOf(r.code);
    if (!key || (out.has(key) && key !== r.code)) return;
    const parent = r.level === 'RI' && r.parentCode ? byCode.get(r.parentCode) : undefined;
    out.set(key, {
      code: key,
      name: r.name,
      emdName: parent ? `${parent.name} ${r.name}` : r.name,
      parentName: parent?.name ?? null,
      lat: r.lat,
      lng: r.lng,
      order: i,
    });
  });
  return out;
}

/**
 * Resolves a 국토교통부 법정동 name ("신대리", "해룡면 신대리", "연향동") to a region key. A bare 리
 * name shared by two 읍·면 is ambiguous and resolves to null (never guess).
 */
export function regionNameResolver(
  index: ReadonlyMap<string, RegionEntry>,
): (emdName: string | null | undefined) => string | null {
  const full = new Map<string, string>();
  const short = new Map<string, string | null>();
  for (const r of index.values()) {
    full.set(r.emdName.replace(/\s+/g, ''), r.code);
    const n = normalizeEmdName(r.name);
    if (!n) continue;
    short.set(n, short.has(n) && short.get(n) !== r.code ? null : r.code);
  }
  const parents = new Set([...index.values()].flatMap((r) => (r.parentName ? [r.parentName] : [])));
  return (emdName) => {
    const raw = emdName?.trim();
    if (!raw) return null;
    const exact = full.get(raw.replace(/\s+/g, ''));
    if (exact) return exact;
    const tokens = raw.split(/\s+/);
    // "해룡면 X리" under a known 읍·면 without such a 리: unknown — never another 읍·면's 리.
    if (tokens.length > 1 && parents.has(tokens[0]!)) return null;
    return short.get(normalizeEmdName(raw) ?? '') ?? null;
  };
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

const mean = (values: readonly number[]): number | null =>
  values.length === 0 ? null : Math.round(values.reduce((a, b) => a + b, 0) / values.length);

export interface SaleRow {
  /** 거래금액 (만원) */
  price: number;
  /** 전용면적 ㎡ */
  exclusiveArea: number;
}

/** Count, mean, median, range and 전용 평당가 of non-cancelled 매매 rows. */
export function summarizeSales(rows: readonly SaleRow[]): SeoSaleSummary {
  const valid = rows.filter((r) => Number.isFinite(r.price) && r.price > 0);
  const prices = valid.map((r) => r.price);
  const perPyeong = valid
    .filter((r) => r.exclusiveArea > 0)
    .map((r) => r.price / (r.exclusiveArea / SQM_PER_PYEONG));
  return {
    count: valid.length,
    avgPrice: mean(prices),
    medianPrice: median(prices),
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    avgPricePerPyeong: mean(perPyeong),
  };
}

export function summarizeDeposits(deposits: readonly number[]): SeoJeonseSummary {
  const valid = deposits.filter((d) => Number.isFinite(d) && d > 0);
  return { count: valid.length, avgDeposit: mean(valid), medianDeposit: median(valid) };
}

/** The last 12 KST months including the current one. */
export function tradeWindow(currentYm: number): { fromYm: number; toYm: number } {
  return { fromYm: addMonths(currentYm, -11), toYm: currentYm };
}

/**
 * Month the report shows by default: the newest month before the current KST month that has
 * trades (the current month is still being reported — 신고 기한 30일), else the newest month.
 */
export function latestReportMonth(available: readonly number[], currentYm: number): number | null {
  const sorted = [...available].sort((a, b) => b - a);
  return sorted.find((ym) => ym < currentYm) ?? sorted[0] ?? null;
}

export interface ReportTradeRow extends SaleRow {
  emdName: string | null;
  /** Region key of the matched 단지 (more reliable than the reported 법정동 name). */
  complexRegionKey: string | null;
  complexId: string | null;
  complexName: string | null;
  aptName: string;
}

/** Groups a month's 매매 rows per 법정동 (matched 단지 region first, else the reported name). */
export function groupByRegion(
  rows: readonly ReportTradeRow[],
  index: ReadonlyMap<string, RegionEntry>,
  resolve: (emdName: string | null) => string | null,
): { regionCode: string | null; name: string; rows: ReportTradeRow[] }[] {
  const groups = new Map<
    string,
    { regionCode: string | null; name: string; rows: ReportTradeRow[] }
  >();
  for (const row of rows) {
    const key = row.complexRegionKey ?? resolve(row.emdName);
    const entry = key ? index.get(key) : undefined;
    const id = entry ? `k:${entry.code}` : `n:${row.emdName?.trim() || '-'}`;
    const group = groups.get(id) ?? {
      regionCode: entry?.code ?? null,
      name: entry?.emdName ?? (row.emdName?.trim() || '법정동 미상'),
      rows: [],
    };
    group.rows.push(row);
    groups.set(id, group);
  }
  // Most trades first; ties: known 지역 in 법정동코드 order, then unresolved names.
  const rank = (g: { regionCode: string | null }) =>
    g.regionCode ? (index.get(g.regionCode)?.order ?? 0) : Number.MAX_SAFE_INTEGER;
  return [...groups.values()].sort(
    (a, b) =>
      b.rows.length - a.rows.length || rank(a) - rank(b) || a.name.localeCompare(b.name, 'ko'),
  );
}

/** 단지 with the most trades (matched 단지 id, else the reported 단지명 + 법정동). */
export function topComplexes(
  rows: readonly ReportTradeRow[],
  limit: number,
): { complexId: string | null; name: string; emdName: string | null; prices: number[] }[] {
  const groups = new Map<
    string,
    { complexId: string | null; name: string; emdName: string | null; prices: number[] }
  >();
  for (const r of rows) {
    const id = r.complexId ?? `${r.emdName ?? ''}/${r.aptName}`;
    const g = groups.get(id) ?? {
      complexId: r.complexId,
      name: r.complexName ?? r.aptName,
      emdName: r.emdName,
      prices: [],
    };
    g.prices.push(r.price);
    groups.set(id, g);
  }
  return [...groups.values()]
    .sort((a, b) => b.prices.length - a.prices.length || a.name.localeCompare(b.name, 'ko'))
    .slice(0, limit);
}
