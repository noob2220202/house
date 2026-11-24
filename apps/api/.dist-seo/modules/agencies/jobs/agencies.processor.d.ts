import { WorkerHost } from '@nestjs/bullmq';
import { OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { AppConfig } from '../../../config/app-config.service';
import { AgencyDashboardService } from '../services/agency-dashboard.service';
/** Runs only in the worker process (JOBS_ENABLED); e2e calls AgencyDashboardService directly. */
export declare class AgenciesProcessor extends WorkerHost implements OnApplicationBootstrap {
    private readonly dashboard;
    private readonly config;
    private readonly queue;
    private readonly logger;
    constructor(dashboard: AgencyDashboardService, config: AppConfig, queue: Queue);
    onApplicationBootstrap(): Promise<void>;
    process(job: Job): Promise<{
        count: number;
    }>;
    onFailed(job: Job | undefined, err: Error): void;
    onError(err: Error): void;
}
