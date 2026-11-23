import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { AppConfig } from '../../../config/app-config.service';
import { QUEUES } from '../../../queue/queue.constants';
import { BANNER_STATS_FLUSH_EVERY_MS, BANNER_STATS_FLUSH_JOB } from '../constants';
import { AdTrackingService } from '../services/ad-tracking.service';

/**
 * banner-stats worker: flushes Redis impression/click sets into banner_stat_daily. The worker
 * and its repeatable schedule only run when JOBS_ENABLED (off in tests; e2e calls flush()).
 */
@Processor(QUEUES.BANNER_STATS, { autorun: false })
export class BannerStatsProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(BannerStatsProcessor.name);

  constructor(
    private readonly tracking: AdTrackingService,
    private readonly config: AppConfig,
    @InjectQueue(QUEUES.BANNER_STATS) private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('JOBS_ENABLED')) return;
    await this.queue.upsertJobScheduler(
      BANNER_STATS_FLUSH_JOB,
      { every: BANNER_STATS_FLUSH_EVERY_MS },
      { name: BANNER_STATS_FLUSH_JOB },
    );
    this.worker.run().catch((err: unknown) => this.logger.error({ err }, 'worker stopped'));
  }

  async process(job: Job): Promise<{ written: number }> {
    if (job.name !== BANNER_STATS_FLUSH_JOB) {
      throw new Error(`banner-stats worker cannot handle job "${job.name}"`);
    }
    return { written: await this.tracking.flush() };
  }
}
