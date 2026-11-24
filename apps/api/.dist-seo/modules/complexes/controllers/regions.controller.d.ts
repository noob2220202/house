import type { RegionView } from '@house/shared';
import { RegionCodeParamDto, RegionListQueryDto, RegionUpsertDto } from '../dto';
import { RegionsService } from '../services/regions.service';
export declare class RegionsController {
    private readonly regions;
    constructor(regions: RegionsService);
    /** Children of `parentCode` (default: the service 시군구 → its 읍면동). */
    list(q: RegionListQueryDto): Promise<RegionView[]>;
    get(p: RegionCodeParamDto): Promise<RegionView>;
}
export declare class AdminRegionsController {
    private readonly regions;
    constructor(regions: RegionsService);
    /** Idempotent load of the bundled 순천시 법정동 list (audited inside the service). */
    seedDefault(): Promise<{
        upserted: number;
    }>;
    upsert(p: RegionCodeParamDto, dto: RegionUpsertDto): Promise<RegionView>;
}
