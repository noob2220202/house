import type { AgencyMapResult, AgencyProfile, AgencySearchItem, Paginated } from '@house/shared';
import { AgencyMapQueryDto, AgencySearchQueryDto, IdParamDto } from '../dto';
import { AgencyPublicService, type AgencyRegionFacet } from '../services/agency-public.service';
/** 중개사무소 찾기 (public): list search, map, profile. Only APPROVED agencies are visible. */
export declare class AgenciesController {
    private readonly agencies;
    constructor(agencies: AgencyPublicService);
    search(q: AgencySearchQueryDto): Promise<Paginated<AgencySearchItem>>;
    /** 읍면동 facet (code, name, office count) for the 지역 filter. Before `:id`. */
    regions(): Promise<AgencyRegionFacet>;
    map(q: AgencyMapQueryDto): Promise<AgencyMapResult>;
    profile(p: IdParamDto): Promise<AgencyProfile>;
}
