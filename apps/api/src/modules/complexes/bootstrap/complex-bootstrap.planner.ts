import {
  canonicalAptSeq,
  complexNameVariants,
  ComplexDataSource,
  normalizeComplexName,
  normalizeEmdName,
  normalizeJibun,
  normalizeRegionCode,
  parseJibunAddress,
  TradeSyncKind,
  type ComplexBootstrapAction,
  type ComplexBootstrapItem,
} from '@house/shared';
import type { RawTradeItem } from '../trade-sync/trade-api.client';
import { normalizeTradeItem } from '../trade-sync/trade-normalizer';

/**
 * Pure part of the 단지 bootstrap (ComplexBootstrapService): 실거래 rows → per-month aggregates →
 * one candidate per 단지 (canonical aptSeq) → a plan against the existing 단지. No I/O here, so
 * every rule is unit-tested with fixture payloads.
 */

/** Consecutive distinct 전용면적 closer than this (㎡) are one 평형 (84.97 / 84.98 rounding noise). */
export const AREA_CLUSTER_GAP_SQM = 0.1;
/** At most this many 평형 per bootstrapped 단지 (the most traded ones). */
export const MAX_AREA_TYPES = 30;
const MIN_BUILD_YEAR = 1900;
const MAX_BUILD_YEAR = 2100;

// ---------- regions ----------

export interface RegionRef {
  /** 8 digits (읍면동) or 10 digits (리). */
  code: string;
  name: string;
  level: 'EMD' | 'RI';
  /** The 읍면 of a 리; the 시군구 of a 읍면동. */
  parentCode: string;
}

/** The verified 법정동 list of the service 시군구, looked up by code or by name. */
export class RegionIndex {
  private readonly byCode: ReadonlyMap<string, RegionRef>;

  constructor(
    readonly sggCode: string,
    /** "순천시" — first token of the addresses the bootstrap writes. */
    readonly sggName: string,
    regions: readonly RegionRef[],
  ) {
    this.byCode = new Map(regions.map((r) => [r.code, r]));
  }

  get(code: string): RegionRef | undefined {
    return this.byCode.get(normalizeRegionCode(code));
  }

  /** "조례동", "해룡면 신대리", or a 리 name unique in the 시군구 ("신대리"); undefined otherwise. */
  findByName(name: string): RegionRef | undefined {
    const parts = name.normalize('NFKC').trim().split(/\s+/).filter(Boolean);
    const leaf = parts.at(-1);
    if (!leaf) return undefined;
    const parentName = parts.length > 1 ? parts.at(-2) : undefined;
    const hits = [...this.byCode.values()].filter(
      (r) =>
        r.name === leaf &&
        (parentName === undefined || this.byCode.get(r.parentCode)?.name === parentName),
    );
    return hits.length === 1 ? hits[0] : undefined;
  }

  /**
   * 읍면동 a 단지 is filed under (8 digits) and its label: a 리 belongs to its 읍면 and reads
   * "해룡면 신대리"; a 동 is itself.
   */
  placeOf(r: RegionRef): { emdCode: string; label: string } | null {
    if (r.level === 'EMD') return { emdCode: r.code, label: r.name };
    const parent = this.byCode.get(r.parentCode);
    return parent ? { emdCode: parent.code, label: `${parent.name} ${r.name}` } : null;
  }
}

// ---------- aggregation ----------

type Counts = Record<string, number>;

/** Everything one 단지's rows of a period say about it (JSON-safe: cached per month in Redis). */
export interface GroupAgg {
  key: string;
  /** Canonical aptSeq (12150-…), null for rows without one. */
  aptSeq: string | null;
  names: Counts;
  /** `${umdCd}|${umdNm}` → rows (umdCd may be empty). */
  emds: Counts;
  /** Normalized 지번. */
  jibuns: Counts;
  /** "연향번영길 100". */
  roads: Counts;
  years: Counts;
  /** 전용면적 (2 decimals). */
  areas: Counts;
  sale: number;
  rent: number;
}

