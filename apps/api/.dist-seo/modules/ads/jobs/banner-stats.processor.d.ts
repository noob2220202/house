import { WorkerHost } from '@nestjs/bullmq';
import { OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { AppConfig } from '../../../config/app-config.service';
import { AdTrackingService } from '../services/ad-tracking.service';
/**
 * banner-stats worker: flushes Redis impression/click sets into banner_stat_daily. The worker
 * and its repeatable schedule only run when JOBS_ENABLED (off in tests; e2e calls flush()).
 */
export declare class BannerStatsProcessor extends WorkerHost implements OnApplicationBootstrap {
    private readonly tracking;
    private readonly config;
    private readonly queue;
    private readonly logger;
    constructor(tracking: AdTrackingService, config: AppConfig, queue: Queue);
    onApplicationBootstrap(): Promise<void>;
    process(job: Job): Promise<{
        written: number;
    }>;
}
