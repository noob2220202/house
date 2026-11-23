import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { AppConfig } from '../../../config/app-config.service';
import { AUTH_JOBS, AUTH_QUEUE } from '../auth.constants';
import { PiiScrubService } from './pii-scrub.service';

/** Daily at 04:17 KST (off-peak, off the hour). */
const PII_SCRUB_PATTERN = '17 4 * * *';

@Processor(AUTH_QUEUE)
export class AuthMaintenanceProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthMaintenanceProcessor.name);

  constructor(
    private readonly scrubber: PiiScrubService,
    private readonly config: AppConfig,
    @InjectQueue(AUTH_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('JOBS_ENABLED')) return;
    await this.queue.upsertJobScheduler(
      AUTH_JOBS.PII_SCRUB,
      { pattern: PII_SCRUB_PATTERN, tz: 'Asia/Seoul' },
      { name: AUTH_JOBS.PII_SCRUB, data: {} },
    );
  }

  async process(job: Job): Promise<{ scrubbed: number }> {
    if (job.name !== AUTH_JOBS.PII_SCRUB) {
      this.logger.warn({ name: job.name }, 'unknown auth job');
      return { scrubbed: 0 };
    }
    return { scrubbed: await this.scrubber.scrubDue() };
  }
}
