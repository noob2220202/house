import { type AdminComplexListItem, type AdminComplexListQuery, type AdminComplexView, type ComplexAreaTypeInput, type ComplexAreaTypeUpdate, type ComplexAreaTypeView, type ComplexCreateInput, type ComplexPhotosInput, type ComplexPhotoView, type ComplexUpdateInput, type Paginated } from '@house/shared';
import { CacheService } from '../../../common/cache/cache.service';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { type ComplexMediaPort } from '../ports/complex-media.port';
import { TradeStatsService } from '../trade-sync/trade-stats.service';
import { TradeSyncJobs } from '../trade-sync/trade-sync.jobs';
import { ComplexQueryService } from './complex-query.service';
import { RegionsService } from './regions.service';
/** Admin CRUD for 단지, 평형 and 단지 photos. Every mutation is audited by the controller. */
export declare class ComplexAdminService {
    private readonly prisma;
    private readonly regions;
    private readonly query;
    private readonly stats;
    private readonly cache;
    private readonly config;
    private readonly jobs;
    private readonly media;
    constructor(prisma: PrismaService, regions: RegionsService, query: ComplexQueryService, stats: TradeStatsService, cache: CacheService, config: AppConfig, jobs: TradeSyncJobs, media: ComplexMediaPort);
    list(q: AdminComplexListQuery): Promise<Paginated<AdminComplexListItem>>;
    get(id: string): Promise<AdminComplexView>;
    create(input: ComplexCreateInput): Promise<AdminComplexView>;
    update(id: string, input: ComplexUpdateInput): Promise<AdminComplexView>;
    remove(id: string): Promise<void>;
    addAreaType(id: string, input: ComplexAreaTypeInput): Promise<ComplexAreaTypeView>;
    updateAreaType(id: string, areaTypeId: string, input: ComplexAreaTypeUpdate): Promise<ComplexAreaTypeView>;
    removeAreaType(id: string, areaTypeId: string): Promise<void>;
    /** Replaces the photo list (order = array order). */
    setPhotos(id: string, input: ComplexPhotosInput): Promise<ComplexPhotoView[]>;
    private requireComplex;
    /**
     * Re-assigns every trade of the 단지 to its nearest 평형 within the tolerance (ties → lowest id,
     * as ComplexMatcher.areaTypeFor) and rebuilds the 단지's stats, which are grouped by the 평형's
     * 전용면적. Call inside the transaction that changed the 평형 (stats lock already held).
     */
    private reassignAreaTypes;
    private invalidate;
    /**
     * emdCode → validated 읍면동; emdName / jibun default to what the 지번주소 says (that is how
     * 국토교통부 reports them), else the 읍면동 name.
     */
    private resolveLocation;
    private scalarData;
}
