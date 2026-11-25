import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { enumValues, TradeSyncKind } from '@house/shared';
import type {
  TradeRematchResult,
  TradeSyncJobAccepted,
  TradeSyncJobKind,
  TradeSyncJobState,
  TradeSyncJobView,
  TradeSyncResult,
} from '@house/shared';
import type { Queue } from 'bullmq';
import { AppConfig } from '../../../config/app-config.service';
import { QUEUES } from '../../../queue/queue.constants';
import { TRADE_SYNC_JOBS } from '../constants';

const KIND_BY_NAME: Record<string, TradeSyncJobKind> = {
  [TRADE_SYNC_JOBS.MONTH]: 'MONTH',
  [TRADE_SYNC_JOBS.REMATCH]: 'REMATCH',
};

export function toJobState(raw: string): TradeSyncJobState {
  switch (raw) {
    case 'active':
    case 'delayed':
    case 'completed':
    case 'failed':
      return raw;
    default:
      return 'waiting';
  }
}

/**
 * Enqueues admin-started trade-sync work on the trade-sync queue and reports its progress. Job ids
 * are derived from the parameters, so repeating a request while the job is waiting/running returns
 * the same job instead of starting a second run; a finished job is replaced by a fresh one.
 */
@Injectable()
export class TradeSyncJobs {
  private readonly logger = new Logger(TradeSyncJobs.name);

  constructor(
    @InjectQueue(QUEUES.TRADE_SYNC) private readonly queue: Queue,
    private readonly config: AppConfig,
  ) {}

  enqueueMonth(yearMonth: number, kinds: readonly TradeSyncKind[]): Promise<TradeSyncJobAccepted> {
    // Canonical (enum) order: it is also the order the kinds are synced in.
    const order = enumValues(TradeSyncKind);
    const sorted = [...new Set(kinds)].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const sgg = this.config.get('REGION_SGG_CODE');
    return this.enqueue(TRADE_SYNC_JOBS.MONTH, `month.${sgg}.${yearMonth}.${sorted.join('+')}`, {
      yearMonth,
      kinds: sorted,
    });
  }

  enqueueRematch(fromYm?: number): Promise<TradeSyncJobAccepted> {
    const sgg = this.config.get('REGION_SGG_CODE');
    return this.enqueue(TRADE_SYNC_JOBS.REMATCH, `rematch.${sgg}.${fromYm ?? 'all'}`, {
      ...(fromYm ? { fromYm } : {}),
    });
  }

  /** Best effort (logged): used after 단지 edits, where the edit itself must not fail. */
  async requestRematch(): Promise<void> {
    try {
      await this.enqueueRematch();
    } catch (err) {
      this.logger.warn({ err }, 'could not enqueue trade rematch');
    }
  }

  async get(jobId: string): Promise<TradeSyncJobView | null> {
    const job = await this.queue.getJob(jobId);
    const kind = job ? KIND_BY_NAME[job.name] : undefined;
    if (!job || !kind) return null;
    const state = toJobState(await job.getState());
    return {
      jobId,
      kind,
      state,
      params: (job.data ?? {}) as Record<string, unknown>,
      attemptsMade: job.attemptsMade,
      result:
        state === 'completed'
          ? ((job.returnvalue ?? null) as TradeSyncResult | TradeRematchResult | null)
          : null,
      failedReason: job.failedReason ? job.failedReason.slice(0, 500) : null,
      createdAt: new Date(job.timestamp).toISOString(),
      finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
    };
  }

  private async enqueue(
    name: string,
    jobId: string,
    data: Record<string, unknown>,
  ): Promise<TradeSyncJobAccepted> {
    const kind = KIND_BY_NAME[name] as TradeSyncJobKind;
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state !== 'completed' && state !== 'failed') {
        return { jobId, kind, state: toJobState(state) };
      }
      // Finished: replace it (removal of a job that just got picked up fails; add() then dedupes).
      await existing.remove().catch(() => undefined);
    }
    const job = await this.queue.add(name, data, { jobId });
    return { jobId: job.id ?? jobId, kind, state: toJobState(await job.getState()) };
  }
}
