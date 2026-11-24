import { randomBytes } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  ErrorCode,
  legacyRegionCode,
  TradeSyncKind,
  TradeSyncStatus,
  yearMonthOf,
  type Paginated,
  type TradeRematchResult,
  type TradeSyncResult,
  type TradeSyncRunsQuery,
  type TradeSyncRunView,
} from '@house/shared';
import { Prisma, type TradeSyncRun } from '@prisma/client';
import type Redis from 'ioredis';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { InjectRedis } from '../../../redis/redis.constants';
import {
  COMPLEXES_REDIS_KEYS,
  REMATCH_PAGE_SIZE,
  STATS_RECOMPUTE_CHUNK,
  TRADE_API,
  TRADE_SYNC_LOCK_HEARTBEAT_MS,
  TRADE_SYNC_LOCK_TTL_SECONDS,
  TRADE_UPSERT_BATCH,
} from '../constants';
import { ComplexMatcher, type MatchableComplex } from './complex-matcher';
import {
  TRADE_API_CLIENT,
  TradeApiError,
  type RawTradeItem,
  type TradeApiClient,
} from './trade-api.client';
import { normalizeTradeBatch, type NormalizedTrade } from './trade-normalizer';
import { TradeStatsService } from './trade-stats.service';

/** First month the 국토교통부 apartment trade data exists. */
const FIRST_DATA_MONTH = 200601;

const RELEASE_LOCK_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0`;

const EXTEND_LOCK_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('EXPIRE', KEYS[1], ARGV[2]) end
return 0`;

export interface HeldLock {
  key: string;
  token: string;
}

interface RematchRow {
  id: string;
  complexId: string | null;
  areaTypeId: string | null;
  aptName: string;
  emdName: string | null;
  jibun: string | null;
  exclusiveArea: number;
  aptSeq: string | null;
}

interface RunCounts {
  fetched: number;
  upserted: number;
  matched: number;
}

export function toRunView(r: TradeSyncRun): TradeSyncRunView {
  return {
    id: r.id,
    kind: r.kind,
    sggCode: r.sggCode,
    yearMonth: r.yearMonth,
    status: r.status,
    fetchedCount: r.fetchedCount,
    upsertedCount: r.upsertedCount,
    matchedCount: r.matchedCount,
    error: r.error,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
  };
}

/**
 * 국토교통부 실거래가 sync for the service 시군구: fetch every page of a month, normalize, match to
 * 단지, upsert idempotently by source_key, then rebuild that month's stats for affected 단지.
 * Each (kind, 시군구, month) run is serialized with a Redis lock and recorded in trade_sync_runs.
 */
