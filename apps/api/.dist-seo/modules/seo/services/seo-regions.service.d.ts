import { AssetType } from '@house/shared';
import { CacheService } from '../../../common/cache/cache.service';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { RegionsService } from '../../complexes/services/regions.service';
import { type RegionEntry } from '../seo.domain';
import type { SeoRegionIndexView, SeoRegionLandingView } from '../seo.types';
/** True when region key `key` lies in landing region `target` (an 읍·면 includes its 리). */
export declare function inRegion(key: string | null, target: string): boolean;
/**
 * 지역 data for the search landing pages (/suncheon/<지역>/<매물종류>), sitemaps and llms.txt:
 * which 읍면동/리 have listings, 단지 or 아파트 실거래, and the facts a landing page states.
 * Reads listings / 단지 / trades read-only; every number is computed from stored rows.
 */
export declare class SeoRegionsService {
    private readonly prisma;
    private readonly cache;
    private readonly config;
    private readonly regions;
    constructor(prisma: PrismaService, cache: CacheService, config: AppConfig, regions: RegionsService);
    private get sggCode();
    regionIndex(): Promise<Map<string, RegionEntry>>;
    regionName(): Promise<string>;
    index(now?: Date): Promise<SeoRegionIndexView>;
    landing(code: string, assetTypes: readonly AssetType[] | undefined, now?: Date): Promise<SeoRegionLandingView>;
    /** Per-region views (every region of the index, with 읍·면 totals including their 리). */
    private regionViews;
    private computeIndex;
    private computeLanding;
}
