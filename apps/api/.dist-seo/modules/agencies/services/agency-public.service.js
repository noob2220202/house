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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgencyPublicService = void 0;
exports.tileAlignedBbox = tileAlignedBbox;
exports.filterFingerprint = filterFingerprint;
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/errors/app.exception");
const geo_1 = require("../../../common/geo/geo");
const pagination_1 = require("../../../common/pagination/pagination");
const prisma_service_1 = require("../../../prisma/prisma.service");
const agency_mapper_1 = require("../agency.mapper");
const agency_selects_1 = require("../agency.selects");
const agency_search_repository_1 = require("../agency-search.repository");
const constants_1 = require("../constants");
const agency_listings_reader_1 = require("../ports/agency-listings.reader");
const agency_media_port_1 = require("../ports/agency-media.port");
const agency_cache_service_1 = require("./agency-cache.service");
const round6 = (n) => Math.round(n * 1e6) / 1e6;
/** Expands a bbox to tile boundaries (4 grid cells) so nearby viewports share a cache entry. */
function tileAlignedBbox(b, zoom) {
    const t = (0, geo_1.gridSizeForZoom)(zoom) * 4;
    return {
        swLng: round6(Math.floor(b.swLng / t) * t),
        swLat: round6(Math.floor(b.swLat / t) * t),
        neLng: round6(Math.ceil(b.neLng / t) * t),
        neLat: round6(Math.ceil(b.neLat / t) * t),
    };
}
function filterFingerprint(f) {
    const normalized = JSON.stringify([f.q ?? null, [...(f.specialties ?? [])].sort()]);
    return (0, node_crypto_1.createHash)('sha1').update(normalized).digest('hex').slice(0, 16);
}
/** 중개사무소 찾기: list search, map clusters/markers and the public profile (APPROVED only). */
let AgencyPublicService = class AgencyPublicService {
    constructor(prisma, repo, mapper, cache, listings, media) {
        this.prisma = prisma;
        this.repo = repo;
        this.mapper = mapper;
        this.cache = cache;
        this.listings = listings;
        this.media = media;
    }
    /**
     * Office search. `openNow` evaluates the 영업시간 at `now` in Asia/Seoul (offices without hours
     * drop out); `handlesPresale` keeps offices advertising a public 분양권 listing.
     */
    async search(q, now = new Date()) {
        const filter = {
            q: q.q,
            emdCode: q.emdCode,
            bbox: q.bbox,
            specialties: q.specialties,
            openAt: q.openNow ? (0, agency_search_repository_1.kstClock)(now) : undefined,
            handlesPresale: q.handlesPresale || undefined,
        };
        const [ids, total] = await Promise.all([
            this.repo.searchIds(filter, q.sort, (0, pagination_1.toSkipTake)(q)),
            this.repo.count(filter),
        ]);
        const [rows, presale] = ids.length
            ? await Promise.all([
                this.prisma.agency.findMany({
                    where: { id: { in: ids } },
                    select: { ...agency_selects_1.agencySummarySelect, businessHours: true },
                }),
                q.handlesPresale ? Promise.resolve(new Set(ids)) : this.repo.presaleAgencyIds(ids),
            ])
            : [[], new Set()];
        const byId = new Map(rows.map((r) => [r.id, r]));
        const items = ids.flatMap((id) => {
            const row = byId.get(id);
            return row
                ? [
                    {
                        ...this.mapper.summary(row),
                        businessHours: (0, agency_mapper_1.toBusinessHours)(row.businessHours),
                        handlesPresale: presale.has(id),
                    },
                ]
                : [];
        });
        return (0, pagination_1.toPaginated)(items, total, q);
    }
    /** Cached (public version namespace, bumped on approvals / profile changes). */
    async regions() {
        const key = await this.cache.publicKey('regions');
        return this.cache.getOrSet(key, constants_1.REGIONS_CACHE_TTL_SECONDS, async () => {
            const [rows, total] = await Promise.all([this.repo.regionFacet(), this.repo.count({})]);
            return {
                total,
                // A code the regions table does not know cannot be labelled in the filter: left out.
                items: rows.flatMap((r) => r.name
                    ? [{ emdCode: r.emdCode, name: r.name, count: r.count, lat: r.lat, lng: r.lng }]
                    : []),
            };
        });
    }
    async map(q) {
        const zoom = Math.round(q.zoom);
        const kind = (0, shared_1.mapResultKindForZoom)(zoom);
        const bbox = tileAlignedBbox(q.bbox, zoom);
        const filter = { q: q.q, specialties: q.specialties, bbox };
        const b = bbox;
        const key = await this.cache.publicKey('map', kind, zoom, `${b.swLng},${b.swLat},${b.neLng},${b.neLat}`, filterFingerprint(filter));
        return this.cache.getOrSet(key, constants_1.MAP_CACHE_TTL_SECONDS, async () => {
            switch (kind) {
                case shared_1.MapResultKind.REGION_CLUSTERS:
                    return { kind, clusters: await this.repo.regionClusters(filter) };
                case shared_1.MapResultKind.GRID_CLUSTERS:
                    return { kind, clusters: await this.repo.gridClusters(filter, (0, geo_1.gridSizeForZoom)(zoom)) };
                case shared_1.MapResultKind.MARKERS:
                default: {
                    const rows = await this.repo.markers(filter, shared_1.MAP_MAX_MARKERS);
                    const truncated = rows.length > shared_1.MAP_MAX_MARKERS;
                    return {
                        kind: shared_1.MapResultKind.MARKERS,
                        truncated,
                        markers: rows.slice(0, shared_1.MAP_MAX_MARKERS).map((r) => ({
                            id: r.id,
                            name: r.name,
                            lat: r.lat,
                            lng: r.lng,
                            activeListingCount: r.activeListingCount,
                            logoUrl: r.logoStorageKey
                                ? this.media.publicUrl({ storageKey: r.logoStorageKey, variants: r.logoVariants })
                                : null,
                        })),
                    };
                }
            }
        });
    }
    async profile(agencyId) {
        const key = await this.cache.publicKey('profile', agencyId);
        const cached = await this.cache.getOrSet(key, constants_1.PROFILE_CACHE_TTL_SECONDS, () => this.loadProfile(agencyId));
        if (!cached)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.AGENCY_NOT_FOUND);
        return cached;
    }
    async loadProfile(agencyId) {
        const row = await this.prisma.agency.findFirst({
            where: { id: agencyId, status: shared_1.AgencyStatus.APPROVED, deletedAt: null },
            select: {
                ...agency_selects_1.agencyProfileSelect,
                // 제18조의2①: this page shows the office's 중개대상물 ads, so it names only the
                // 개업공인중개사 and 소속공인중개사 (isAdvertisableMember), never a 중개보조원.
                members: {
                    where: {
                        status: shared_1.AgencyMemberStatus.ACTIVE,
                        OR: [{ role: shared_1.AgencyMemberRole.OWNER }, { isLicensed: true }],
                    },
                    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
                    take: constants_1.PROFILE_MEMBERS_LIMIT,
                    select: { id: true, displayName: true, title: true, role: true, isLicensed: true },
                },
            },
        });
        if (!row)
            return null;
        const [listingCounts, representativeListings] = await Promise.all([
            this.listings.counts(agencyId),
            this.listings.representative(agencyId, constants_1.REPRESENTATIVE_LISTINGS_LIMIT),
        ]);
        return {
            ...this.mapper.summary(row),
            coverUrl: this.mapper.coverUrl(row.cover),
            mobile: row.mobile,
            email: row.email,
            jibunAddress: row.jibunAddress,
            intro: row.intro,
            businessHours: (0, agency_mapper_1.toBusinessHours)(row.businessHours),
            approvedAt: row.approvedAt?.toISOString() ?? null,
            warningCount: row.warningCount,
            members: row.members,
            listingCounts,
            representativeListings,
            disclosure: (0, shared_1.toAgencyDisclosure)(row),
        };
    }
};
exports.AgencyPublicService = AgencyPublicService;
exports.AgencyPublicService = AgencyPublicService = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Inject)(agency_listings_reader_1.AGENCY_LISTINGS_READER)),
    __param(5, (0, common_1.Inject)(agency_media_port_1.AGENCY_MEDIA)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        agency_search_repository_1.AgencySearchRepository,
        agency_mapper_1.AgencyMapper,
        agency_cache_service_1.AgencyCacheService, Object, Object])
], AgencyPublicService);
//# sourceMappingURL=agency-public.service.js.map