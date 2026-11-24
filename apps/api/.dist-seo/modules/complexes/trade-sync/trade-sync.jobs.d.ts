import { TradeSyncKind } from '@house/shared';
import type { TradeSyncJobAccepted, TradeSyncJobView } from '@house/shared';
import type { Queue } from 'bullmq';
import { AppConfig } from '../../../config/app-config.service';
/**
 * Enqueues admin-started trade-sync work on the trade-sync queue and reports its progress. Job ids
 * are derived from the parameters, so repeating a request while the job is waiting/running returns
 * the same job instead of starting a second run; a finished job is replaced by a fresh one.
 */
export declare class TradeSyncJobs {
    private readonly queue;
    private readonly config;
    private readonly logger;
    constructor(queue: Queue, config: AppConfig);
    enqueueMonth(yearMonth: number, kinds: readonly TradeSyncKind[]): Promise<TradeSyncJobAccepted>;
    enqueueRematch(fromYm?: number): Promise<TradeSyncJobAccepted>;
    /** Best effort (logged): used after 단지 edits, where the edit itself must not fail. */
    requestRematch(): Promise<void>;
    get(jobId: string): Promise<TradeSyncJobView | null>;
    private enqueue;
}
