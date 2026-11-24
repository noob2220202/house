import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { AppConfig } from '../../../config/app-config.service';
import { AGENCIES_QUEUE, AGENCY_JOBS, DAILY_STATS_PATTERN } from '../constants';
import { AgencyDashboardService } from '../services/agency-dashboard.service';

/** Runs only in the worker process (JOBS_ENABLED); e2e calls AgencyDashboardService directly. */
@Processor(AGENCIES_QUEUE, { autorun: false })
export class AgenciesProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(AgenciesProcessor.name);

  constructor(
    private readonly dashboard: AgencyDashboardService,
    private readonly config: AppConfig,
    @InjectQueue(AGENCIES_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('JOBS_ENABLED')) return;
    await this.queue.upsertJobScheduler(
      AGENCY_JOBS.DAILY_STATS,
      { pattern: DAILY_STATS_PATTERN, tz: 'Asia/Seoul' },
      { name: AGENCY_JOBS.DAILY_STATS, data: {} },
    );
    this.worker.run().catch((err: unknown) => this.logger.error({ err }, 'worker stopped'));
  }

  async process(job: Job): Promise<{ count: number }> {
    switch (job.name) {
      case AGENCY_JOBS.DAILY_STATS:
        return { count: await this.dashboard.snapshot() };
      default:
        this.logger.warn({ name: job.name }, 'unknown agencies job');
        return { count: 0 };
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, err: Error): void {
    this.logger.warn({ err, name: job?.name, id: job?.id }, 'agencies job failed');
  }

  @OnWorkerEvent('error')
  onError(err: Error): void {
    this.logger.error({ err }, 'agencies worker error');
  }
}