export interface MonthAggregate {
  kind: TradeSyncKind;
  yearMonth: number;
  /** Valid rows aggregated. */
  rows: number;
  /** Rows dropped by the normalizer (no name, bad area / date / price). */
  invalid: number;
  groups: GroupAgg[];
}

function inc(c: Counts, key: string | null | undefined, n = 1): void {
  if (!key) return;
  c[key] = (c[key] ?? 0) + n;
}

function rawField(raw: RawTradeItem, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = raw[k]?.trim();
    if (v && v !== '-') return v;
  }
  return undefined;
}

/** roadNm + roadNmBonbun/roadNmBubun ("00100"/"00000") → "연향번영길 100"; null when absent. */
export function roadAddressOf(raw: RawTradeItem): string | null {
  const road = rawField(raw, 'roadNm', '도로명');
  if (!road) return null;
  const bon = Number(rawField(raw, 'roadNmBonbun', '도로명건물본번호코드') ?? '');
  const bu = Number(rawField(raw, 'roadNmBubun', '도로명건물부번호코드') ?? '');
  if (!Number.isInteger(bon) || bon <= 0) return null;
  return `${road} ${bon}${Number.isInteger(bu) && bu > 0 ? `-${bu}` : ''}`;
}

function fallbackKey(emdName: string | null, aptName: string, jibun: string | null): string {
  return `x:${normalizeEmdName(emdName) ?? ''}|${normalizeComplexName(aptName)}|${jibun ?? ''}`;
}

function emptyGroup(key: string, aptSeq: string | null): GroupAgg {
  return {
    key,
    aptSeq,
    names: {},
    emds: {},
    jibuns: {},
    roads: {},
    years: {},
    areas: {},
    sale: 0,
    rent: 0,
  };
}

/** One month of one API (매매 or 전월세) → rows grouped by canonical aptSeq. */
export function aggregateMonth(
  kind: TradeSyncKind,
  yearMonth: number,
  items: readonly RawTradeItem[],
  sggCode: string,
): MonthAggregate {
  const groups = new Map<string, GroupAgg>();
  let rows = 0;
  let invalid = 0;
  for (const raw of items) {
    const r = normalizeTradeItem(kind, raw, sggCode);
    if (!r.ok) {
      invalid += 1;
      continue;
    }
    const t = r.trade;
    // Rows of another 시군구 (never expected under our LAWD_CD) are not ours to create.
    if (t.sggCode !== sggCode) {
      invalid += 1;
      continue;
    }
    rows += 1;
    const key = t.aptSeq ? `s:${t.aptSeq}` : fallbackKey(t.emdName, t.aptName, t.jibun);
    let g = groups.get(key);
    if (!g) {
      g = emptyGroup(key, t.aptSeq);
      groups.set(key, g);
    }
    inc(g.names, t.aptName.trim());
    const umdCd = rawField(raw, 'umdCd') ?? '';
    inc(g.emds, `${/^\d{5}$/.test(umdCd) ? umdCd : ''}|${t.emdName ?? ''}`);
    inc(g.jibuns, t.jibun);
    inc(g.roads, roadAddressOf(raw));
    if (t.builtYear && t.builtYear >= MIN_BUILD_YEAR && t.builtYear <= MAX_BUILD_YEAR) {
      inc(g.years, String(t.builtYear));
    }
    inc(g.areas, t.exclusiveArea.toFixed(2));
    if (kind === TradeSyncKind.APT_TRADE) g.sale += 1;
    else g.rent += 1;
  }
  return { kind, yearMonth, rows, invalid, groups: [...groups.values()] };
}

function addCounts(into: Counts, from: Counts): void {
  for (const [k, n] of Object.entries(from)) inc(into, k, n);
}

function mergeGroup(into: GroupAgg, from: GroupAgg): void {
  addCounts(into.names, from.names);
  addCounts(into.emds, from.emds);
  addCounts(into.jibuns, from.jibuns);
  addCounts(into.roads, from.roads);
  addCounts(into.years, from.years);
  addCounts(into.areas, from.areas);
  into.sale += from.sale;
  into.rent += from.rent;
}

