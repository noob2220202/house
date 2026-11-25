import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  addMonths,
  AssetType,
  ComplexDataSource,
  enumValues,
  isValidYearMonth,
  TradeSyncKind,
  TradeSyncStatus,
  yearMonthOf,
  yearMonthRange,
  type ComplexBootstrapItem,
  type ComplexBootstrapPhase,
  type ComplexBootstrapPreview,
  type ComplexBootstrapProgress,
  type ComplexBootstrapResult,
} from '@house/shared';
import { Prisma } from '@prisma/client';
import { UnrecoverableError, type Job } from 'bullmq';
import type Redis from 'ioredis';
import { AuditService } from '../../../common/audit/audit.service';
import { CacheService } from '../../../common/cache/cache.service';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { InjectRedis } from '../../../redis/redis.constants';
import {
  GEOCODER,
  GeocoderUnavailableError,
  type Geocoder,
} from '../../home/clients/kakao-geocode.client';
import { COMPLEX_BOOTSTRAP, COMPLEXES_CACHE, COMPLEXES_REDIS_KEYS } from '../constants';
import {
  SUNCHEON_REGIONS,
  SUNCHEON_SGG,
  SUNCHEON_SGG_CODE,
} from '../regions/suncheon-regions.data';
import { TradeApiError, tradeApiQuotaError } from '../trade-sync/trade-api.client';
import { TradeSyncJobs } from '../trade-sync/trade-sync.jobs';
import { TradeSyncService } from '../trade-sync/trade-sync.service';
import {
  aggregateMonth,
  buildCandidates,
  mergeMonths,
  mostFrequent,
  PATCH_FIELDS,
  pickHit,
  planCandidates,
  RegionIndex,
  skippedToItem,
  toItem,
  type Candidate,
  type CodedHit,
  type ExistingComplex,
  type MonthAggregate,
  type PlanItem,
  type RegionRef,
  type Skipped,
} from './complex-bootstrap.planner';

/** failedReason of a run stopped by the data.go.kr daily quota (shown as is by the admin). */
export const BOOTSTRAP_QUOTA_MESSAGE =
  '국토교통부 실거래가 API의 오늘 호출 한도를 다 썼어요. 이미 불러온 달은 저장되어 있으니 내일 다시 실행하면 이어서 진행해요.';

/** Payload of a `complexes:bootstrap` job. */
export interface ComplexBootstrapJobData {
  months: number;
  dryRun: boolean;
  fromYm: number;
  toYm: number;
}

/** Return value of a `complexes:bootstrap` job. */
export interface ComplexBootstrapJobResult {
  preview: ComplexBootstrapPreview;
  result: ComplexBootstrapResult | null;
}

/** Overall percent ranges of the phases (a dry run ends after geocoding). */
const PHASE_RANGE: Record<ComplexBootstrapPhase, [number, number]> = {
  queued: [0, 0],
  fetch: [0, 50],
  geocode: [50, 85],
  write: [85, 100],
  done: [100, 100],
};

const RELEASE_LOCK_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0`;
const EXTEND_LOCK_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('EXPIRE', KEYS[1], ARGV[2]) end
return 0`;

const ACTION_ORDER: Record<ComplexBootstrapItem['action'], number> = {
  CREATE: 0,
  NEEDS_LOCATION: 1,
  UPDATE: 2,
  UNCHANGED: 3,
  SKIP: 4,
};

export function parseBootstrapJob(data: unknown): ComplexBootstrapJobData {
  const d = (data ?? {}) as Partial<Record<keyof ComplexBootstrapJobData, unknown>>;
  if (
    typeof d.months !== 'number' ||
    typeof d.dryRun !== 'boolean' ||
    typeof d.fromYm !== 'number' ||
    typeof d.toYm !== 'number' ||
    !isValidYearMonth(d.fromYm) ||
    !isValidYearMonth(d.toYm) ||
    d.fromYm > d.toYm
  ) {
    throw new UnrecoverableError('invalid complexes:bootstrap job payload');
  }
  return { months: d.months, dryRun: d.dryRun, fromYm: d.fromYm, toYm: d.toYm };
}

