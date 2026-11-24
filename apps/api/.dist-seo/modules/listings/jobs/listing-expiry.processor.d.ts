import { WorkerHost } from '@nestjs/bullmq';
import { OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { AppConfig } from '../../../config/app-config.service';
import { ListingExpiryService } from '../services/listing-expiry.service';
/**
 * cleanup worker for listing ad expiry. The worker and its repeatable schedule only run when
 * JOBS_ENABLED (off in tests; e2e calls ListingExpiryService directly).
 */
export declare class ListingExpiryProcessor extends WorkerHost implements OnApplicationBootstrap {
    private readonly expiry;
    private readonly config;
    private readonly queue;
    private readonly logger;
    constructor(expiry: ListingExpiryService, config: AppConfig, queue: Queue);
    onApplicationBootstrap(): Promise<void>;
    process(job: Job): Promise<{
        expired: number;
    }>;
}