/** Most frequent key; ties → the longer, then the lexically smaller one (deterministic). */
export function mostFrequent(c: Counts): string | null {
  let best: [string, number] | null = null;
  for (const entry of Object.entries(c)) {
    if (
      !best ||
      entry[1] > best[1] ||
      (entry[1] === best[1] &&
        (entry[0].length > best[0].length ||
          (entry[0].length === best[0].length && entry[0] < best[0])))
    ) {
      best = entry;
    }
  }
  return best?.[0] ?? null;
}

function emdNameOfGroup(g: GroupAgg): string | null {
  const top = mostFrequent(g.emds);
  return top ? top.split('|')[1] || null : null;
}

/**
 * Merges the months into one group per 단지. Rows without an aptSeq (older or 전월세 rows) join
 * the aptSeq group with the same 법정동 + 지번 (or, without a 지번, the same name) when exactly one
 * fits; the rest stay groups of their own. Returns the ambiguous ones separately.
 */
export function mergeMonths(months: readonly MonthAggregate[]): {
  groups: GroupAgg[];
  ambiguous: GroupAgg[];
} {
  const all = new Map<string, GroupAgg>();
  for (const m of months) {
    for (const g of m.groups) {
      const into = all.get(g.key);
      if (into) mergeGroup(into, g);
      else {
        const copy = emptyGroup(g.key, g.aptSeq);
        mergeGroup(copy, g);
        all.set(g.key, copy);
      }
    }
  }
  const withSeq = [...all.values()].filter((g) => g.aptSeq);
  const byEmdJibun = new Map<string, GroupAgg[]>();
  const byEmdName = new Map<string, GroupAgg[]>();
  const push = (m: Map<string, GroupAgg[]>, k: string, g: GroupAgg) => {
    const list = m.get(k);
    if (list) {
      if (!list.includes(g)) list.push(g);
    } else m.set(k, [g]);
  };
  for (const g of withSeq) {
    for (const emdKey of Object.keys(g.emds)) {
      const emd = normalizeEmdName(emdKey.split('|')[1]);
      if (!emd) continue;
      for (const j of Object.keys(g.jibuns)) push(byEmdJibun, `${emd}|${j}`, g);
      for (const n of Object.keys(g.names)) {
        for (const v of complexNameVariants(n, emdKey.split('|')[1])) {
          push(byEmdName, `${emd}|${v}`, g);
        }
      }
    }
  }

  const out: GroupAgg[] = [...withSeq];
  const ambiguous: GroupAgg[] = [];
  for (const g of all.values()) {
    if (g.aptSeq) continue;
    const emdName = emdNameOfGroup(g);
    const emd = normalizeEmdName(emdName);
    const jibun = mostFrequent(g.jibuns);
    const name = mostFrequent(g.names) ?? '';
    let hits: GroupAgg[] = [];
    if (emd && jibun) hits = byEmdJibun.get(`${emd}|${jibun}`) ?? [];
    if (hits.length > 1) {
      // Several 단지 on one 지번: the name decides.
      const variants = new Set(complexNameVariants(name, emdName));
      hits = hits.filter((h) =>
        Object.keys(h.names).some((n) =>
          complexNameVariants(n, emdName).some((v) => variants.has(v)),
        ),
      );
    }
    if (hits.length === 0 && emd && !jibun) {
      const set = new Set<GroupAgg>();
      for (const v of complexNameVariants(name, emdName)) {
        for (const h of byEmdName.get(`${emd}|${v}`) ?? []) set.add(h);
      }
      hits = [...set];
    }
    const [only, ...rest] = hits;
    if (only && rest.length === 0) mergeGroup(only, g);
    else if (hits.length > 1) ambiguous.push(g);
    else out.push(g);
  }
  return { groups: out, ambiguous };
}

// ---------- candidates ----------

export interface AreaCluster {
  /** Representative 전용면적 ㎡ (the most traded value of the cluster). */
  exclusiveArea: number;
  rows: number;
  typeName: string;
}

