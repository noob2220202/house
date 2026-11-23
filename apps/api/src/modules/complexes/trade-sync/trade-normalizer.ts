import { createHash } from 'node:crypto';
import {
  normalizeComplexName,
  normalizeEmdName,
  normalizeJibun,
  TradeDealType,
  TradeSyncKind,
} from '@house/shared';
import type { RawTradeItem } from './trade-api.client';

/** A 실거래 row in our units: money 만원, area ㎡ (2 decimals), dates at UTC midnight. */
export interface NormalizedTrade {
  sourceKey: string;
  kind: TradeSyncKind;
  sggCode: string;
  emdCode: string | null;
  emdName: string | null;
  aptName: string;
  aptSeq: string | null;
  jibun: string | null;
  dealType: TradeDealType;
  dealDate: Date;
  dealYm: number;
  exclusiveArea: number;
  floor: number | null;
  price: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  builtYear: number | null;
  cancelled: boolean;
  cancelledAt: Date | null;
  contractType: string | null;
  raw: Record<string, string>;
}

export type NormalizeResult =
  | { ok: true; trade: Omit<NormalizedTrade, 'sourceKey'>; identity: string }
  | { ok: false; reason: string };

/** Field aliases: current English tags first, then the pre-2024 Korean tags. */
const F = {
  sggCd: ['sggCd', '지역코드'],
  umdCd: ['umdCd'],
  umdNm: ['umdNm', '법정동'],
  aptNm: ['aptNm', '아파트', '단지명'],
  aptSeq: ['aptSeq', '일련번호'],
  aptDong: ['aptDong'],
  jibun: ['jibun', '지번'],
  area: ['excluUseAr', '전용면적'],
  year: ['dealYear', '년'],
  month: ['dealMonth', '월'],
  day: ['dealDay', '일'],
  amount: ['dealAmount', '거래금액'],
  deposit: ['deposit', '보증금액', '보증금'],
  rent: ['monthlyRent', '월세금액', '월세'],
  floor: ['floor', '층'],
  buildYear: ['buildYear', '건축년도'],
  cancelType: ['cdealType', '해제여부'],
  cancelDay: ['cdealDay', '해제사유발생일'],
  contractType: ['contractType', '계약구분'],
} as const;

function pick(raw: RawTradeItem, keys: readonly string[]): string | undefined {
  for (const k of keys) {
    const v = raw[k]?.trim();
    if (v !== undefined && v !== '' && v !== '-') return v;
  }
  return undefined;
}

/** "82,500" → 82500; undefined/garbage → null. */
export function parseManwon(v: string | undefined): number | null {
  if (v === undefined) return null;
  const digits = v.replace(/[,\s]/g, '');
  if (!/^-?\d+$/.test(digits)) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

function parseIntOrNull(v: string | undefined): number | null {
  if (v === undefined || !/^-?\d+$/.test(v.trim())) return null;
  return Number(v.trim());
}

function utcDate(y: number, m: number, d: number): Date | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
    ? date
    : null;
}

