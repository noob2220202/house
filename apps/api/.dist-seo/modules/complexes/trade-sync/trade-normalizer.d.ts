import { TradeDealType, TradeSyncKind } from '@house/shared';
import type { RawTradeItem } from './trade-api.client';
/** A 실거래 row in our units: money 만원, area ㎡ (2 decimals), dates at UTC midnight. */
export interface NormalizedTrade {
    sourceKey: string;
    /**
     * Key the same contract had when it was synced under the legacy 시군구 code (46150 before the
     * 2026-07-01 reorganisation); `null` when the code has no legacy alias. The sync re-keys such
     * rows instead of inserting the contract a second time.
     */
    legacySourceKey: string | null;
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
export type NormalizeResult = {
    ok: true;
    trade: Omit<NormalizedTrade, 'sourceKey' | 'legacySourceKey'>;
    identity: string;
    /** Same identity under the legacy 시군구 code, or `null` (see legacySourceKey). */
    legacyIdentity: string | null;
} | {
    ok: false;
    reason: string;
};
/** "82,500" → 82500; undefined/garbage → null. */
export declare function parseManwon(v: string | undefined): number | null;
/** 해제사유발생일: "24.10.15", "20241015" or "2024-10-15". */
export declare function parseCancelDay(v: string | undefined): Date | null;
/**
 * Raw row → normalized trade + its identity string. The identity holds only fields that never
 * change for the same contract (not 해제 flags, 등기일자, 중개사 소재지), so a later 해제 updates
 * the same row instead of creating a new one. Region codes are canonicalized: the API answers a
 * legacy LAWD_CD (46150) with legacy sggCd values, which are stored as the current code (12150).
 */
export declare function normalizeTradeItem(kind: TradeSyncKind, raw: RawTradeItem, requestedSggCode: string): NormalizeResult;
/**
 * Normalizes a whole month and assigns deterministic source keys. Identical contracts in one
 * month (same unit/day/price — e.g. two units sold together) get an occurrence suffix so each
 * stays a separate row and re-syncs map them onto the same keys.
 */
export declare function normalizeTradeBatch(kind: TradeSyncKind, items: readonly RawTradeItem[], sggCode: string): {
    trades: NormalizedTrade[];
    skipped: {
        reason: string;
    }[];
};
