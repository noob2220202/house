import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { AppConfig } from '../../../config/app-config.service';
import { QUEUES } from '../../../queue/queue.constants';
import { MEDIA_JOBS, MEDIA_WORKER_CONCURRENCY, ORPHAN_CLEANUP_CRON } from '../constants';
import { MediaCleanupService } from '../media-cleanup.service';
import { MediaProcessingService, type ProcessOutcome } from '../media-processing.service';
import type { ProcessJobData } from '../media-upload.service';

/**
 * media-processing worker (queue owned by this module): image processing jobs and the hourly
 * orphan cleanup. The worker and the schedule only run when JOBS_ENABLED (off in tests; e2e calls
 * the services directly). Cleanup lives here rather than on the shared `cleanup` queue so no other
 * module's worker can pick up (and fail) media jobs.
 */
@Processor(QUEUES.MEDIA_PROCESSING, { autorun: false, concurrency: MEDIA_WORKER_CONCURRENCY })
export class MediaProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(MediaProcessor.name);

  constructor(
    private readonly processing: MediaProcessingService,
    private readonly cleanup: MediaCleanupService,
    private readonly config: AppConfig,
    @InjectQueue(QUEUES.MEDIA_PROCESSING) private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('JOBS_ENABLED')) return;
    await this.queue.upsertJobScheduler(
      MEDIA_JOBS.ORPHAN_CLEANUP,
      { pattern: ORPHAN_CLEANUP_CRON, tz: 'Asia/Seoul' },
      { name: MEDIA_JOBS.ORPHAN_CLEANUP },
    );
    this.worker.run().catch((err: unknown) => this.logger.error({ err }, 'worker stopped'));
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case MEDIA_JOBS.PROCESS:
        return this.processImage(job as Job<ProcessJobData>);
      case MEDIA_JOBS.ORPHAN_CLEANUP:
        return this.cleanup.run();
      default:
        throw new Error(`media worker cannot handle job "${job.name}"`);
    }
  }

  private async processImage(job: Job<ProcessJobData>): Promise<ProcessOutcome> {
    const { mediaId } = job.data;
    try {
      return await this.processing.processPending(mediaId);
    } catch (err) {
      // Transient failure: let BullMQ retry, but leave a FAILED row after the last attempt.
      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        await this.processing.markFailed(mediaId);
      }
      throw err;
    }
  }
}
