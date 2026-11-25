import { InjectQueue } from '@nestjs/bullmq';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ErrorCode,
  type ComplexBootstrapAccepted,
  type ComplexBootstrapJobView,
  type ComplexBootstrapPreview,
  type ComplexBootstrapProgress,
  type ComplexBootstrapRequest,
} from '@house/shared';
import type { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { AppException } from '../../../common/errors/app.exception';
import { AppConfig } from '../../../config/app-config.service';
import { QUEUES } from '../../../queue/queue.constants';
import { InjectRedis } from '../../../redis/redis.constants';
import { COMPLEX_BOOTSTRAP, COMPLEXES_REDIS_KEYS, TRADE_SYNC_JOBS } from '../constants';
import { toJobState } from '../trade-sync/trade-sync.jobs';
import {
  bootstrapRange,
  ComplexBootstrapService,
  type ComplexBootstrapJobData,
  type ComplexBootstrapJobResult,
} from './complex-bootstrap.service';

const QUEUED: ComplexBootstrapProgress = { phase: 'queued', done: 0, total: 0, percent: 0 };

function isProgress(v: unknown): v is ComplexBootstrapProgress {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as ComplexBootstrapProgress).phase === 'string' &&
    typeof (v as ComplexBootstrapProgress).percent === 'number'
  );
}

/**
 * Enqueues 단지 bootstrap runs on the trade-sync queue (job `complexes:bootstrap`, id
 * "bootstrap.<epoch ms>") and reports them. Only one run per 시군구 may be waiting or active:
 * the latest job id is kept in Redis and a new request while it is unfinished answers 409.
 */
@Injectable()
export class ComplexBootstrapJobs {
  constructor(
    @InjectQueue(QUEUES.TRADE_SYNC) private readonly queue: Queue,
    @InjectRedis() private readonly redis: Redis,
    private readonly config: AppConfig,
    private readonly bootstrap: ComplexBootstrapService,
  ) {}

  async enqueue(
    input: ComplexBootstrapRequest,
    now: Date = new Date(),
  ): Promise<ComplexBootstrapAccepted> {
    if (!this.bootstrap.configured) {
      throw new AppException(ErrorCode.COMPLEX_BOOTSTRAP_NOT_CONFIGURED, {
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    }
    const sgg = this.config.get('REGION_SGG_CODE');
    const mutex = COMPLEXES_REDIS_KEYS.bootstrapEnqueue(sgg);
    if ((await this.redis.set(mutex, '1', 'EX', 10, 'NX')) !== 'OK') throw this.inProgress();
    try {
      const current = await this.latestJob();
      if (current) {
        const state = await current.getState();
        if (state !== 'completed' && state !== 'failed' && state !== 'unknown') {
          throw this.inProgress();
        }
      }
      const data: ComplexBootstrapJobData = {
        months: input.months,
        dryRun: input.dryRun,
        ...bootstrapRange(input.months, now),
      };
      const jobId = `bootstrap.${now.getTime()}`;
      const job = await this.queue.add(TRADE_SYNC_JOBS.BOOTSTRAP, data, { jobId });
      await this.redis.set(
        COMPLEXES_REDIS_KEYS.bootstrapCurrent(sgg),
        jobId,
        'EX',
        COMPLEX_BOOTSTRAP.CURRENT_TTL_SECONDS,
      );
      return {
        jobId,
        state: toJobState(await job.getState()),
        dryRun: data.dryRun,
        months: data.months,
      };
    } finally {
      await this.redis.del(mutex);
    }
  }

  async get(jobId: string): Promise<ComplexBootstrapJobView | null> {
    const job = await this.queue.getJob(jobId);
    if (!job || job.name !== TRADE_SYNC_JOBS.BOOTSTRAP) return null;
    const status = toJobState(await job.getState());
    const data = job.data as ComplexBootstrapJobData;
    const value =
      status === 'completed'
        ? ((job.returnvalue ?? null) as ComplexBootstrapJobResult | null)
        : null;
    let preview: ComplexBootstrapPreview | null = value?.preview ?? null;
    if (!preview) {
      const raw = await this.redis.get(COMPLEXES_REDIS_KEYS.bootstrapPreview(jobId));
      preview = raw ? (JSON.parse(raw) as ComplexBootstrapPreview) : null;
    }
    const progress: ComplexBootstrapProgress =
      status === 'completed'
        ? { phase: 'done', done: 1, total: 1, percent: 100 }
        : isProgress(job.progress)
          ? job.progress
          : QUEUED;
    return {
      jobId,
      status,
      dryRun: data.dryRun,
      months: data.months,
      fromYm: data.fromYm,
      toYm: data.toYm,
      progress,
      preview,
      result: value?.result ?? null,
      failedReason: job.failedReason ? job.failedReason.slice(0, 500) : null,
      createdAt: new Date(job.timestamp).toISOString(),
      finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
    };
  }

  /** The latest run of the 시군구 (whatever its state), or null. */
  async latest(): Promise<ComplexBootstrapJobView | null> {
    const job = await this.latestJob();
    return job?.id ? this.get(job.id) : null;
  }

  private async latestJob() {
    const id = await this.redis.get(
      COMPLEXES_REDIS_KEYS.bootstrapCurrent(this.config.get('REGION_SGG_CODE')),
    );
    return id ? ((await this.queue.getJob(id)) ?? null) : null;
  }

  private inProgress(): AppException {
    return new AppException(ErrorCode.COMPLEX_BOOTSTRAP_IN_PROGRESS, {
      status: HttpStatus.CONFLICT,
    });
  }
}
