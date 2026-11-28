import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { AppConfig } from '../../../config/app-config.service';
import { INQUIRIES_QUEUE, INQUIRY_JOBS, SCRUB_PATTERN } from '../constants';
import { InquiryRetentionService } from '../services/inquiry-retention.service';

/** Runs only in the worker process (JOBS_ENABLED); e2e calls the retention service directly. */
@Processor(INQUIRIES_QUEUE, { autorun: false })
export class InquiriesProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(InquiriesProcessor.name);

  constructor(
    private readonly retention: InquiryRetentionService,
    private readonly config: AppConfig,
    @InjectQueue(INQUIRIES_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('JOBS_ENABLED')) return;
    await this.queue.upsertJobScheduler(
      INQUIRY_JOBS.SCRUB,
      { pattern: SCRUB_PATTERN, tz: 'Asia/Seoul' },
      { name: INQUIRY_JOBS.SCRUB, data: {} },
    );
    this.worker.run().catch((err: unknown) => this.logger.error({ err }, 'worker stopped'));
  }

  async process(job: Job): Promise<{ count: number }> {
    switch (job.name) {
      case INQUIRY_JOBS.SCRUB:
        return { count: await this.retention.scrubDue() };
      default:
        this.logger.warn({ name: job.name }, 'unknown inquiries job');
        return { count: 0 };
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, err: Error): void {
    this.logger.warn({ err, name: job?.name, id: job?.id }, 'inquiries job failed');
  }

  /** Without a listener, worker errors (e.g. Redis hiccups) surface as unhandled 'error' events. */
  @OnWorkerEvent('error')
  onError(err: Error): void {
    this.logger.error({ err }, 'inquiries worker error');
  }
}
