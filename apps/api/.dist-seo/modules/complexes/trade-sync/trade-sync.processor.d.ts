import { WorkerHost } from '@nestjs/bullmq';
import { OnApplicationBootstrap } from '@nestjs/common';
import { TradeSyncKind } from '@house/shared';
import type { Job, Queue } from 'bullmq';
import { AppConfig } from '../../../config/app-config.service';
import { ComplexPopularityService } from '../services/complex-popularity.service';
import { TradeSyncService } from './trade-sync.service';
export interface TradeSyncMonthJobData {
    yearMonth: number;
    kinds?: TradeSyncKind[];
}
export interface TradeRematchJobData {
    fromYm?: number;
}
/**
 * Worker for the trade-sync queue (owned by complexes): the repeatable 실거래가 sync, admin-started
 * month syncs and rematches, and the complex view-count flush. Runs only when JOBS_ENABLED (e2e
 * processes jobs by calling process()).
 */
export declare class TradeSyncProcessor extends WorkerHost implements OnApplicationBootstrap {
    private readonly sync;
    private readonly popularity;
    private readonly config;
    private readonly queue;
    private readonly logger;
    constructor(sync: TradeSyncService, popularity: ComplexPopularityService, config: AppConfig, queue: Queue);
    onApplicationBootstrap(): Promise<void>;
    process(job: Job): Promise<unknown>;
    /** Current month (partial) plus the lookback months, oldest first. Failures retry the job. */
    syncRecentMonths(now: Date): Promise<{
        months: number[];
        skipped?: string;
    }>;
}
