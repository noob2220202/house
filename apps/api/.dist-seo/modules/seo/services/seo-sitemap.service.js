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
exports.SeoSitemapService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const cache_service_1 = require("../../../common/cache/cache.service");
const app_exception_1 = require("../../../common/errors/app.exception");
const app_config_service_1 = require("../../../config/app-config.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
const listing_search_repository_1 = require("../../listings/listing-search.repository");
const constants_1 = require("../constants");
const seo_domain_1 = require("../seo.domain");
const PUBLIC_LISTING_SQL = client_1.Prisma.sql `l.deleted_at IS NULL AND ${listing_search_repository_1.PUBLIC_STATUS_SQL} AND ${listing_search_repository_1.PRIMARY_AGENCY_APPROVED_SQL}`;
/**
 * URL inventories for the web sitemaps (every public 단지 / 매물 / 중개사무소 with its last change)
 * and the "gone" status of a listing URL that is no longer public.
 */
let SeoSitemapService = class SeoSitemapService {
    constructor(prisma, cache, config) {
        this.prisma = prisma;
        this.cache = cache;
        this.config = config;
    }
    get sggCode() {
        return this.config.get('REGION_SGG_CODE');
    }
    sitemap(kind) {
        return this.cache.getOrSet(`cache:seo:sitemap:${this.sggCode}:${kind}`, constants_1.SEO_CACHE_TTL_SECONDS.SITEMAP, async () => {
            const rows = await this.rows(kind);
            return {
                kind,
                items: rows.slice(0, constants_1.SITEMAP_MAX_URLS).map((r) => ({
                    id: r.id,
                    lastModified: r.lastModified.toISOString(),
                })),
                truncated: rows.length > constants_1.SITEMAP_MAX_URLS,
            };
        });
    }
    rows(kind) {
        const sgg = this.sggCode;
        const take = constants_1.SITEMAP_MAX_URLS + 1;
        switch (kind) {
            // A 단지 page changes with its own row, its 실거래 and its public listings.
            case 'complexes':
                return this.prisma.$queryRaw `
          SELECT c.id, GREATEST(
              c.updated_at,
              COALESCE((SELECT max(t.updated_at) FROM trade_records t WHERE t.complex_id = c.id), c.updated_at),
              COALESCE((SELECT max(l.updated_at) FROM listings l
                WHERE l.complex_id = c.id AND ${PUBLIC_LISTING_SQL}), c.updated_at)
            ) AS "lastModified"
          FROM complexes c
          WHERE c.deleted_at IS NULL AND c.sgg_code = ${sgg}
          ORDER BY c.id LIMIT ${take}`;
            case 'listings':
                return this.prisma.$queryRaw `
          SELECT l.id, l.updated_at AS "lastModified" FROM listings l
          WHERE ${PUBLIC_LISTING_SQL} AND l.sgg_code = ${sgg}
          ORDER BY l.published_at DESC NULLS LAST, l.id LIMIT ${take}`;
            case 'agencies':
                return this.prisma.agency
                    .findMany({
                    where: { status: shared_1.AgencyStatus.APPROVED, deletedAt: null, sggCode: sgg },
                    select: { id: true, updatedAt: true },
                    orderBy: { id: 'asc' },
                    take,
                })
                    .then((rows) => rows.map((r) => ({ id: r.id, lastModified: r.updatedAt })));
        }
    }
    /**
     * Whether a listing that was published is still public. Never-published drafts are unknown
     * (404). Exposes no private field: only status, asset type, 단지 and 지역 (for a redirect target).
     */
    async listingStatus(id, now = new Date()) {
        const row = await this.prisma.listing.findUnique({
            where: { id },
            select: {
                id: true,
                status: true,
                assetType: true,
                complexId: true,
                emdCode: true,
                publishedAt: true,
                closedAt: true,
                expiresAt: true,
                deletedAt: true,
                primaryAgency: { select: { status: true, deletedAt: true } },
                complex: { select: { deletedAt: true } },
            },
        });
        if (!row || !row.publishedAt)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.LISTING_NOT_FOUND);
        const isPublic = row.deletedAt === null &&
            shared_1.PUBLIC_LISTING_STATUSES.includes(row.status) &&
            row.primaryAgency.status === shared_1.AgencyStatus.APPROVED &&
            row.primaryAgency.deletedAt === null;
        const expired = row.expiresAt && row.expiresAt <= now ? row.expiresAt : null;
        return {
            id: row.id,
            state: isPublic ? 'PUBLIC' : 'GONE',
            status: row.status,
            assetType: row.assetType,
            complexId: row.complex && row.complex.deletedAt === null ? row.complexId : null,
            regionCode: (0, seo_domain_1.regionKeyOf)(row.emdCode),
            endedAt: isPublic ? null : (row.deletedAt ?? row.closedAt ?? expired)?.toISOString() ?? null,
        };
    }
};
exports.SeoSitemapService = SeoSitemapService;
exports.SeoSitemapService = SeoSitemapService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService,
        app_config_service_1.AppConfig])
], SeoSitemapService);
//# sourceMappingURL=seo-sitemap.service.js.map