@Injectable()
export class TradeSyncService {
  private readonly logger = new Logger(TradeSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: TradeStatsService,
    private readonly config: AppConfig,
    @Inject(TRADE_API_CLIENT) private readonly api: TradeApiClient,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  get configured(): boolean {
    return this.api.configured;
  }

  /**
   * Syncs `kinds` for one month. Throws TRADE_SYNC_IN_PROGRESS when a run for the same month is
   * active and TRADE_SYNC_FAILED (502, with the runs in details) when any kind failed.
   */
  async syncMonth(input: {
    yearMonth: number;
    kinds: readonly TradeSyncKind[];
    now?: Date;
  }): Promise<TradeSyncResult> {
    const { yearMonth } = input;
    this.assertSyncable(yearMonth, input.now);
    const sggCode = this.config.get('REGION_SGG_CODE');
    const kinds = [...new Set(input.kinds)];
    const keys = kinds.map((k) => COMPLEXES_REDIS_KEYS.tradeSyncLock(k, sggCode, yearMonth));
    return this.withLocks(keys, async () => {
      const runs: TradeSyncRunView[] = [];
      let firstError: unknown;
      for (const kind of kinds) {
        const { view, error } = await this.runOne(kind, sggCode, yearMonth);
        runs.push(view);
        if (error !== undefined) firstError ??= error;
      }
      if (firstError !== undefined) {
        throw new AppException(ErrorCode.TRADE_SYNC_FAILED, {
          status: HttpStatus.BAD_GATEWAY,
          details: { runs, retryable: firstError instanceof TradeApiError && firstError.retryable },
          cause: firstError,
        });
      }
      return { yearMonth, runs };
    });
  }

  /** TRADE_SYNC_INVALID_MONTH (400) / TRADE_SYNC_NOT_CONFIGURED (503) before anything runs. */
  assertSyncable(yearMonth: number, now: Date = new Date()): void {
    if (yearMonth < FIRST_DATA_MONTH || yearMonth > yearMonthOf(now)) {
      throw AppException.badRequest(ErrorCode.TRADE_SYNC_INVALID_MONTH);
    }
    if (!this.api.configured) {
      throw new AppException(ErrorCode.TRADE_SYNC_NOT_CONFIGURED, {
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    }
  }

  listRuns(q: TradeSyncRunsQuery): Promise<Paginated<TradeSyncRunView>> {
    const where: Prisma.TradeSyncRunWhereInput = {
      sggCode: this.config.get('REGION_SGG_CODE'),
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.yearMonth ? { yearMonth: q.yearMonth } : {}),
    };
    return paginate(
      q,
      async (args) =>
        (
          await this.prisma.tradeSyncRun.findMany({
            where,
            orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
            ...args,
          })
        ).map(toRunView),
      () => this.prisma.tradeSyncRun.count({ where }),
    );
  }

  /**
   * Re-evaluates the 단지 / 평형 of every trade (from `fromYm` on) with the current 단지 list:
   * unmatched rows are matched, rows of deleted 단지 or contradicted by a 국토교통부 code / 지번
   * are moved or detached, and 평형 are re-assigned. Rebuilds stats of every 단지 that gained or
   * lost trades. Serialized per 시군구 by a Redis lock (TRADE_SYNC_IN_PROGRESS when held).
   */
  async rematch(fromYm?: number): Promise<TradeRematchResult> {
    const sggCode = this.config.get('REGION_SGG_CODE');
    return this.withLocks([COMPLEXES_REDIS_KEYS.rematchLock(sggCode)], () =>
      this.rematchLocked(sggCode, fromYm),
    );
  }

  // ---------- internals ----------

  private async rematchLocked(sggCode: string, fromYm?: number): Promise<TradeRematchResult> {
    const matcher = new ComplexMatcher(await this.loadMatchable(sggCode));
    const touched = new Set<string>();
    let scanned = 0;
    let matched = 0;
    let unmatched = 0;
    let cursor: string | null = null;
    for (;;) {
      const rows: RematchRow[] = await this.prisma.$queryRaw<RematchRow[]>`
        SELECT id, complex_id AS "complexId", area_type_id AS "areaTypeId",
               apt_name AS "aptName", emd_name AS "emdName", jibun,
               exclusive_area::float8 AS "exclusiveArea",
               NULLIF(btrim(raw->>'aptSeq'), '') AS "aptSeq"
        FROM trade_records
        WHERE sgg_code = ${sggCode}
          ${fromYm ? Prisma.sql`AND deal_ym >= ${fromYm}` : Prisma.empty}
          ${cursor ? Prisma.sql`AND id > ${cursor}::uuid` : Prisma.empty}
        ORDER BY id
        LIMIT ${REMATCH_PAGE_SIZE}`;
      if (rows.length === 0) break;
      cursor = rows[rows.length - 1]?.id ?? null;
      scanned += rows.length;
      const updates: Prisma.PrismaPromise<unknown>[] = [];
      for (const r of rows) {
        const complex = matcher.resolve(r, r.complexId);
        const complexId = complex?.id ?? null;
        const areaTypeId = complex ? ComplexMatcher.areaTypeFor(complex, r.exclusiveArea) : null;
        if (complexId === r.complexId && areaTypeId === r.areaTypeId) continue;
        if (!r.complexId && complexId) matched += 1;
        if (r.complexId && !complexId) unmatched += 1;
        if (r.complexId) touched.add(r.complexId);
        if (complexId) touched.add(complexId);
        updates.push(
          this.prisma.tradeRecord.update({ where: { id: r.id }, data: { complexId, areaTypeId } }),
        );
      }
      if (updates.length > 0) await this.prisma.$transaction(updates);
    }
    // A deleted 단지's stats were already removed with it; recomputing it is a harmless no-op.
    const ids = [...touched];
    for (let i = 0; i < ids.length; i += STATS_RECOMPUTE_CHUNK) {
      await this.stats.recompute(ids.slice(i, i + STATS_RECOMPUTE_CHUNK));
    }
    return { scanned, matched, unmatched, complexesRecomputed: touched.size };
  }

  /** Never throws for upstream/processing failures: they are recorded on the run and returned. */
  private async runOne(
    kind: TradeSyncKind,
    sggCode: string,
    yearMonth: number,
  ): Promise<{ view: TradeSyncRunView; error?: unknown }> {
    const run = await this.prisma.tradeSyncRun.create({
      data: { kind, sggCode, yearMonth, status: TradeSyncStatus.RUNNING },
    });
    const counts: RunCounts = { fetched: 0, upserted: 0, matched: 0 };
    try {
      const items = await this.fetchMonth(kind, sggCode, yearMonth);
      counts.fetched = items.length;
      const { trades, skipped } = normalizeTradeBatch(kind, items, sggCode);
      if (skipped.length > 0) {
        this.logger.warn(
          { kind, yearMonth, skipped: skipped.length },
          'skipped invalid trade rows',
        );
      }
      const matcher = new ComplexMatcher(await this.loadMatchable(sggCode));
      const affected = new Set<string>();
      for (let i = 0; i < trades.length; i += TRADE_UPSERT_BATCH) {
        const r = await this.upsertBatch(trades.slice(i, i + TRADE_UPSERT_BATCH), matcher);
        counts.upserted += r.upserted;
        counts.matched += r.matched;
        for (const id of r.affected) affected.add(id);
      }
      // Months other than the requested one can appear (e.g. 해제 rows); rebuild what we touched.
      const months = [...new Set(trades.map((t) => t.dealYm))];
      if (affected.size > 0) await this.stats.recompute([...affected], months);
      const done = await this.prisma.tradeSyncRun.update({
        where: { id: run.id },
        data: {
          status: TradeSyncStatus.SUCCEEDED,
          fetchedCount: counts.fetched,
          upsertedCount: counts.upserted,
          matchedCount: counts.matched,
          finishedAt: new Date(),
        },
      });
      return { view: toRunView(done) };
    } catch (err) {
      const message =
        err instanceof TradeApiError
          ? err.message
          : err instanceof Error
            ? `internal: ${err.name}`
            : 'internal error';
      this.logger.error({ err, kind, yearMonth }, 'trade sync failed');
      const failed = await this.prisma.tradeSyncRun.update({
        where: { id: run.id },
        data: {
          status: TradeSyncStatus.FAILED,
          fetchedCount: counts.fetched,
          upsertedCount: counts.upserted,
          matchedCount: counts.matched,
          error: message.slice(0, 2000),
          finishedAt: new Date(),
        },
      });
      return { view: toRunView(failed), error: err };
    }
  }

  /**
   * Every row of the month under LAWD_CD = the configured code. Since the 2026-07-01
   * reorganisation the API serves every month (also earlier ones) under the new code (12150) and
   * nothing under the old one (46150); should a month come back empty anyway, it is asked once
   * more under the legacy code so a partial upstream migration cannot silently empty a month.
   * Rows are normalized to the configured code either way.
   */
  private async fetchMonth(
    kind: TradeSyncKind,
    sggCode: string,
    yearMonth: number,
  ): Promise<RawTradeItem[]> {
    const items = await this.fetchAll(kind, sggCode, yearMonth);
    const legacy = items.length === 0 ? legacyRegionCode(sggCode) : null;
    if (!legacy) return items;
    const legacyItems = await this.fetchAll(kind, legacy, yearMonth);
    this.logger.warn(
      { kind, yearMonth, sggCode, legacySggCode: legacy, legacyRows: legacyItems.length },
      'trade API returned no rows for the current 시군구 code; retried with the legacy code',
    );
    return legacyItems;
  }

  private async fetchAll(
    kind: TradeSyncKind,
    sggCode: string,
    yearMonth: number,
  ): Promise<RawTradeItem[]> {
    const items: RawTradeItem[] = [];
    for (let pageNo = 1; pageNo <= TRADE_API.MAX_PAGES; pageNo++) {
      const page = await this.api.fetchPage({
        kind,
        sggCode,
        yearMonth,
        pageNo,
        numOfRows: TRADE_API.PAGE_SIZE,
      });
      items.push(...page.items);
      if (page.items.length === 0 || items.length >= page.totalCount) return items;
    }
    throw new TradeApiError(`${kind} exceeded ${TRADE_API.MAX_PAGES} pages`, false);
  }

  private async upsertBatch(
    trades: readonly NormalizedTrade[],
    matcher: ComplexMatcher,
  ): Promise<{ upserted: number; matched: number; affected: string[] }> {
    // Contracts first stored under the legacy 시군구 code (46150) are found by their old key and
    // re-keyed in place, so a re-sync under the current code never stores a contract twice.
    const keys = trades.flatMap((t) =>
      t.legacySourceKey ? [t.sourceKey, t.legacySourceKey] : [t.sourceKey],
    );
    const existing = await this.prisma.tradeRecord.findMany({
      where: { sourceKey: { in: keys } },
      select: {
        id: true,
        sourceKey: true,
        complexId: true,
        areaTypeId: true,
        cancelled: true,
        cancelledAt: true,
      },
    });
    const byKey = new Map(existing.map((e) => [e.sourceKey, e]));
    const creates: Prisma.TradeRecordCreateManyInput[] = [];
    const updates: Prisma.PrismaPromise<unknown>[] = [];
    const affected = new Set<string>();
    let matched = 0;

    for (const t of trades) {
      const prev =
        byKey.get(t.sourceKey) ?? (t.legacySourceKey ? byKey.get(t.legacySourceKey) : undefined);
      // Same rule as rematch(): an earlier match survives unless contradicted or its 단지 is gone.
      const complex = matcher.resolve(t, prev?.complexId ?? null);
      const complexId = complex?.id ?? null;
      const areaTypeId = complex ? ComplexMatcher.areaTypeFor(complex, t.exclusiveArea) : null;
      if (complexId) matched += 1;

      if (!prev) {
        creates.push(toCreateInput(t, complexId, areaTypeId));
        if (complexId) affected.add(complexId);
        continue;
      }
      const rekey = prev.sourceKey !== t.sourceKey;
      const changed =
        rekey ||
        prev.cancelled !== t.cancelled ||
        (prev.cancelledAt?.getTime() ?? null) !== (t.cancelledAt?.getTime() ?? null) ||
        prev.complexId !== complexId ||
        prev.areaTypeId !== areaTypeId;
      if (!changed) continue;
      if (prev.complexId) affected.add(prev.complexId);
      if (complexId) affected.add(complexId);
      updates.push(
        this.prisma.tradeRecord.update({
          where: { id: prev.id },
          data: {
            ...(rekey ? { sourceKey: t.sourceKey, sggCode: t.sggCode } : {}),
            cancelled: t.cancelled,
            cancelledAt: t.cancelledAt,
            complexId,
            areaTypeId,
            raw: t.raw,
          },
        }),
      );
    }

    let created = 0;
    if (creates.length > 0) {
      created = (await this.prisma.tradeRecord.createMany({ data: creates, skipDuplicates: true }))
        .count;
    }
    if (updates.length > 0) await this.prisma.$transaction(updates);
    return { upserted: created + updates.length, matched, affected: [...affected] };
  }

  private async loadMatchable(sggCode: string): Promise<MatchableComplex[]> {
    const rows = await this.prisma.complex.findMany({
      where: { sggCode, deletedAt: null },
      select: {
        id: true,
        name: true,
        emdName: true,
        jibun: true,
        jibunAddress: true,
        externalCode: true,
        areaTypes: { select: { id: true, exclusiveArea: true }, orderBy: { id: 'asc' } },
      },
    });
    return rows.map((r) => ({
      ...r,
      areaTypes: r.areaTypes.map((a) => ({ id: a.id, exclusiveArea: a.exclusiveArea.toNumber() })),
    }));
  }

  /**
   * Runs `fn` holding every Redis lock in `keys` (TRADE_SYNC_IN_PROGRESS, 409, when one is held
   * elsewhere). The locks are extended every TRADE_SYNC_LOCK_HEARTBEAT_MS while `fn` runs, so a
   * slow upstream never lets a second run start, while a crashed worker frees them within the TTL.
   */
  private async withLocks<T>(keys: readonly string[], fn: () => Promise<T>): Promise<T> {
    const held: HeldLock[] = [];
    try {
      for (const key of keys) {
        const token = randomBytes(16).toString('hex');
        const ok = await this.redis.set(key, token, 'EX', TRADE_SYNC_LOCK_TTL_SECONDS, 'NX');
        if (ok !== 'OK') {
          throw new AppException(ErrorCode.TRADE_SYNC_IN_PROGRESS, { status: HttpStatus.CONFLICT });
        }
        held.push({ key, token });
      }
    } catch (err) {
      await this.releaseLocks(held);
      throw err;
    }
    const heartbeat = setInterval(() => void this.extendLocks(held), TRADE_SYNC_LOCK_HEARTBEAT_MS);
    heartbeat.unref();
    try {
      return await fn();
    } finally {
      clearInterval(heartbeat);
      await this.releaseLocks(held);
    }
  }

  /** Exposed for tests: one heartbeat tick. Returns how many locks were still ours. */
  async extendLocks(locks: readonly HeldLock[]): Promise<number> {
    let extended = 0;
    for (const { key, token } of locks) {
      try {
        const r = await this.redis.eval(
          EXTEND_LOCK_LUA,
          1,
          key,
          token,
          String(TRADE_SYNC_LOCK_TTL_SECONDS),
        );
        if (Number(r) === 1) extended += 1;
        else this.logger.warn({ key }, 'trade sync lock lost before the run finished');
      } catch (err) {
        this.logger.warn({ err, key }, 'failed to extend trade sync lock');
      }
    }
    return extended;
  }

  private async releaseLocks(locks: readonly HeldLock[]): Promise<void> {
    for (const { key, token } of locks) {
      try {
        await this.redis.eval(RELEASE_LOCK_LUA, 1, key, token);
      } catch (err) {
        this.logger.warn({ err, key }, 'failed to release trade sync lock (expires by TTL)');
      }
    }
  }
}

function toCreateInput(
  t: NormalizedTrade,
  complexId: string | null,
  areaTypeId: string | null,
): Prisma.TradeRecordCreateManyInput {
  return {
    sourceKey: t.sourceKey,
    kind: t.kind,
    complexId,
    areaTypeId,
    sggCode: t.sggCode,
    emdName: t.emdName?.slice(0, 50) ?? null,
    aptName: t.aptName,
    jibun: t.jibun?.slice(0, 20) ?? null,
    dealType: t.dealType,
    dealDate: t.dealDate,
    dealYm: t.dealYm,
    exclusiveArea: t.exclusiveArea,
    floor: t.floor,
    price: t.price,
    deposit: t.deposit,
    monthlyRent: t.monthlyRent,
    builtYear: t.builtYear,
    cancelled: t.cancelled,
    cancelledAt: t.cancelledAt,
    contractType: t.contractType,
    raw: t.raw,
  };
}
