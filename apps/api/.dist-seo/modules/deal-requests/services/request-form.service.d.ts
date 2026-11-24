import { type Paginated } from '@house/shared';
import { CacheService } from '../../../common/cache/cache.service';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AddressMatchQuery, TargetAgencyQuery } from '../dto';
import { type DealRequestMediaPort } from '../ports/media.port';
import { RegionNamesService } from './region-names.service';
/** Agency card of the request form's picker / reach count (web `agencyBriefSchema`). */
export interface TargetAgencyView {
    id: string;
    name: string;
    representativeName: string;
    phone: string;
    roadAddress: string;
    /** "아파트·오피스텔 전문" from the office's specialties; null when none. */
    specialty: string | null;
    activeListingCount: number;
    /** Not measured yet (always null). */
    avgResponseMinutes: number | null;
    logoUrl: string | null;
}
export interface TargetAgencyPage extends Paginated<TargetAgencyView> {
    /** Names of the requested areas ("조례동·연향동"), null without codes. */
    areaLabel: string | null;
}
export interface AddressMatchView {
    emdCode: string | null;
    emdName: string | null;
    lat: number | null;
    lng: number | null;
    complex: {
        id: string;
        name: string;
        emdName: string | null;
        households: number | null;
        builtYear: number | null;
        floorsMax: number | null;
        areaTypes: {
            id: string;
            pyeongLabel: string | null;
            exclusiveArea: number;
            supplyArea: number | null;
        }[];
        market: {
            recentTradePrice: number | null;
            /** "2026-10" */
            recentTradeYm: string | null;
            recentTradePyeong: string | null;
            askingMin: number | null;
            askingMax: number | null;
            /** 만원 / 평 (공급면적) of the latest trade. */
            perPyeong: number | null;
        } | null;
    } | null;
}
/**
 * Lookups of the 내놓기 / 구하기 form (public): which offices a request reaches
 * (`ALL_AGENCIES_IN_REGION` = every APPROVED office of the service 시군구, the same rule as the
 * inbox) and which registered complex a postcode result is. Read-only; cached in Redis.
 */
export declare class RequestFormService {
    private readonly prisma;
    private readonly config;
    private readonly cache;
    private readonly regionNames;
    private readonly media;
    constructor(prisma: PrismaService, config: AppConfig, cache: CacheService, regionNames: RegionNamesService, media: DealRequestMediaPort);
    targetAgencies(q: TargetAgencyQuery): Promise<TargetAgencyPage>;
    private loadTargets;
    private toTarget;
    addressMatch(q: AddressMatchQuery): Promise<AddressMatchView>;
    private loadMatch;
    /**
     * The registered complex of a postcode result: same road name + building number, else the same
     * building name (spaces ignored) in the 읍면동 of `bcode` (or the service 시군구).
     */
    private findComplexId;
    /** Latest 매매 실거래 + asking range of the complex's advertised 매매 listings. */
    private market;
}
