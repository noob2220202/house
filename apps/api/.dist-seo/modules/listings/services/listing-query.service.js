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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingQueryService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const cache_service_1 = require("../../../common/cache/cache.service");
const app_exception_1 = require("../../../common/errors/app.exception");
const pagination_1 = require("../../../common/pagination/pagination");
const prisma_service_1 = require("../../../prisma/prisma.service");
const constants_1 = require("../constants");
const map_tiles_1 = require("../domain/map-tiles");
const listing_search_repository_1 = require("../listing-search.repository");
const listing_mapper_1 = require("../listing.mapper");
const listing_selects_1 = require("../listing.selects");
const favorites_service_1 = require("./favorites.service");
const listing_views_service_1 = require("./listing-views.service");
const listing_region_names_service_1 = require("./listing-region-names.service");
const listing_summaries_service_1 = require("./listing-summaries.service");
const recent_views_service_1 = require("./recent-views.service");
/** Public read side: sorted/paginated search and the listing detail page. */
let ListingQueryService = class ListingQueryService {
    constructor(prisma, search, mapper, views, recent, favorites, summaries, regionNames, cache) {
        this.prisma = prisma;
        this.search = search;
        this.mapper = mapper;
        this.views = views;
        this.recent = recent;
        this.favorites = favorites;
        this.summaries = summaries;
        this.regionNames = regionNames;
        this.cache = cache;
    }
    async list(q) {
        const { page, pageSize, sort, bbox, ...filter } = q;
        const offset = (page - 1) * pageSize;
        const [ids, total] = await Promise.all([
            this.search.listIds(filter, bbox, sort, offset, pageSize),
            this.total(filter, bbox),
        ]);
        const rows = ids.length === 0
            ? []
            : await this.prisma.listing.findMany({
                where: { id: { in: ids } },
                select: listing_selects_1.LISTING_SUMMARY_SELECT,
            });
        const byId = new Map(rows.map((r) => [r.id, r]));
        const items = await this.summaries.map(ids.flatMap((id) => {
            const row = byId.get(id);
            return row ? [row] : [];
        }));
        return (0, pagination_1.toPaginated)(items, total, { page, pageSize });
    }
    /**
     * Total matches for (filter, bbox): a full count of the matching rows, so it is cached like map
     * tiles (same version namespace, bumped on every public-data write; the TTL bounds staleness).
     * Independent of page and sort, so paging through results reuses it.
     */
    async total(filter, bbox) {
        const version = await this.cache.version(constants_1.LISTINGS_SEARCH_CACHE_NS);
        const area = bbox ? `${bbox.swLng},${bbox.swLat},${bbox.neLng},${bbox.neLat}` : 'all';
        return this.cache.getOrSet(`cache:listings:list-total:v${version}:${area}:${(0, map_tiles_1.filterFingerprint)(filter)}`, constants_1.MAP_TILE_CACHE_TTL_SECONDS, () => this.search.count(this.search.publicWhere(filter, bbox)));
    }
    /** Public detail of an ACTIVE/RESERVED listing; counts a deduped view and a recent view. */
    async detail(id, principal) {
        const row = await this.prisma.listing.findFirst({
            where: {
                id,
                deletedAt: null,
                status: { in: [...shared_1.PUBLIC_LISTING_STATUSES] },
                ...listing_selects_1.PUBLIC_PRIMARY_AGENCY_WHERE,
            },
            select: listing_selects_1.LISTING_PUBLIC_DETAIL_SELECT,
        });
        if (!row)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.LISTING_NOT_FOUND);
        const userId = principal?.kind === 'USER' ? principal.userId : null;
        const [viewCount, isFavorite, emdName] = await Promise.all([
            this.views.record(row.id, this.views.viewerKey(principal), row.viewCount, row),
            userId ? this.favorites.isFavorite(userId, row.id) : Promise.resolve(false),
            this.regionNames.nameOf(row.emdCode),
            userId ? this.recent.record(userId, shared_1.RecentViewTarget.LISTING, row.id) : Promise.resolve(),
        ]);
        return { ...this.mapper.publicDetail(row, isFavorite, emdName), viewCount };
    }
    /**
     * POST /listings/:id/view — the browser-side view beacon: counts a view (same per-viewer dedupe
     * as the detail read, so SSR + beacon count once) and, for a signed-in user, the recent view.
     */
    async recordView(id, principal) {
        const row = await this.prisma.listing.findFirst({
            where: {
                id,
                deletedAt: null,
                status: { in: [...shared_1.PUBLIC_LISTING_STATUSES] },
                ...listing_selects_1.PUBLIC_PRIMARY_AGENCY_WHERE,
            },
            select: { id: true, viewCount: true, assetType: true, emdCode: true },
        });
        if (!row)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.LISTING_NOT_FOUND);
        await Promise.all([
            this.views.record(row.id, this.views.viewerKey(principal), row.viewCount, row),
            principal?.kind === 'USER'
                ? this.recent.record(principal.userId, shared_1.RecentViewTarget.LISTING, row.id)
                : Promise.resolve(),
        ]);
    }
};
exports.ListingQueryService = ListingQueryService;
exports.ListingQueryService = ListingQueryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        listing_search_repository_1.ListingSearchRepository,
        listing_mapper_1.ListingMapper,
        listing_views_service_1.ListingViewsService,
        recent_views_service_1.RecentViewsService,
        favorites_service_1.FavoritesService,
        listing_summaries_service_1.ListingSummariesService,
        listing_region_names_service_1.ListingRegionNamesService,
        cache_service_1.CacheService])
], ListingQueryService);
//# sourceMappingURL=listing-query.service.js.map