export interface Candidate {
  key: string;
  externalCode: string | null;
  name: string;
  /** 8-digit 읍면동 code. */
  emdCode: string;
  /** umdNm as 국토교통부 reports it (what the trade matcher compares). */
  emdName: string;
  /** "연향동" / "해룡면 신대리" */
  emdLabel: string;
  jibun: string | null;
  jibunAddress: string | null;
  roadAddress: string | null;
  builtYear: number | null;
  areas: AreaCluster[];
  saleCount: number;
  rentCount: number;
}

export interface Skipped {
  key: string;
  name: string;
  emdName: string | null;
  externalCode: string | null;
  saleCount: number;
  rentCount: number;
  reason: string;
}

/** typeName "84", or "84A"/"84B" when several 평형 share the integer ㎡. */
function typeNames(areas: readonly number[], taken: readonly string[] = []): string[] {
  const used = new Set(taken);
  const byInt = new Map<number, number>();
  for (const a of areas) byInt.set(Math.floor(a), (byInt.get(Math.floor(a)) ?? 0) + 1);
  return areas.map((a) => {
    const base = String(Math.floor(a));
    if ((byInt.get(Math.floor(a)) ?? 0) === 1 && !used.has(base)) {
      used.add(base);
      return base;
    }
    for (let i = 0; i < 26; i++) {
      const name = `${base}${String.fromCharCode(65 + i)}`;
      if (!used.has(name)) {
        used.add(name);
        return name;
      }
    }
    return base;
  });
}

/**
 * Distinct 전용면적 → 평형: values closer than AREA_CLUSTER_GAP_SQM to their neighbour are one
 * 평형 (represented by its most traded value); at most MAX_AREA_TYPES, ascending.
 */
export function clusterAreas(areas: Counts, takenTypeNames: readonly string[] = []): AreaCluster[] {
  const values = Object.entries(areas)
    .map(([k, n]) => [Number(k), n] as const)
    .filter(([a]) => Number.isFinite(a) && a > 0)
    .sort((x, y) => x[0] - y[0]);
  const clusters: { members: (readonly [number, number])[] }[] = [];
  let prev: number | null = null;
  for (const v of values) {
    const last = clusters.at(-1);
    if (last && prev !== null && v[0] - prev <= AREA_CLUSTER_GAP_SQM + 1e-9) last.members.push(v);
    else clusters.push({ members: [v] });
    prev = v[0];
  }
  const reps = clusters
    .map((c) => {
      const best = c.members.reduce((b, m) => (m[1] > b[1] ? m : b));
      return { exclusiveArea: best[0], rows: c.members.reduce((s, m) => s + m[1], 0) };
    })
    .sort((a, b) => b.rows - a.rows || a.exclusiveArea - b.exclusiveArea)
    .slice(0, MAX_AREA_TYPES)
    .sort((a, b) => a.exclusiveArea - b.exclusiveArea);
  const names = typeNames(
    reps.map((r) => r.exclusiveArea),
    takenTypeNames,
  );
  return reps.map((r, i) => ({ ...r, typeName: names[i] ?? '' }));
}

/** Where a group's rows say it is: umdCd (→ 10-digit 법정동) first, else umdNm by name. */
function resolveRegion(
  g: GroupAgg,
  regions: RegionIndex,
): { region: RegionRef; umdNm: string | null } | null {
  const entries = Object.entries(g.emds).sort((a, b) => b[1] - a[1]);
  for (const [k] of entries) {
    const [umdCd = '', umdNm = ''] = k.split('|');
    if (umdCd) {
      const hit = regions.get(`${regions.sggCode}${umdCd}`);
      if (hit) return { region: hit, umdNm: umdNm || null };
    }
  }
  for (const [k] of entries) {
    const umdNm = k.split('|')[1] ?? '';
    const hit = umdNm ? regions.findByName(umdNm) : undefined;
    if (hit) return { region: hit, umdNm };
  }
  return null;
}

