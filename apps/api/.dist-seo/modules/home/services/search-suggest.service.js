"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SearchSuggestService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchSuggestService = exports.SuggestionType = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const cache_service_1 = require("../../../common/cache/cache.service");
const app_config_service_1 = require("../../../config/app-config.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
const complex_popularity_service_1 = require("../../complexes/services/complex-popularity.service");
const complex_search_service_1 = require("../../complexes/services/complex-search.service");
const regions_service_1 = require("../../complexes/services/regions.service");
const constants_1 = require("../constants");
const home_stats_service_1 = require("./home-stats.service");
exports.SuggestionType = { REGION: 'REGION', COMPLEX: 'COMPLEX', AGENCY: 'AGENCY' };
const POPULAR_REGION_KEYWORDS = 3;
const POPULAR_COMPLEX_KEYWORDS = 2;
/** "%…%" pattern with LIKE metacharacters escaped. */
function likePattern(term) {
    return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
const stripSido = (address) => address.replace(/^(전남광주통합특별시|전라남도|전남)\s+/, '');
/**
 * Autocomplete of the site search fields: 지역 (읍면동/리), 단지 and 중개사무소, in that order,
 * cut to `limit`. 지역 and 단지 reuse the complexes autocomplete (trigram + 초성).
 */
let SearchSuggestService = SearchSuggestService_1 = class SearchSuggestService {
    constructor(prisma, cache, config, regions, complexSearch, complexPopularity, homeStats) {
        this.prisma = prisma;
        this.cache = cache;
        this.config = config;
        this.regions = regions;
        this.complexSearch = complexSearch;
        this.complexPopularity = complexPopularity;
        this.homeStats = homeStats;
        this.logger = new common_1.Logger(SearchSuggestService_1.name);
    }
    async suggest(q) {
        const popular = await this.popularKeywords();
        if (q.q === '')
            return { items: [], popular };
        const items = await this.cache.getOrSet(`cache:home:suggest:${q.limit}:${encodeURIComponent(q.q.toLowerCase())}`, constants_1.HOME_CACHE_TTL_SECONDS.SUGGEST, () => this.items(q.q, q.limit));
        return { items, popular };
    }
    async items(term, limit) {
        const [ac, agencies, subRegions, sggName] = await Promise.all([
            this.complexSearch.autocomplete({ q: term, limit }),
            this.agencies(term, limit),
            this.regions.activeSubRegions(),
            this.homeStats.regionName(),
        ]);
        const names = new Map(subRegions.map((r) => [r.code, r.name]));
        const regionItems = ac.regions.map((r) => ({
            type: exports.SuggestionType.REGION,
            id: r.code,
            label: r.name,
            description: [sggName, r.level === 'RI' && r.parentCode ? names.get(r.parentCode) : null]
                .filter(Boolean)
                .join(' ') || null,
            lat: r.lat,
            lng: r.lng,
        }));
        const complexItems = ac.complexes.map((c) => ({
            type: exports.SuggestionType.COMPLEX,
            id: c.id,
            label: c.name,
            description: [c.emdName, c.households ? `${c.households.toLocaleString('ko-KR')}세대` : null]
                .filter(Boolean)
                .join(' · ') || null,
            lat: c.lat,
            lng: c.lng,
        }));
        return [...regionItems, ...complexItems, ...agencies].slice(0, limit);
    }
    /** Approved offices of the service region whose name or address contains the term. */
    async agencies(term, limit) {
        const like = likePattern(term);
        const prefix = `${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
        const rows = await this.prisma.$queryRaw `
      SELECT a.id, a.name, a.road_address AS "roadAddress", a.lat, a.lng
      FROM agencies a
      WHERE a.status = ${shared_1.AgencyStatus.APPROVED}::agency_status AND a.deleted_at IS NULL
        AND a.sgg_code = ${this.config.get('REGION_SGG_CODE')}
        AND (a.name ILIKE ${like} OR a.road_address ILIKE ${like})
      ORDER BY (a.name ILIKE ${prefix}) DESC, (a.name ILIKE ${like}) DESC,
        a.active_listing_count DESC, a.id ASC
      LIMIT ${limit}`;
        return rows.map((a) => ({
            type: exports.SuggestionType.AGENCY,
            id: a.id,
            label: a.name,
            description: stripSido(a.roadAddress),
            lat: a.lat,
            lng: a.lng,
        }));
    }
    /** Names of the most viewed 지역 this week and the most popular 단지 (deduplicated). */
    popularKeywords() {
        return this.cache.getOrSet(`cache:home:popular-keywords:${this.config.get('REGION_SGG_CODE')}`, constants_1.HOME_CACHE_TTL_SECONDS.POPULAR_KEYWORDS, async () => {
            try {
                const [regions, complexes] = await Promise.all([
                    this.homeStats.popularRegions({ limit: POPULAR_REGION_KEYWORDS }),
                    this.complexPopularity.popular({ limit: POPULAR_COMPLEX_KEYWORDS }),
                ]);
                return [
                    ...new Set([...regions.items.map((r) => r.name), ...complexes.map((c) => c.name)]),
                ];
            }
            catch (err) {
                this.logger.warn({ err }, 'popular keywords failed');
                return [];
            }
        });
    }
};
exports.SearchSuggestService = SearchSuggestService;
exports.SearchSuggestService = SearchSuggestService = SearchSuggestService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService,
        app_config_service_1.AppConfig,
        regions_service_1.RegionsService,
        complex_search_service_1.ComplexSearchService,
        complex_popularity_service_1.ComplexPopularityService,
        home_stats_service_1.HomeStatsService])
], SearchSuggestService);
//# sourceMappingURL=search-suggest.service.js.map