import type { Paginated, TradeSyncJobAccepted, TradeSyncJobView, TradeSyncRunView } from '@house/shared';
import { AuditService } from '../../../common/audit/audit.service';
import { TradeRematchRequestDto, TradeSyncJobParamDto, TradeSyncRequestDto, TradeSyncRunsQueryDto } from '../dto';
import { TradeSyncJobs } from '../trade-sync/trade-sync.jobs';
import { TradeSyncService } from '../trade-sync/trade-sync.service';
/**
 * Manual 실거래가 sync / rematch. Both run as jobs on the trade-sync queue (a sync can take far
 * longer than the proxy timeout): the POST answers 202 with the job id, the admin polls
 * GET jobs/:jobId (result) or GET runs (per-kind run records).
 */
export declare class AdminTradeSyncController {
    private readonly sync;
    private readonly jobs;
    private readonly audit;
    constructor(sync: TradeSyncService, jobs: TradeSyncJobs, audit: AuditService);
    run(dto: TradeSyncRequestDto): Promise<TradeSyncJobAccepted>;
    runs(q: TradeSyncRunsQueryDto): Promise<Paginated<TradeSyncRunView>>;
    job(p: TradeSyncJobParamDto): Promise<TradeSyncJobView>;
    rematch(dto: TradeRematchRequestDto): Promise<TradeSyncJobAccepted>;
}
