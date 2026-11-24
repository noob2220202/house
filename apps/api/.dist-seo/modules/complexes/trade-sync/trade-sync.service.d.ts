import { TradeSyncKind, type Paginated, type TradeRematchResult, type TradeSyncResult, type TradeSyncRunsQuery, type TradeSyncRunView } from '@house/shared';
import { type TradeSyncRun } from '@prisma/client';
import type Redis from 'ioredis';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { type TradeApiClient } from './trade-api.client';
import { TradeStatsService } from './trade-stats.service';
export interface HeldLock {
    key: string;
    token: string;
}
export declare function toRunView(r: TradeSyncRun): TradeSyncRunView;
/**
 * 국토교통부 실거래가 sync for the service 시군구: fetch every page of a month, normalize, match to
 * 단지, upsert idempotently by source_key, then rebuild that month's stats for affected 단지.
 * Each (kind, 시군구, month) run is serialized with a Redis lock and recorded in trade_sync_runs.
 */
export declare class TradeSyncService {
    private readonly prisma;
    private readonly stats;
    private readonly config;
    private readonly api;
    private readonly redis;
    private readonly logger;
    constructor(prisma: PrismaService, stats: TradeStatsService, config: AppConfig, api: TradeApiClient, redis: Redis);
    get configured(): boolean;
    /**
     * Syncs `kinds` for one month. Throws TRADE_SYNC_IN_PROGRESS when a run for the same month is
     * active and TRADE_SYNC_FAILED (502, with the runs in details) when any kind failed.
     */
    syncMonth(input: {
        yearMonth: number;
        kinds: readonly TradeSyncKind[];
        now?: Date;
    }): Promise<TradeSyncResult>;
    /** TRADE_SYNC_INVALID_MONTH (400) / TRADE_SYNC_NOT_CONFIGURED (503) before anything runs. */
    assertSyncable(yearMonth: number, now?: Date): void;
    listRuns(q: TradeSyncRunsQuery): Promise<Paginated<TradeSyncRunView>>;
    /**
     * Re-evaluates the 단지 / 평형 of every trade (from `fromYm` on) with the current 단지 list:
     * unmatched rows are matched, rows of deleted 단지 or contradicted by a 국토교통부 code / 지번
     * are moved or detached, and 평형 are re-assigned. Rebuilds stats of every 단지 that gained or
     * lost trades. Serialized per 시군구 by a Redis lock (TRADE_SYNC_IN_PROGRESS when held).
     */
    rematch(fromYm?: number): Promise<TradeRematchResult>;
    private rematchLocked;
    /** Never throws for upstream/processing failures: they are recorded on the run and returned. */
    private runOne;
    /**
     * Every row of the month under LAWD_CD = the configured code. Since the 2026-07-01
     * reorganisation the API serves every month (also earlier ones) under the new code (12150) and
     * nothing under the old one (46150); should a month come back empty anyway, it is asked once
     * more under the legacy code so a partial upstream migration cannot silently empty a month.
     * Rows are normalized to the configured code either way.
     */
    private fetchMonth;
    private fetchAll;
    private upsertBatch;
    private loadMatchable;
    /**
     * Runs `fn` holding every Redis lock in `keys` (TRADE_SYNC_IN_PROGRESS, 409, when one is held
     * elsewhere). The locks are extended every TRADE_SYNC_LOCK_HEARTBEAT_MS while `fn` runs, so a
     * slow upstream never lets a second run start, while a crashed worker frees them within the TTL.
     */
    private withLocks;
    /** Exposed for tests: one heartbeat tick. Returns how many locks were still ours. */
    extendLocks(locks: readonly HeldLock[]): Promise<number>;
    private releaseLocks;
}
