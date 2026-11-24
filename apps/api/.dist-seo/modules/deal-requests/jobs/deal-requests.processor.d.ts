import { WorkerHost } from '@nestjs/bullmq';
import { OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { AppConfig } from '../../../config/app-config.service';
import { DealRequestMaintenanceService } from '../services/deal-request-maintenance.service';
interface FanoutData {
    dealRequestId?: unknown;
}
/** Runs only in the worker process (JOBS_ENABLED); e2e calls the maintenance service directly. */
export declare class DealRequestsProcessor extends WorkerHost implements OnApplicationBootstrap {
    private readonly maintenance;
    private readonly config;
    private readonly queue;
    private readonly logger;
    constructor(maintenance: DealRequestMaintenanceService, config: AppConfig, queue: Queue);
    onApplicationBootstrap(): Promise<void>;
    process(job: Job<FanoutData>): Promise<{
        count: number;
    }>;
    onFailed(job: Job | undefined, err: Error): void;
    /** Without a listener, worker errors (e.g. Redis hiccups) surface as unhandled 'error' events. */
    onError(err: Error): void;
}
export {};
