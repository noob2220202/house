import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { AppConfig } from '../../../config/app-config.service';
import {
  DEAL_REQUEST_JOBS,
  DEAL_REQUESTS_QUEUE,
  EXPIRE_PATTERN,
  SCRUB_PATTERN,
} from '../constants';
import { DealRequestMaintenanceService } from '../services/deal-request-maintenance.service';

interface FanoutData {
  dealRequestId?: unknown;
}

/** Runs only in the worker process (JOBS_ENABLED); e2e calls the maintenance service directly. */
@Processor(DEAL_REQUESTS_QUEUE, { autorun: false })
export class DealRequestsProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(DealRequestsProcessor.name);

  constructor(
    private readonly maintenance: DealRequestMaintenanceService,
    private readonly config: AppConfig,
    @InjectQueue(DEAL_REQUESTS_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('JOBS_ENABLED')) return;
    await this.queue.upsertJobScheduler(
      DEAL_REQUEST_JOBS.EXPIRE,
      { pattern: EXPIRE_PATTERN, tz: 'Asia/Seoul' },
      { name: DEAL_REQUEST_JOBS.EXPIRE, data: {} },
    );
    await this.queue.upsertJobScheduler(
      DEAL_REQUEST_JOBS.SCRUB,
      { pattern: SCRUB_PATTERN, tz: 'Asia/Seoul' },
      { name: DEAL_REQUEST_JOBS.SCRUB, data: {} },
    );
    this.worker.run().catch((err: unknown) => this.logger.error({ err }, 'worker stopped'));
  }

  async process(job: Job<FanoutData>): Promise<{ count: number }> {
    switch (job.name) {
      case DEAL_REQUEST_JOBS.FANOUT: {
        const id = job.data.dealRequestId;
        if (typeof id !== 'string') return { count: 0 };
        return { count: await this.maintenance.fanout(id) };
      }
      case DEAL_REQUEST_JOBS.EXPIRE:
        return { count: await this.maintenance.expireDue() };
      case DEAL_REQUEST_JOBS.SCRUB:
        return { count: await this.maintenance.scrubDue() };
      default:
        this.logger.warn({ name: job.name }, 'unknown deal-requests job');
        return { count: 0 };
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, err: Error): void {
    this.logger.warn({ err, name: job?.name, id: job?.id }, 'deal-requests job failed');
  }

  /** Without a listener, worker errors (e.g. Redis hiccups) surface as unhandled 'error' events. */
  @OnWorkerEvent('error')
  onError(err: Error): void {
    this.logger.error({ err }, 'deal-requests worker error');
  }
}
