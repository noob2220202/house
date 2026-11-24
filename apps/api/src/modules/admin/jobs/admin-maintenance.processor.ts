import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { AppConfig } from '../../../config/app-config.service';
import {
  ADMIN_JOBS,
  ADMIN_QUEUE,
  PURGE_NOTIFICATIONS_PATTERN,
  SCRUB_REPORT_CONTACTS_PATTERN,
  SYNC_NOTIFICATIONS_EVERY_MS,
} from '../constants';
import { AdminNotificationsService } from '../services/admin-notifications.service';
import { ReportsService } from '../services/reports.service';

/**
 * Admin housekeeping on its own queue: erases reporter contact data past its retention period,
 * derives back-office notifications every 5 minutes and purges expired ones daily.
 * The worker and its schedule only run when JOBS_ENABLED (off in tests; e2e calls the service).
 */
@Processor(ADMIN_QUEUE, { autorun: false })
export class AdminMaintenanceProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminMaintenanceProcessor.name);

  constructor(
    private readonly reports: ReportsService,
    private readonly notifications: AdminNotificationsService,
    private readonly config: AppConfig,
    @InjectQueue(ADMIN_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('JOBS_ENABLED')) return;
    await this.queue.upsertJobScheduler(
      ADMIN_JOBS.SCRUB_REPORT_CONTACTS,
      { pattern: SCRUB_REPORT_CONTACTS_PATTERN, tz: 'Asia/Seoul' },
      { name: ADMIN_JOBS.SCRUB_REPORT_CONTACTS, data: {} },
    );
    await this.queue.upsertJobScheduler(
      ADMIN_JOBS.SYNC_NOTIFICATIONS,
      { every: SYNC_NOTIFICATIONS_EVERY_MS },
      { name: ADMIN_JOBS.SYNC_NOTIFICATIONS, data: {} },
    );
    await this.queue.upsertJobScheduler(
      ADMIN_JOBS.PURGE_NOTIFICATIONS,
      { pattern: PURGE_NOTIFICATIONS_PATTERN, tz: 'Asia/Seoul' },
      { name: ADMIN_JOBS.PURGE_NOTIFICATIONS, data: {} },
    );
    this.worker.run().catch((err: unknown) => this.logger.error({ err }, 'worker stopped'));
  }

  async process(job: Job): Promise<Record<string, number>> {
    if (job.name === ADMIN_JOBS.SYNC_NOTIFICATIONS) {
      return { created: await this.notifications.sync() };
    }
    if (job.name === ADMIN_JOBS.PURGE_NOTIFICATIONS) {
      return { purged: await this.notifications.purgeExpired() };
    }
    if (job.name !== ADMIN_JOBS.SCRUB_REPORT_CONTACTS) {
      this.logger.warn({ name: job.name }, 'unknown admin job');
      return { scrubbed: 0 };
    }
    const scrubbed = await this.reports.scrubExpiredContacts();
    if (scrubbed > 0) this.logger.log({ count: scrubbed }, 'scrubbed expired report contacts');
    return { scrubbed };
  }
}
