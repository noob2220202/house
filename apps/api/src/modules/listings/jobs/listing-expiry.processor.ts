import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { AppConfig } from '../../../config/app-config.service';
import { QUEUES } from '../../../queue/queue.constants';
import { EXPIRE_LISTING_ADS_EVERY_MS, EXPIRE_LISTING_ADS_JOB } from '../constants';
import { ListingExpiryService } from '../services/listing-expiry.service';

/**
 * cleanup worker for listing ad expiry. The worker and its repeatable schedule only run when
 * JOBS_ENABLED (off in tests; e2e calls ListingExpiryService directly).
 */
@Processor(QUEUES.CLEANUP, { autorun: false })
export class ListingExpiryProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(ListingExpiryProcessor.name);

  constructor(
    private readonly expiry: ListingExpiryService,
    private readonly config: AppConfig,
    @InjectQueue(QUEUES.CLEANUP) private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('JOBS_ENABLED')) return;
    await this.queue.upsertJobScheduler(
      EXPIRE_LISTING_ADS_JOB,
      { every: EXPIRE_LISTING_ADS_EVERY_MS },
      { name: EXPIRE_LISTING_ADS_JOB },
    );
    this.worker.run().catch((err: unknown) => this.logger.error({ err }, 'worker stopped'));
  }

  async process(job: Job): Promise<{ expired: number }> {
    if (job.name !== EXPIRE_LISTING_ADS_JOB) {
      // Another module's job on the shared queue: fail it so BullMQ retries (see openIssues).
      throw new Error(`listings cleanup worker cannot handle job "${job.name}"`);
    }
    return { expired: await this.expiry.expireDue() };
  }
}
