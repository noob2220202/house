import { WorkerHost } from '@nestjs/bullmq';
import { OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { AppConfig } from '../../../config/app-config.service';
import { ListingViewsService } from '../services/listing-views.service';
/**
 * counters-flush worker for listing view totals (Redis → listings.view_count). The worker and its
 * repeatable schedule only run when JOBS_ENABLED (off in tests; e2e calls the service directly).
 */
export declare class ListingCountersProcessor extends WorkerHost implements OnApplicationBootstrap {
    private readonly views;
    private readonly config;
    private readonly queue;
    private readonly logger;
    constructor(views: ListingViewsService, config: AppConfig, queue: Queue);
    onApplicationBootstrap(): Promise<void>;
    process(job: Job): Promise<{
        flushed: number;
    }>;
}