/** One candidate 단지 per group, or the reason it cannot be one. */
export function buildCandidates(
  groups: readonly GroupAgg[],
  regions: RegionIndex,
): { candidates: Candidate[]; skipped: Skipped[] } {
  const candidates: Candidate[] = [];
  const skipped: Skipped[] = [];
  for (const g of groups) {
    const name = (mostFrequent(g.names) ?? '').slice(0, 100);
    const base = {
      key: g.key,
      name,
      externalCode: g.aptSeq ? canonicalAptSeq(g.aptSeq) : null,
      saleCount: g.sale,
      rentCount: g.rent,
    };
    const resolved = resolveRegion(g, regions);
    const place = resolved ? regions.placeOf(resolved.region) : null;
    if (!resolved || !place) {
      skipped.push({
        ...base,
        emdName: emdNameOfGroup(g),
        reason: '서비스 지역의 법정동을 확인할 수 없어요',
      });
      continue;
    }
    const jibun = mostFrequent(g.jibuns);
    const road = mostFrequent(g.roads);
    const year = mostFrequent(g.years);
    candidates.push({
      ...base,
      emdCode: place.emdCode,
      emdName: (resolved.umdNm ?? place.label).slice(0, 50),
      emdLabel: place.label,
      jibun,
      jibunAddress: jibun ? `${regions.sggName} ${place.label} ${jibun}`.slice(0, 200) : null,
      roadAddress: road ? `${regions.sggName} ${road}`.slice(0, 200) : null,
      builtYear: year ? Number(year) : null,
      areas: clusterAreas(g.areas),
    });
  }
  return { candidates, skipped };
}

// ---------- plan against existing 단지 ----------

export interface ExistingComplex {
  id: string;
  name: string;
  emdCode: string | null;
  emdName: string | null;
  jibun: string | null;
  jibunAddress: string | null;
  roadAddress: string | null;
  externalCode: string | null;
  builtYear: number | null;
  deleted: boolean;
  areaTypes: readonly { exclusiveArea: number; typeName: string; source: ComplexDataSource }[];
}

/** Fields the bootstrap may fill on an existing 단지 — only while they are empty. */
export interface ComplexPatch {
  externalCode?: string;
  emdCode?: string;
  emdName?: string;
  jibun?: string;
  jibunAddress?: string;
  roadAddress?: string;
  builtYear?: number;
}
export const PATCH_FIELDS = [
  'externalCode',
  'emdCode',
  'emdName',
  'jibun',
  'jibunAddress',
  'roadAddress',
  'builtYear',
] as const satisfies readonly (keyof ComplexPatch)[];

export interface PlanItem {
  candidate: Candidate;
  action: Exclude<ComplexBootstrapAction, 'NEEDS_LOCATION'> | 'NEEDS_LOCATION';
  reason: string | null;
  complexId: string | null;
  patch: ComplexPatch;
  /** 평형 to add (all of them for CREATE). */
  newAreas: AreaCluster[];
  location: { lat: number; lng: number } | null;
}

interface IndexedExisting {
  c: ExistingComplex;
  emd: string | null;
  jibun: string | null;
  names: Set<string>;
}

function index(c: ExistingComplex, regions?: RegionIndex): IndexedExisting {
  const parsed = parseJibunAddress(c.jibunAddress);
  // An admin-made 단지 may only carry its 읍면동 code: its name strips a "조례" prefix too.
  const emdName =
    c.emdName ?? parsed.emdName ?? (c.emdCode ? (regions?.get(c.emdCode)?.name ?? null) : null);
  return {
    c,
    emd: normalizeEmdName(emdName),
    jibun: normalizeJibun(c.jibun) ?? parsed.jibun,
    names: new Set(complexNameVariants(c.name, emdName)),
  };
}

/** Same 단지 by name: same 읍면동 (code, else 법정동 name) and a shared name spelling. */
function sameByName(e: IndexedExisting, cand: Candidate): boolean {
  const sameEmd = e.c.emdCode
    ? e.c.emdCode === cand.emdCode
    : e.emd !== null && e.emd === normalizeEmdName(cand.emdName);
  if (!sameEmd) return false;
  return complexNameVariants(cand.name, cand.emdName).some((v) => e.names.has(v));
}

/** A different 국토교통부 code or 지번 means a different 단지 of the same name. */
function contradicts(e: IndexedExisting, cand: Candidate): boolean {
  const seq = e.c.externalCode ? canonicalAptSeq(e.c.externalCode) : null;
  return (
    (seq !== null && cand.externalCode !== null && seq !== cand.externalCode) ||
    (e.jibun !== null && cand.jibun !== null && e.jibun !== cand.jibun)
  );
}

