import { WorkerHost } from '@nestjs/bullmq';
import { OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { AppConfig } from '../../../config/app-config.service';
import { MediaCleanupService } from '../media-cleanup.service';
import { MediaProcessingService } from '../media-processing.service';
/**
 * media-processing worker (queue owned by this module): image processing jobs and the hourly
 * orphan cleanup. The worker and the schedule only run when JOBS_ENABLED (off in tests; e2e calls
 * the services directly). Cleanup lives here rather than on the shared `cleanup` queue so no other
 * module's worker can pick up (and fail) media jobs.
 */
export declare class MediaProcessor extends WorkerHost implements OnApplicationBootstrap {
    private readonly processing;
    private readonly cleanup;
    private readonly config;
    private readonly queue;
    private readonly logger;
    constructor(processing: MediaProcessingService, cleanup: MediaCleanupService, config: AppConfig, queue: Queue);
    onApplicationBootstrap(): Promise<void>;
    process(job: Job): Promise<unknown>;
    private processImage;
}