/** 해제사유발생일: "24.10.15", "20241015" or "2024-10-15". */
export function parseCancelDay(v: string | undefined): Date | null {
  if (!v) return null;
  const m = /^(\d{2}|\d{4})[.\-/]?(\d{1,2})[.\-/]?(\d{1,2})$/.exec(v.trim());
  if (!m) return null;
  const [, yy = '', mm = '', dd = ''] = m;
  const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
  return utcDate(year, Number(mm), Number(dd));
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Raw row → normalized trade + its identity string. The identity holds only fields that never
 * change for the same contract (not 해제 flags, 등기일자, 중개사 소재지), so a later 해제 updates
 * the same row instead of creating a new one.
 */
export function normalizeTradeItem(
  kind: TradeSyncKind,
  raw: RawTradeItem,
  requestedSggCode: string,
): NormalizeResult {
  const aptName = pick(raw, F.aptNm);
  if (!aptName) return { ok: false, reason: 'missing aptNm' };
  const y = parseIntOrNull(pick(raw, F.year));
  const mo = parseIntOrNull(pick(raw, F.month));
  const d = parseIntOrNull(pick(raw, F.day));
  const dealDate = y && mo && d ? utcDate(y, mo, d) : null;
  if (!dealDate || y === null || mo === null) return { ok: false, reason: 'invalid deal date' };
  const areaRaw = Number(pick(raw, F.area));
  if (!Number.isFinite(areaRaw) || areaRaw <= 0) return { ok: false, reason: 'invalid area' };
  const exclusiveArea = Math.round(areaRaw * 100) / 100;

  let dealType: TradeDealType;
  let price: number | null = null;
  let deposit: number | null = null;
  let monthlyRent: number | null = null;
  if (kind === TradeSyncKind.APT_TRADE) {
    price = parseManwon(pick(raw, F.amount));
    if (price === null || price <= 0) return { ok: false, reason: 'invalid dealAmount' };
    dealType = TradeDealType.SALE;
  } else {
    deposit = parseManwon(pick(raw, F.deposit));
    monthlyRent = parseManwon(pick(raw, F.rent)) ?? 0;
    if (deposit === null || deposit < 0 || monthlyRent < 0) {
      return { ok: false, reason: 'invalid deposit/rent' };
    }
    dealType = monthlyRent > 0 ? TradeDealType.MONTHLY : TradeDealType.JEONSE;
  }

  const sggCode = pick(raw, F.sggCd) ?? requestedSggCode;
  const umdCd = pick(raw, F.umdCd);
  const emdCode = umdCd && /^\d{5}$/.test(umdCd) ? `${sggCode}${umdCd.slice(0, 3)}` : null;
  const emdName = pick(raw, F.umdNm) ?? null;
  const jibun = normalizeJibun(pick(raw, F.jibun));
  const aptSeq = pick(raw, F.aptSeq) ?? null;
  const floor = parseIntOrNull(pick(raw, F.floor));
  const cancelled = (pick(raw, F.cancelType) ?? '').toUpperCase() === 'O';
  const cancelledAt = cancelled ? parseCancelDay(pick(raw, F.cancelDay)) : null;

  const identity = [
    kind,
    sggCode,
    aptSeq ?? `${normalizeEmdName(emdName) ?? ''}/${normalizeComplexName(aptName)}`,
    jibun ?? '',
    pick(raw, F.aptDong) ?? '',
    isoDay(dealDate),
    exclusiveArea.toFixed(2),
    floor ?? '',
    price ?? '',
    deposit ?? '',
    monthlyRent ?? '',
  ].join('|');

  return {
    ok: true,
    identity,
    trade: {
      kind,
      sggCode,
      emdCode,
      emdName,
      aptName: aptName.slice(0, 100),
      aptSeq,
      jibun,
      dealType,
      dealDate,
      dealYm: y * 100 + mo,
      exclusiveArea,
      floor,
      price,
      deposit,
      monthlyRent,
      builtYear: parseIntOrNull(pick(raw, F.buildYear)),
      cancelled,
      cancelledAt,
      contractType: pick(raw, F.contractType)?.slice(0, 10) ?? null,
      raw: { ...raw },
    },
  };
}

/**
 * Normalizes a whole month and assigns deterministic source keys. Identical contracts in one
 * month (same unit/day/price — e.g. two units sold together) get an occurrence suffix so each
 * stays a separate row and re-syncs map them onto the same keys.
 */
export function normalizeTradeBatch(
  kind: TradeSyncKind,
  items: readonly RawTradeItem[],
  sggCode: string,
): { trades: NormalizedTrade[]; skipped: { reason: string }[] } {
  const seen = new Map<string, number>();
  const trades: NormalizedTrade[] = [];
  const skipped: { reason: string }[] = [];
  for (const raw of items) {
    const r = normalizeTradeItem(kind, raw, sggCode);
    if (!r.ok) {
      skipped.push({ reason: r.reason });
      continue;
    }
    const n = seen.get(r.identity) ?? 0;
    seen.set(r.identity, n + 1);
    const sourceKey = createHash('sha256').update(`${r.identity}#${n}`).digest('hex');
    trades.push({ ...r.trade, sourceKey });
  }
  return { trades, skipped };
}
