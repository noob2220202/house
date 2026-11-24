import { WorkerHost } from '@nestjs/bullmq';
import { OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { AppConfig } from '../../../config/app-config.service';
import { PiiScrubService } from './pii-scrub.service';
/** Runs only in the worker process (JOBS_ENABLED); e2e calls PiiScrubService directly. */
export declare class AuthMaintenanceProcessor extends WorkerHost implements OnApplicationBootstrap {
    private readonly scrubber;
    private readonly config;
    private readonly queue;
    private readonly logger;
    constructor(scrubber: PiiScrubService, config: AppConfig, queue: Queue);
    onApplicationBootstrap(): Promise<void>;
    process(job: Job): Promise<{
        scrubbed: number;
    }>;
}