/** Contract months of a run: `months` months ending last month (KST). */
export function bootstrapRange(months: number, now: Date): { fromYm: number; toYm: number } {
  const toYm = addMonths(yearMonthOf(now), -1);
  return { fromYm: addMonths(toYm, -(months - 1)), toYm };
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/** "전남광주통합특별시 순천시 연향번영길 100" → "순천시 연향번영길 100" (same form as ours). */
function fromSgg(address: string, sggName: string): string {
  const at = address.indexOf(sggName);
  return (at > 0 ? address.slice(at) : address).slice(0, 200);
}

/**
 * Builds the 단지 list of the service 시군구 from 국토교통부 실거래가 (아파트 매매 + 전월세):
 * reads every month of the period (cached per month, so a failed run resumes and a dry run
 * followed by the real run reads the API once), groups the rows by canonical aptSeq, geocodes
 * new 단지 with the Kakao geocoder (inside the 시군구 only) and — unless dryRun — creates them,
 * fills empty fields of existing 단지 (never overwrites, never deletes), then enqueues a rematch
 * and the 실거래가 sync of the same months so trades link right away. One run at a time.
 */
@Injectable()
export class ComplexBootstrapService {
  private readonly logger = new Logger(ComplexBootstrapService.name);
  /** Politeness pauses (ms). Tests set them to 0. */
  readonly throttle = {
    apiMs: COMPLEX_BOOTSTRAP.API_DELAY_MS as number,
    geocodeMs: COMPLEX_BOOTSTRAP.GEOCODE_DELAY_MS as number,
    retryMs: COMPLEX_BOOTSTRAP.API_RETRY_WAIT_MS as number,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly sync: TradeSyncService,
    private readonly tradeJobs: TradeSyncJobs,
    private readonly cache: CacheService,
    private readonly audit: AuditService,
    @Inject(GEOCODER) private readonly geocoder: Geocoder,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /** Needs the data.go.kr key (rows) and the Kakao REST key (coordinates). */
  get configured(): boolean {
    return this.sync.configured && this.geocoder.isConfigured();
  }

  private get sggCode(): string {
    return this.config.get('REGION_SGG_CODE');
  }

  /** Worker entry for a `complexes:bootstrap` job. */
  async process(job: Job): Promise<ComplexBootstrapJobResult> {
    const data = parseBootstrapJob(job.data);
    const report = async (phase: ComplexBootstrapPhase, done: number, total: number) => {
      const [lo, hi] = PHASE_RANGE[phase];
      const percent = Math.round(lo + (total > 0 ? (hi - lo) * Math.min(1, done / total) : 0));
      const progress: ComplexBootstrapProgress = { phase, done, total, percent };
      await job.updateProgress(progress);
    };
    return this.withLock(() => this.run(String(job.id), data, report));
  }

  async run(
    jobId: string,
    data: ComplexBootstrapJobData,
    report: (phase: ComplexBootstrapPhase, done: number, total: number) => Promise<void> = () =>
      Promise.resolve(),
  ): Promise<ComplexBootstrapJobResult> {
    const sgg = this.sggCode;
    const regions = await this.regionIndex(sgg);
    const months = yearMonthRange(data.fromYm, data.toYm);
    const kinds = enumValues(TradeSyncKind);

    // 1. rows → per-month aggregates (cached)
    const aggregates: MonthAggregate[] = [];
    let step = 0;
    await report('fetch', 0, months.length * kinds.length);
    for (const ym of months) {
      for (const kind of kinds) {
        aggregates.push(await this.monthAggregate(kind, sgg, ym));
        step += 1;
        await report('fetch', step, months.length * kinds.length);
      }
    }
    const rows = aggregates.reduce((n, a) => n + a.rows, 0);
    const { groups, ambiguous } = mergeMonths(aggregates);
    const { candidates, skipped } = buildCandidates(groups, regions);
    for (const g of ambiguous) {
      skipped.push({
        key: g.key,
        name: mostFrequent(g.names) ?? '',
        emdName: null,
        externalCode: null,
        saleCount: g.sale,
        rentCount: g.rent,
        reason: '단지 코드 없는 자료가 여러 단지와 겹쳐요',
      });
    }

    // 2. plan against the current 단지 + coordinates for new ones
    const items = planCandidates(candidates, await this.loadExisting(sgg), regions);
    const toLocate = items.filter((i) => i.action === 'CREATE');
    await report('geocode', 0, toLocate.length);
    let failures = 0;
    for (const [n, item] of toLocate.entries()) {
      const located = await this.locate(item.candidate, regions, () => {
        failures += 1;
        if (failures >= COMPLEX_BOOTSTRAP.GEOCODE_MAX_CONSECUTIVE_FAILURES) {
          throw new Error('geocoder unavailable');
        }
      });
      if (located.ok) failures = 0;
      if (located.hit) {
        item.location = { lat: located.hit.lat, lng: located.hit.lng };
        if (!item.candidate.roadAddress && located.hit.roadAddress !== located.hit.jibunAddress) {
          item.candidate.roadAddress = fromSgg(located.hit.roadAddress, regions.sggName);
        }
      } else {
        item.action = 'NEEDS_LOCATION';
        item.reason = '주소로 좌표를 찾지 못했어요';
      }
      await report('geocode', n + 1, toLocate.length);
    }
    const preview = this.preview(data, rows, items, skipped);
    await this.redis.set(
      COMPLEXES_REDIS_KEYS.bootstrapPreview(jobId),
      JSON.stringify(preview),
      'EX',
      COMPLEX_BOOTSTRAP.PREVIEW_TTL_SECONDS,
    );
    if (data.dryRun) {
      await report('done', 1, 1);
      return { preview, result: null };
    }

    // 3. write
    const result = await this.apply(items, skipped.length, sgg, report);
    const tradeSyncJobs = await this.enqueueTradeSync(months, result, sgg);
    result.tradeSyncJobs = tradeSyncJobs;
    await this.audit.record({
      action: 'complex.bootstrap.apply',
      resourceType: 'Complex',
      after: {
        jobId,
        fromYm: data.fromYm,
        toYm: data.toYm,
        ...result,
        createdIds: items
          .filter((i) => i.action === 'CREATE' && i.complexId)
          .map((i) => i.complexId),
        updatedIds: items
          .filter((i) => i.action === 'UPDATE' && i.complexId)
          .map((i) => i.complexId),
      },
    });
    await report('done', 1, 1);
    return { preview: this.preview(data, rows, items, skipped), result };
  }

  // ---------- internals ----------

  private async regionIndex(sgg: string): Promise<RegionIndex> {
    if (sgg === SUNCHEON_SGG_CODE) {
      return new RegionIndex(sgg, SUNCHEON_SGG.name, SUNCHEON_REGIONS);
    }
    // Another 시군구: the regions table (maintained through PUT /admin/regions/:code).
    const rows = await this.prisma.region.findMany({
      where: { code: { startsWith: sgg }, isActive: true },
      select: { code: true, name: true, level: true, parentCode: true },
    });
    const sggRow = rows.find((r) => r.code === sgg);
    const refs = rows.flatMap((r): RegionRef[] =>
      (r.level === 'EMD' || r.level === 'RI') && r.parentCode
        ? [{ code: r.code, name: r.name, level: r.level, parentCode: r.parentCode }]
        : [],
    );
    return new RegionIndex(sgg, sggRow?.name ?? sgg, refs);
  }

  /** One month of one API, from the cache or the API (legacy-code retry inside fetchMonth). */
  private async monthAggregate(
    kind: TradeSyncKind,
    sgg: string,
    ym: number,
  ): Promise<MonthAggregate> {
    const key = COMPLEXES_REDIS_KEYS.bootstrapMonth(kind, sgg, ym);
    const cached = await this.redis.get(key);
    if (cached) {
      try {
        return JSON.parse(cached) as MonthAggregate;
      } catch {
        // rebuilt below
      }
    }
    for (let attempt = 0; ; attempt++) {
      try {
        await this.pause(this.throttle.apiMs);
        const items = await this.sync.fetchMonth(kind, sgg, ym);
        const agg = aggregateMonth(kind, ym, items, sgg);
        await this.redis.set(
          key,
          JSON.stringify(agg),
          'EX',
          COMPLEX_BOOTSTRAP.MONTH_CACHE_TTL_SECONDS,
        );
        return agg;
      } catch (err) {
        const quota = tradeApiQuotaError(err);
        const exhausted = attempt >= COMPLEX_BOOTSTRAP.API_RETRIES;
        // Retrying a used-up daily quota only burns calls: stop; the months read so far stay
        // cached (MONTH_CACHE_TTL_SECONDS), so the next run resumes after the quota resets.
        if (quota && (quota.definitive || exhausted)) {
          this.logger.warn(
            { kind, ym, err: (err as Error).message },
            'bootstrap: API quota used up',
          );
          throw new UnrecoverableError(BOOTSTRAP_QUOTA_MESSAGE);
        }
        const retryable = err instanceof TradeApiError && err.retryable;
        if (!retryable || exhausted) throw err;
        this.logger.warn({ kind, ym, attempt, err: err.message }, 'bootstrap month fetch retry');
        await this.pause(this.throttle.retryMs * (attempt + 1));
      }
    }
  }

  private async loadExisting(sgg: string): Promise<ExistingComplex[]> {
    const rows = await this.prisma.complex.findMany({
      where: { sggCode: sgg },
      select: {
        id: true,
        name: true,
        emdCode: true,
        emdName: true,
        jibun: true,
        jibunAddress: true,
        roadAddress: true,
        externalCode: true,
        builtYear: true,
        deletedAt: true,
        areaTypes: { select: { exclusiveArea: true, typeName: true, source: true } },
      },
    });
    return rows.map(({ deletedAt, areaTypes, ...r }) => ({
      ...r,
      deleted: deletedAt !== null,
      areaTypes: areaTypes.map((a) => ({ ...a, exclusiveArea: a.exclusiveArea.toNumber() })),
    }));
  }

  /**
   * Coordinates of a new 단지: its 지번 address, then its road address, through the geocoder; a
   * hit counts only inside the 시군구 and the candidate's 읍면동 (pickHit). `onFailure` is called
   * per geocoder error (it throws to abort the run when the geocoder is down).
   */
  private async locate(
    cand: Candidate,
    regions: RegionIndex,
    onFailure: () => void,
  ): Promise<{ hit: CodedHit | null; ok: boolean }> {
    let ok = true;
    for (const query of [cand.jibunAddress, cand.roadAddress]) {
      if (!query) continue;
      const hits = await this.geocode(query);
      if (hits === null) {
        ok = false;
        onFailure();
        continue;
      }
      const hit = pickHit(hits, cand, regions);
      if (hit) return { hit, ok };
    }
    return { hit: null, ok };
  }

  /** Geocoder hits with their 법정동 codes (cached by query); null when the geocoder failed. */
  private async geocode(query: string): Promise<CodedHit[] | null> {
    const key = COMPLEXES_REDIS_KEYS.bootstrapGeocode(
      createHash('sha256').update(query).digest('hex').slice(0, 32),
    );
    const cached = await this.redis.get(key);
    if (cached) {
      try {
        return JSON.parse(cached) as CodedHit[];
      } catch {
        // refetched below
      }
    }
    await this.pause(this.throttle.geocodeMs);
    let hits: CodedHit[];
    try {
      const raw = await this.geocoder.geocode(query);
      hits = [];
      for (const h of raw.slice(0, 3)) {
        const legalCode = h.legalCode ?? (await this.geocoder.legalCode(h.lat, h.lng));
        hits.push({
          lat: h.lat,
          lng: h.lng,
          roadAddress: h.roadAddress,
          jibunAddress: h.jibunAddress,
          legalCode,
        });
      }
    } catch (err) {
      if (!(err instanceof GeocoderUnavailableError)) throw err;
      this.logger.warn({ err: err.message }, 'bootstrap geocoding failed');
      return null;
    }
    await this.redis.set(
      key,
      JSON.stringify(hits),
      'EX',
      hits.length > 0
        ? COMPLEX_BOOTSTRAP.GEOCODE_CACHE_TTL_SECONDS
        : COMPLEX_BOOTSTRAP.GEOCODE_MISS_TTL_SECONDS,
    );
    return hits;
  }

  private preview(
    data: ComplexBootstrapJobData,
    rows: number,
    items: readonly PlanItem[],
    skipped: readonly Skipped[],
  ): ComplexBootstrapPreview {
    const all: ComplexBootstrapItem[] = [...items.map(toItem), ...skipped.map(skippedToItem)];
    const count = (a: ComplexBootstrapItem['action']) => all.filter((i) => i.action === a).length;
    const byWeight = (a: ComplexBootstrapItem, b: ComplexBootstrapItem) =>
      ACTION_ORDER[a.action] - ACTION_ORDER[b.action] ||
      b.saleCount + b.rentCount - (a.saleCount + a.rentCount) ||
      a.name.localeCompare(b.name, 'ko');
    const sorted = [...all].sort(byWeight);
    return {
      fromYm: data.fromYm,
      toYm: data.toYm,
      rows,
      candidates: all.length,
      toCreate: count('CREATE'),
      toUpdate: count('UPDATE'),
      unchanged: count('UNCHANGED'),
      needsLocation: count('NEEDS_LOCATION'),
      skipped: count('SKIP'),
      sample: sorted.slice(0, COMPLEX_BOOTSTRAP.SAMPLE_SIZE),
      needsLocationItems: sorted
        .filter((i) => i.action === 'NEEDS_LOCATION')
        .slice(0, COMPLEX_BOOTSTRAP.LIST_LIMIT),
      skippedItems: sorted
        .filter((i) => i.action === 'SKIP')
        .slice(0, COMPLEX_BOOTSTRAP.LIST_LIMIT),
    };
  }

  /** Creates / fills in 단지 per the plan. Items whose write lost a race become SKIP. */
  private async apply(
    items: PlanItem[],
    skippedBefore: number,
    sgg: string,
    report: (phase: ComplexBootstrapPhase, done: number, total: number) => Promise<void>,
  ): Promise<ComplexBootstrapResult> {
    const result: ComplexBootstrapResult = {
      created: 0,
      updated: 0,
      unchanged: 0,
      needsLocation: 0,
      skipped: skippedBefore,
      areaTypesCreated: 0,
      tradeSyncJobs: 0,
    };
    const writes = items.filter(
      (i) => (i.action === 'CREATE' && i.location) || (i.action === 'UPDATE' && i.complexId),
    );
    await report('write', 0, writes.length);
    let done = 0;
    for (const item of items) {
      if (item.action === 'CREATE' && item.location) {
        await this.create(item, sgg, result);
      } else if (item.action === 'UPDATE' && item.complexId) {
        await this.update(item, item.complexId, result);
      } else {
        if (item.action === 'UNCHANGED') result.unchanged += 1;
        else if (item.action === 'NEEDS_LOCATION') result.needsLocation += 1;
        else if (item.action === 'SKIP') result.skipped += 1;
        continue;
      }
      done += 1;
      if (done % 10 === 0 || done === writes.length) await report('write', done, writes.length);
    }
    if (result.created + result.updated > 0) {
      await Promise.all([
        this.cache.bump(COMPLEXES_CACHE.SEARCH),
        this.cache.bump(COMPLEXES_CACHE.POPULAR),
      ]);
    }
    return result;
  }

  private async create(item: PlanItem, sgg: string, result: ComplexBootstrapResult) {
    const c = item.candidate;
    const loc = item.location;
    if (!loc) return;
    try {
      const row = await this.prisma.complex.create({
        data: {
          name: c.name,
          assetType: AssetType.APT,
          sggCode: sgg,
          emdCode: c.emdCode,
          emdName: c.emdName,
          jibun: c.jibun?.slice(0, 20) ?? null,
          jibunAddress: c.jibunAddress,
          roadAddress: c.roadAddress,
          builtYear: c.builtYear,
          externalCode: c.externalCode,
          lat: loc.lat,
          lng: loc.lng,
          source: ComplexDataSource.TRADE_BOOTSTRAP,
          areaTypes: {
            create: item.newAreas.map((a) => ({
              exclusiveArea: a.exclusiveArea,
              typeName: a.typeName,
              source: ComplexDataSource.TRADE_BOOTSTRAP,
            })),
          },
        },
        select: { id: true },
      });
      item.complexId = row.id;
      result.created += 1;
      result.areaTypesCreated += item.newAreas.length;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // An admin registered the same 국토교통부 code meanwhile.
      item.action = 'SKIP';
      item.reason = '다른 단지에 같은 단지 코드가 등록되어 있어요';
      result.skipped += 1;
    }
  }

  /** Fills fields that are still empty right now (re-read in the transaction) and adds 평형. */
  private async update(item: PlanItem, id: string, result: ComplexBootstrapResult) {
    try {
      const outcome = await this.prisma.$transaction(async (tx) => {
        const cur = await tx.complex.findFirst({
          where: { id, deletedAt: null },
          select: {
            externalCode: true,
            emdCode: true,
            emdName: true,
            jibun: true,
            jibunAddress: true,
            roadAddress: true,
            builtYear: true,
          },
        });
        if (!cur) return null;
        const data: Prisma.ComplexUpdateInput = {};
        for (const f of PATCH_FIELDS) {
          const value = item.patch[f];
          const now = cur[f];
          if (value !== undefined && (now === null || now === '')) {
            (data as Record<string, unknown>)[f] = value;
          }
        }
        if (Object.keys(data).length > 0) await tx.complex.update({ where: { id }, data });
        const areas =
          item.newAreas.length > 0
            ? (
                await tx.complexAreaType.createMany({
                  data: item.newAreas.map((a) => ({
                    complexId: id,
                    exclusiveArea: a.exclusiveArea,
                    typeName: a.typeName,
                    source: ComplexDataSource.TRADE_BOOTSTRAP,
                  })),
                  skipDuplicates: true,
                })
              ).count
            : 0;
        return { fields: Object.keys(data).length, areas };
      });
      if (!outcome) {
        item.action = 'SKIP';
        item.reason = '처리 중에 단지가 삭제되었어요';
        result.skipped += 1;
      } else if (outcome.fields + outcome.areas === 0) {
        item.action = 'UNCHANGED';
        result.unchanged += 1;
      } else {
        result.updated += 1;
        result.areaTypesCreated += outcome.areas;
      }
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      item.action = 'SKIP';
      item.reason = '다른 단지에 같은 단지 코드가 등록되어 있어요';
      result.skipped += 1;
    }
  }

  /**
   * After a real run: rematch the trades already stored (links every month synced before), then
   * sync the months of the period that were never synced successfully for both APIs (jobs dedupe
   * by id) — re-reading months already stored would only spend the daily quota. Returns how many
   * month jobs were enqueued.
   */
  private async enqueueTradeSync(
    months: readonly number[],
    result: ComplexBootstrapResult,
    sgg: string,
  ): Promise<number> {
    if (result.created + result.updated === 0) return 0;
    await this.tradeJobs.requestRematch();
    const kinds = enumValues(TradeSyncKind);
    const runs = await this.prisma.tradeSyncRun.findMany({
      where: { sggCode: sgg, status: TradeSyncStatus.SUCCEEDED, yearMonth: { in: [...months] } },
      distinct: ['kind', 'yearMonth'],
      select: { kind: true, yearMonth: true },
    });
    const done = new Set(runs.map((r) => `${r.kind}:${r.yearMonth}`));
    let n = 0;
    for (const ym of months) {
      if (kinds.every((k) => done.has(`${k}:${ym}`))) continue;
      try {
        await this.tradeJobs.enqueueMonth(ym, kinds);
        n += 1;
      } catch (err) {
        this.logger.warn({ err, ym }, 'could not enqueue trade sync after bootstrap');
      }
    }
    return n;
  }

  private pause(ms: number): Promise<void> {
    return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
  }

  /** One bootstrap at a time per 시군구 (the lock is extended while the run lasts). */
  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const key = COMPLEXES_REDIS_KEYS.bootstrapLock(this.sggCode);
    const token = randomBytes(16).toString('hex');
    const ok = await this.redis.set(key, token, 'EX', COMPLEX_BOOTSTRAP.LOCK_TTL_SECONDS, 'NX');
    if (ok !== 'OK') throw new UnrecoverableError('another 단지 bootstrap is running');
    const heartbeat = setInterval(() => {
      this.redis
        .eval(EXTEND_LOCK_LUA, 1, key, token, String(COMPLEX_BOOTSTRAP.LOCK_TTL_SECONDS))
        .catch((err: unknown) => this.logger.warn({ err }, 'bootstrap lock extend failed'));
    }, COMPLEX_BOOTSTRAP.LOCK_HEARTBEAT_MS);
    heartbeat.unref();
    try {
      return await fn();
    } finally {
      clearInterval(heartbeat);
      await this.redis
        .eval(RELEASE_LOCK_LUA, 1, key, token)
        .catch((err: unknown) => this.logger.warn({ err }, 'bootstrap lock release failed'));
    }
  }
}