function missingAreas(existing: ExistingComplex, cand: Candidate): AreaCluster[] {
  // An admin's 평형 list is theirs: only 단지 without 평형, or with bootstrap-made ones only, get more.
  if (existing.areaTypes.some((a) => a.source !== ComplexDataSource.TRADE_BOOTSTRAP)) return [];
  const have = existing.areaTypes.map((a) => a.exclusiveArea);
  const fresh = cand.areas.filter((a) =>
    have.every((h) => Math.abs(h - a.exclusiveArea) > AREA_CLUSTER_GAP_SQM + 1e-9),
  );
  if (fresh.length === 0) return [];
  const names = typeNames(
    fresh.map((a) => a.exclusiveArea),
    existing.areaTypes.map((a) => a.typeName),
  );
  return fresh.map((a, i) => ({ ...a, typeName: names[i] ?? a.typeName }));
}

function patchFor(
  e: ExistingComplex,
  cand: Candidate,
  takenCodes: ReadonlySet<string>,
): ComplexPatch {
  const p: ComplexPatch = {};
  const empty = (v: string | number | null) => v === null || v === '';
  if (empty(e.externalCode) && cand.externalCode && !takenCodes.has(cand.externalCode)) {
    p.externalCode = cand.externalCode;
  }
  if (empty(e.emdCode)) p.emdCode = cand.emdCode;
  if (empty(e.emdName)) p.emdName = cand.emdName;
  if (empty(e.jibun) && cand.jibun) p.jibun = cand.jibun;
  if (empty(e.jibunAddress) && cand.jibunAddress) p.jibunAddress = cand.jibunAddress;
  if (empty(e.roadAddress) && cand.roadAddress) p.roadAddress = cand.roadAddress;
  if (empty(e.builtYear) && cand.builtYear) p.builtYear = cand.builtYear;
  return p;
}

/**
 * Decides per candidate: existing 단지 by externalCode (canonical aptSeq), else by 읍면동 +
 * normalized name when exactly one live 단지 fits and neither its code nor its 지번 contradicts;
 * UPDATE fills only empty fields; a match with a deleted 단지 is skipped (an admin removed it);
 * several candidates claiming one 단지 by name, or one candidate fitting several, are skipped.
 * Everything else is a CREATE (coordinates are added by the geocoding step).
 */
