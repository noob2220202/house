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
exports.MapSearchService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const cache_service_1 = require("../../../common/cache/cache.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
const constants_1 = require("../constants");
const map_tiles_1 = require("../domain/map-tiles");
const listing_search_repository_1 = require("../listing-search.repository");
function addAgg(g, row, lat, lng) {
    g.count += row.count;
    g.latSum += lat * row.count;
    g.lngSum += lng * row.count;
    g.byDealType[row.dealType] = {
        count: row.count,
        priceMin: row.priceMin,
        priceMax: row.priceMax,
        ...(row.dealType === shared_1.DealType.MONTHLY ? { rentMin: row.rentMin, rentMax: row.rentMax } : {}),
    };
}
const newGroup = () => ({ count: 0, latSum: 0, lngSum: 0, byDealType: {} });
const round7 = (n) => Math.round(n * 1e7) / 1e7;
/**
 * Map search: 읍면동 clusters (low zoom), tile-aligned grid clusters (mid zoom), or 단지 + 개별 매물
 * markers (high zoom). Results are computed for the tile-aligned bbox and cached briefly in Redis.
 */
let MapSearchService = class MapSearchService {
    constructor(repo, prisma, cache) {
        this.repo = repo;
        this.prisma = prisma;
        this.cache = cache;
    }
    async search(q) {
        const { bbox, zoom, ...filter } = q;
        const plan = (0, map_tiles_1.planMapQuery)(bbox, zoom);
        const version = await this.cache.version(constants_1.LISTINGS_SEARCH_CACHE_NS);
        return this.cache.getOrSet((0, map_tiles_1.mapTileCacheKey)(plan, filter, version), constants_1.MAP_TILE_CACHE_TTL_SECONDS, () => this.compute(plan, filter));
    }
    async compute(plan, filter) {
        const where = this.repo.publicWhere(filter, plan.bbox);
        const base = {
            kind: plan.kind,
            zoom: plan.zoom,
            bbox: plan.bbox,
            clusters: [],
            complexes: [],
            listings: [],
            truncated: false,
        };
        switch (plan.kind) {
            case shared_1.MapResultKind.REGION_CLUSTERS: {
                const clusters = await this.regionClusters(where);
                return { ...base, clusters, total: clusters.reduce((n, c) => n + c.count, 0) };
            }
            case shared_1.MapResultKind.GRID_CLUSTERS: {
                const clusters = await this.gridClusters(where, plan.gridSize, plan.bbox);
                return { ...base, clusters, total: clusters.reduce((n, c) => n + c.count, 0) };
            }
            case shared_1.MapResultKind.MARKERS: {
                const [complexRows, markers, total] = await Promise.all([
                    this.repo.complexAggregates(where, shared_1.MAP_MAX_MARKERS),
                    this.repo.listingMarkers(where, shared_1.MAP_MAX_MARKERS),
                    this.repo.count(where),
                ]);
                return {
                    ...base,
                    complexes: complexRows.slice(0, shared_1.MAP_MAX_MARKERS).map(toComplexMarker),
                    listings: markers
                        .slice(0, shared_1.MAP_MAX_MARKERS)
                        .map((m) => ({ ...m, ...(0, shared_1.applicablePrices)(m.dealType, m) })),
                    truncated: markers.length > shared_1.MAP_MAX_MARKERS || complexRows.length > shared_1.MAP_MAX_MARKERS,
                    total,
                };
            }
        }
    }
    async regionClusters(where) {
        const rows = await this.repo.regionAggregates(where);
        const groups = new Map();
        for (const r of rows) {
            const key = r.emd8 ? `${r.emd8}00` : null;
            const g = groups.get(key) ?? newGroup();
            addAgg(g, r, r.lat, r.lng);
            groups.set(key, g);
        }
        const codes = [...groups.keys()].filter((k) => k !== null);
        const regions = codes.length === 0
            ? []
            : await this.prisma.region.findMany({
                where: { code: { in: codes } },
                select: { code: true, name: true, lat: true, lng: true },
            });
        const regionByCode = new Map(regions.map((r) => [r.code, r]));
        return [...groups.entries()]
            .map(([code, g]) => {
            const region = code ? regionByCode.get(code) : undefined;
            return {
                key: code ?? 'unknown',
                regionCode: code,
                name: region?.name ?? null,
                lat: round7(region?.lat ?? g.latSum / g.count),
                lng: round7(region?.lng ?? g.lngSum / g.count),
                count: g.count,
                byDealType: g.byDealType,
            };
        })
            .sort((a, b) => b.count - a.count);
    }
    async gridClusters(where, size, tile) {
        const rows = await this.repo.gridAggregates(where, size, tile);
        const groups = new Map();
        for (const r of rows) {
            const key = `${round7(r.cx)}:${round7(r.cy)}`;
            const g = groups.get(key) ?? newGroup();
            addAgg(g, r, r.lat, r.lng);
            groups.set(key, g);
        }
        return [...groups.entries()].map(([key, g]) => ({
            key,
            regionCode: null,
            name: null,
            lat: round7(g.latSum / g.count),
            lng: round7(g.lngSum / g.count),
            count: g.count,
            byDealType: g.byDealType,
        }));
    }
};
exports.MapSearchService = MapSearchService;
exports.MapSearchService = MapSearchService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [listing_search_repository_1.ListingSearchRepository,
        prisma_service_1.PrismaService,
        cache_service_1.CacheService])
], MapSearchService);
function toComplexMarker(r) {
    const g = newGroup();
    for (const [dealType, stats] of Object.entries(r.byDealType)) {
        addAgg(g, { dealType, ...stats }, 0, 0);
    }
    return {
        complexId: r.complexId,
        name: r.name,
        assetType: r.assetType,
        lat: r.lat,
        lng: r.lng,
        households: r.households,
        builtYear: r.builtYear,
        count: r.count,
        byDealType: g.byDealType,
    };
}
//# sourceMappingURL=map-search.service.js.map