import { type RegionListQuery, type RegionUpsertInput, type RegionView } from '@house/shared';
import type { Region } from '@prisma/client';
import { AuditService } from '../../../common/audit/audit.service';
import { CacheService } from '../../../common/cache/cache.service';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
export declare function toRegionView(r: Region): RegionView;
/**
 * 법정동 reference table (시도 → 시군구 → 읍면동 → 리) for the service region. Codes follow
 * 법정동코드 truncated per level (2/5/8/10 digits), so a child always starts with its parent.
 */
export declare class RegionsService {
    private readonly prisma;
    private readonly cache;
    private readonly config;
    private readonly audit;
    constructor(prisma: PrismaService, cache: CacheService, config: AppConfig, audit: AuditService);
    get sggCode(): string;
    list(q: RegionListQuery): Promise<RegionView[]>;
    get(code: string): Promise<RegionView>;
    /** Active 읍면동/리 of the service 시군구 (autocomplete source; ~200 rows, cached). */
    activeSubRegions(): Promise<RegionView[]>;
    /** The 읍면동 row for a complex's emdCode; throws COMPLEX_REGION_INVALID outside the 시군구. */
    requireServiceEmd(emdCode: string): Promise<Region>;
    upsert(code: string, input: RegionUpsertInput): Promise<RegionView>;
    /**
     * Idempotent upsert of the bundled 순천시 법정동 list. Names/levels/parents are refreshed;
     * admin-maintained columns (lat/lng, isActive) are left alone on existing rows.
     */
    seedDefault(): Promise<{
        upserted: number;
    }>;
}
