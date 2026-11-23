import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { AppConfig } from '../../../config/app-config.service';
import { QUEUES } from '../../../queue/queue.constants';
import { FLUSH_VIEW_COUNTS_EVERY_MS, FLUSH_VIEW_COUNTS_JOB } from '../constants';
import { ListingViewsService } from '../services/listing-views.service';

/**
 * counters-flush worker for listing view totals (Redis → listings.view_count). The worker and its
 * repeatable schedule only run when JOBS_ENABLED (off in tests; e2e calls the service directly).
 */
@Processor(QUEUES.COUNTERS_FLUSH, { autorun: false })
export class ListingCountersProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(ListingCountersProcessor.name);

  constructor(
    private readonly views: ListingViewsService,
    private readonly config: AppConfig,
    @InjectQueue(QUEUES.COUNTERS_FLUSH) private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('JOBS_ENABLED')) return;
    await this.queue.upsertJobScheduler(
      FLUSH_VIEW_COUNTS_JOB,
      { every: FLUSH_VIEW_COUNTS_EVERY_MS },
      { name: FLUSH_VIEW_COUNTS_JOB },
    );
    this.worker.run().catch((err: unknown) => this.logger.error({ err }, 'worker stopped'));
  }

  async process(job: Job): Promise<{ flushed: number }> {
    if (job.name !== FLUSH_VIEW_COUNTS_JOB) {
      // Another module's job on the shared queue: fail it so BullMQ retries (see openIssues).
      throw new Error(`listings counters worker cannot handle job "${job.name}"`);
    }
    return { flushed: await this.views.flush() };
  }
}
