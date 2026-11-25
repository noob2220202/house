import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  addMonths,
  enumValues,
  isEnumValue,
  isValidYearMonth,
  TradeSyncKind,
  yearMonthOf,
  yearMonthRange,
} from '@house/shared';
import type { Job, Queue } from 'bullmq';
import { AppConfig } from '../../../config/app-config.service';
import { QUEUES } from '../../../queue/queue.constants';
import {
  FLUSH_VIEWS_EVERY_MS,
  TRADE_SYNC_CRON,
  TRADE_SYNC_JOBS,
  TRADE_SYNC_LOOKBACK_MONTHS,
  TRADE_SYNC_TZ,
} from '../constants';
import { ComplexBootstrapService } from '../bootstrap/complex-bootstrap.service';
import { ComplexPopularityService } from '../services/complex-popularity.service';
import { TradeSyncService } from './trade-sync.service';

export interface TradeSyncMonthJobData {
  yearMonth: number;
  kinds?: TradeSyncKind[];
}

export interface TradeRematchJobData {
  fromYm?: number;
}

/**
 * Worker for the trade-sync queue (owned by complexes): the repeatable 실거래가 sync, admin-started
 * month syncs, rematches and 단지 bootstraps, and the complex view-count flush. Runs only when JOBS_ENABLED (e2e
 * processes jobs by calling process()).
 */
@Processor(QUEUES.TRADE_SYNC, { autorun: false, concurrency: 2 })
export class TradeSyncProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(TradeSyncProcessor.name);

  constructor(
    private readonly sync: TradeSyncService,
    private readonly popularity: ComplexPopularityService,
    private readonly bootstrap: ComplexBootstrapService,
    private readonly config: AppConfig,
    @InjectQueue(QUEUES.TRADE_SYNC) private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('JOBS_ENABLED')) return;
    await this.queue.upsertJobScheduler(
      TRADE_SYNC_JOBS.MONTHLY,
      { pattern: TRADE_SYNC_CRON, tz: TRADE_SYNC_TZ },
      { name: TRADE_SYNC_JOBS.MONTHLY },
    );
    await this.queue.upsertJobScheduler(
      TRADE_SYNC_JOBS.FLUSH_VIEWS,
      { every: FLUSH_VIEWS_EVERY_MS },
      { name: TRADE_SYNC_JOBS.FLUSH_VIEWS, opts: { attempts: 1 } },
    );
    this.worker.run().catch((err: unknown) => this.logger.error({ err }, 'worker stopped'));
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case TRADE_SYNC_JOBS.FLUSH_VIEWS:
        return { flushed: await this.popularity.flush() };
      case TRADE_SYNC_JOBS.MONTHLY:
        return this.syncRecentMonths(new Date());
      case TRADE_SYNC_JOBS.MONTH: {
        const data = parseMonthJob(job.data);
        return this.sync.syncMonth({
          yearMonth: data.yearMonth,
          kinds: data.kinds ?? enumValues(TradeSyncKind),
        });
      }
      case TRADE_SYNC_JOBS.REMATCH:
        return this.sync.rematch(parseRematchJob(job.data).fromYm);
      case TRADE_SYNC_JOBS.BOOTSTRAP:
        return this.bootstrap.process(job);
      default:
        throw new Error(`trade-sync worker cannot handle job "${job.name}"`);
    }
  }

  /** Current month (partial) plus the lookback months, oldest first. Failures retry the job. */
  async syncRecentMonths(now: Date): Promise<{ months: number[]; skipped?: string }> {
    if (!this.sync.configured) {
      this.logger.warn('DATA_GO_KR_SERVICE_KEY not set; skipping 실거래가 sync');
      return { months: [], skipped: 'not configured' };
    }
    const current = yearMonthOf(now);
    const months = yearMonthRange(addMonths(current, -TRADE_SYNC_LOOKBACK_MONTHS), current);
    for (const yearMonth of months) {
      await this.sync.syncMonth({ yearMonth, kinds: enumValues(TradeSyncKind), now });
    }
    return { months };
  }
}

function parseMonthJob(data: unknown): TradeSyncMonthJobData {
  const d = (data ?? {}) as { yearMonth?: unknown; kinds?: unknown };
  if (typeof d.yearMonth !== 'number' || !isValidYearMonth(d.yearMonth)) {
    throw new Error('invalid trade-sync month job payload');
  }
  const kinds = Array.isArray(d.kinds)
    ? d.kinds.filter((k): k is TradeSyncKind => isEnumValue(TradeSyncKind, k))
    : undefined;
  return { yearMonth: d.yearMonth, kinds: kinds && kinds.length > 0 ? kinds : undefined };
}

function parseRematchJob(data: unknown): TradeRematchJobData {
  const d = (data ?? {}) as { fromYm?: unknown };
  if (d.fromYm === undefined || d.fromYm === null) return {};
  if (typeof d.fromYm !== 'number' || !isValidYearMonth(d.fromYm)) {
    throw new Error('invalid trade-sync rematch job payload');
  }
  return { fromYm: d.fromYm };
}
