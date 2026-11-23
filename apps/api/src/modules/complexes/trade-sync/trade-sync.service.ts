import { randomBytes } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  ErrorCode,
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
  TRADE_API,
  TRADE_SYNC_LOCK_TTL_SECONDS,
  TRADE_UPSERT_BATCH,
} from '../constants';
import { ComplexMatcher, type MatchableComplex } from './complex-matcher';
import { TRADE_API_CLIENT, TradeApiError, type RawTradeItem, type TradeApiClient } from './trade-api.client';
import { normalizeTradeBatch, type NormalizedTrade } from './trade-normalizer';
import { TradeStatsService } from './trade-stats.service';

/** First month the 국토교통부 apartment trade data exists. */
const FIRST_DATA_MONTH = 200601;

const RELEASE_LOCK_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0`;

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
    const now = input.now ?? new Date();
    if (yearMonth < FIRST_DATA_MONTH || yearMonth > yearMonthOf(now)) {
      throw AppException.badRequest(ErrorCode.TRADE_SYNC_INVALID_MONTH);
    }
    if (!this.api.configured) {
      throw new AppException(ErrorCode.TRADE_SYNC_NOT_CONFIGURED, {
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    }
    const sggCode = this.config.get('REGION_SGG_CODE');
    const kinds = [...new Set(input.kinds)];
    const locks = await this.acquireLocks(kinds, sggCode, yearMonth);
    try {
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
    } finally {
      await this.releaseLocks(locks);
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
   * Re-runs matching for trades without a 단지 (or without a 평형) — e.g. after an admin adds a
   * 단지 or its 국토교통부 code — and rebuilds stats of every 단지 that gained trades.
   */
  async rematch(fromYm?: number): Promise<TradeRematchResult> {
    const sggCode = this.config.get('REGION_SGG_CODE');
    const complexes = await this.loadMatchable(sggCode);
    const matcher = new ComplexMatcher(complexes);
    const complexById = new Map<string, MatchableComplex>(complexes.map((c) => [c.id, c]));
    const touched = new Set<string>();
    let scanned = 0;
    let matched = 0;
    let cursor: string | undefined;
    for (;;) {
      const rows = await this.prisma.tradeRecord.findMany({
        where: {
          sggCode,
          ...(fromYm ? { dealYm: { gte: fromYm } } : {}),
          OR: [{ complexId: null }, { areaTypeId: null }],
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        orderBy: { id: 'asc' },
        take: 500,
        select: {
          id: true,
          complexId: true,
          areaTypeId: true,
          aptName: true,
          emdName: true,
          jibun: true,
          exclusiveArea: true,
          raw: true,
        },
      });
      if (rows.length === 0) break;
      cursor = rows[rows.length - 1]?.id;
      scanned += rows.length;
      const updates: Prisma.PrismaPromise<unknown>[] = [];
      for (const r of rows) {
        const complex = r.complexId
          ? complexById.get(r.complexId)
          : matcher.match({
              aptSeq: rawString(r.raw, 'aptSeq'),
              aptName: r.aptName,
              emdName: r.emdName,
              jibun: r.jibun,
            });
        if (!complex) continue;
        const areaTypeId = ComplexMatcher.areaTypeFor(complex, r.exclusiveArea.toNumber());
        if (complex.id === r.complexId && areaTypeId === r.areaTypeId) continue;
        if (!r.complexId) matched += 1;
        touched.add(complex.id);
        updates.push(
          this.prisma.tradeRecord.update({
            where: { id: r.id },
            data: { complexId: complex.id, areaTypeId },
          }),
        );
      }
      if (updates.length > 0) await this.prisma.$transaction(updates);
    }
    if (touched.size > 0) await this.stats.recompute([...touched]);
    return { scanned, matched, complexesRecomputed: touched.size };
  }

  // ---------- internals ----------

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
      const items = await this.fetchAll(kind, sggCode, yearMonth);
      counts.fetched = items.length;
      const { trades, skipped } = normalizeTradeBatch(kind, items, sggCode);
      if (skipped.length > 0) {
        this.logger.warn({ kind, yearMonth, skipped: skipped.length }, 'skipped invalid trade rows');
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

  private async fetchAll(kind: TradeSyncKind, sggCode: string, yearMonth: number): Promise<RawTradeItem[]> {
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
    const existing = await this.prisma.tradeRecord.findMany({
      where: { sourceKey: { in: trades.map((t) => t.sourceKey) } },
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
      const complex = matcher.match(t);
      const prev = byKey.get(t.sourceKey);
      // A later run never un-matches a row (it may have been matched by rematch()).
      const complexId = complex?.id ?? prev?.complexId ?? null;
      const areaTypeId = complex
        ? ComplexMatcher.areaTypeFor(complex, t.exclusiveArea)
        : (prev?.areaTypeId ?? null);
      if (complexId) matched += 1;

      if (!prev) {
        creates.push(toCreateInput(t, complexId, areaTypeId));
        if (complexId) affected.add(complexId);
        continue;
      }
      const changed =
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

  private async acquireLocks(
    kinds: readonly TradeSyncKind[],
    sggCode: string,
    yearMonth: number,
  ): Promise<{ key: string; token: string }[]> {
    const held: { key: string; token: string }[] = [];
    for (const kind of kinds) {
      const key = COMPLEXES_REDIS_KEYS.tradeSyncLock(kind, sggCode, yearMonth);
      const token = randomBytes(16).toString('hex');
      const ok = await this.redis.set(key, token, 'EX', TRADE_SYNC_LOCK_TTL_SECONDS, 'NX');
      if (ok !== 'OK') {
        await this.releaseLocks(held);
        throw new AppException(ErrorCode.TRADE_SYNC_IN_PROGRESS, { status: HttpStatus.CONFLICT });
      }
      held.push({ key, token });
    }
    return held;
  }

  private async releaseLocks(locks: readonly { key: string; token: string }[]): Promise<void> {
    for (const { key, token } of locks) {
      try {
        await this.redis.eval(RELEASE_LOCK_LUA, 1, key, token);
      } catch (err) {
        this.logger.warn({ err, key }, 'failed to release trade sync lock (expires by TTL)');
      }
    }
  }
}

function rawString(raw: Prisma.JsonValue | null, key: string): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const v = raw[key];
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
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
