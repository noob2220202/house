import { WorkerHost } from '@nestjs/bullmq';
import { type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { AppConfig } from '../../../config/app-config.service';
import { AdminNotificationsService } from '../services/admin-notifications.service';
import { ReportsService } from '../services/reports.service';
/**
 * Admin housekeeping on its own queue: erases reporter contact data past its retention period,
 * derives back-office notifications every 5 minutes and purges expired ones daily.
 * The worker and its schedule only run when JOBS_ENABLED (off in tests; e2e calls the service).
 */
export declare class AdminMaintenanceProcessor extends WorkerHost implements OnApplicationBootstrap {
    private readonly reports;
    private readonly notifications;
    private readonly config;
    private readonly queue;
    private readonly logger;
    constructor(reports: ReportsService, notifications: AdminNotificationsService, config: AppConfig, queue: Queue);
    onApplicationBootstrap(): Promise<void>;
    process(job: Job): Promise<Record<string, number>>;
}