export function planCandidates(
  candidates: readonly Candidate[],
  existing: readonly ExistingComplex[],
  regions?: RegionIndex,
): PlanItem[] {
  const live = existing.filter((e) => !e.deleted).map((e) => index(e, regions));
  const deleted = existing.filter((e) => e.deleted).map((e) => index(e, regions));
  const bySeq = new Map<string, IndexedExisting>();
  for (const e of live) {
    if (e.c.externalCode) bySeq.set(canonicalAptSeq(e.c.externalCode), e);
  }
  const takenCodes = new Set(bySeq.keys());

  const items: PlanItem[] = [];
  const claims = new Map<string, PlanItem[]>();
  const seqClaimed = new Set<string>();
  for (const cand of candidates) {
    const item: PlanItem = {
      candidate: cand,
      action: 'CREATE',
      reason: null,
      complexId: null,
      patch: {},
      newAreas: cand.areas,
      location: null,
    };
    items.push(item);
    const bySeqHit = cand.externalCode ? bySeq.get(cand.externalCode) : undefined;
    if (bySeqHit) {
      item.complexId = bySeqHit.c.id;
      seqClaimed.add(bySeqHit.c.id);
      continue;
    }
    const named = live.filter((e) => sameByName(e, cand) && !contradicts(e, cand));
    if (named.length > 1) {
      item.action = 'SKIP';
      item.reason = '같은 동에 이름이 같은 단지가 여럿 있어요';
      continue;
    }
    const [hit] = named;
    if (hit) {
      item.complexId = hit.c.id;
      const list = claims.get(hit.c.id);
      if (list) list.push(item);
      else claims.set(hit.c.id, [item]);
      continue;
    }
    // A deleted 단지 keeps its code: the same aptSeq (any 시군구 spelling) or name is not recreated.
    const deletedHit = deleted.some(
      (e) =>
        (cand.externalCode !== null &&
          e.c.externalCode !== null &&
          canonicalAptSeq(e.c.externalCode) === cand.externalCode) ||
        (sameByName(e, cand) && !contradicts(e, cand)),
    );
    if (deletedHit) {
      item.action = 'SKIP';
      item.reason = '관리자가 삭제한 단지예요';
    }
  }
  // One 단지 claimed by name from several candidates (or by name and by code): nobody guesses.
  for (const [id, list] of claims) {
    if (list.length === 1 && !seqClaimed.has(id)) continue;
    for (const item of list) {
      item.action = 'SKIP';
      item.complexId = null;
      item.reason = seqClaimed.has(id)
        ? '단지 코드가 같은 다른 자료와 겹쳐요'
        : '이름이 같은 다른 단지 자료와 겹쳐요';
    }
  }

  const byId = new Map(live.map((e) => [e.c.id, e.c]));
  for (const item of items) {
    if (item.action !== 'CREATE' || !item.complexId) continue;
    const e = byId.get(item.complexId);
    if (!e) continue;
    item.patch = patchFor(e, item.candidate, takenCodes);
    if (item.patch.externalCode) takenCodes.add(item.patch.externalCode);
    item.newAreas = missingAreas(e, item.candidate);
    item.action =
      Object.keys(item.patch).length > 0 || item.newAreas.length > 0 ? 'UPDATE' : 'UNCHANGED';
  }
  return items;
}

// ---------- geocoding ----------

export interface CodedHit {
  lat: number;
  lng: number;
  roadAddress: string;
  jibunAddress: string | null;
  /** 법정동 code of the point (10 digits, any spelling), null when unknown. */
  legalCode: string | null;
}

/**
 * The first hit inside the service 시군구 and in the candidate's 읍면동. A hit without a 법정동
 * code counts only when its address names the 시군구.
 */
export function pickHit(
  hits: readonly CodedHit[],
  cand: Pick<Candidate, 'emdCode'>,
  regions: Pick<RegionIndex, 'sggCode' | 'sggName'>,
): CodedHit | null {
  for (const h of hits) {
    if (!Number.isFinite(h.lat) || !Number.isFinite(h.lng)) continue;
    if (h.legalCode) {
      const code = normalizeRegionCode(h.legalCode);
      if (!code.startsWith(regions.sggCode)) continue;
      if (code.slice(0, 8) !== cand.emdCode) continue;
      return h;
    }
    if (`${h.roadAddress} ${h.jibunAddress ?? ''}`.includes(regions.sggName)) return h;
  }
  return null;
}

/** Plan item → the API's ComplexBootstrapItem. */
export function toItem(item: PlanItem): ComplexBootstrapItem {
  const c = item.candidate;
  return {
    action: item.action,
    reason: item.reason,
    name: c.name,
    emdName: c.emdLabel,
    emdCode: c.emdCode,
    jibunAddress: c.jibunAddress,
    roadAddress: c.roadAddress,
    builtYear: c.builtYear,
    areaTypeCount: c.areas.length,
    exclusiveAreas: c.areas.map((a) => a.exclusiveArea),
    hasLocation: item.location !== null || item.action === 'UPDATE' || item.action === 'UNCHANGED',
    externalCode: c.externalCode,
    saleCount: c.saleCount,
    rentCount: c.rentCount,
    complexId: item.complexId,
  };
}

export function skippedToItem(s: Skipped): ComplexBootstrapItem {
  return {
    action: 'SKIP',
    reason: s.reason,
    name: s.name,
    emdName: s.emdName,
    emdCode: null,
    jibunAddress: null,
    roadAddress: null,
    builtYear: null,
    areaTypeCount: 0,
    exclusiveAreas: [],
    hasLocation: false,
    externalCode: s.externalCode,
    saleCount: s.saleCount,
    rentCount: s.rentCount,
    complexId: null,
  };
}
