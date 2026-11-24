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
exports.ComplexSearchService = void 0;
exports.escapeLike = escapeLike;
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const client_1 = require("@prisma/client");
const cache_service_1 = require("../../../common/cache/cache.service");
const pagination_1 = require("../../../common/pagination/pagination");
const app_config_service_1 = require("../../../config/app-config.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
const complex_mapper_1 = require("../complex.mapper");
const constants_1 = require("../constants");
const regions_service_1 = require("./regions.service");
/** Escapes LIKE wildcards so user input matches literally. */
function escapeLike(s) {
    return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}
const ORDER_BY = {
    name: client_1.Prisma.sql `c.name ASC, c.id ASC`,
    popular: client_1.Prisma.sql `c.view_count DESC, c.id ASC`,
    households: client_1.Prisma.sql `c.households DESC NULLS LAST, c.id ASC`,
    newest: client_1.Prisma.sql `c.approval_date DESC NULLS LAST, c.id ASC`,
};
/** 단지 search (trigram ILIKE/similarity on name + address, 초성 search) and 지역+단지 autocomplete. */
let ComplexSearchService = class ComplexSearchService {
    constructor(prisma, cache, config, regions) {
        this.prisma = prisma;
        this.cache = cache;
        this.config = config;
        this.regions = regions;
    }
    async search(q) {
        const { skip, take } = (0, pagination_1.toSkipTake)(q);
        const { ids, total } = q.q && (0, shared_1.isChosungQuery)(q.q)
            ? await this.chosungIds(q, skip, take)
            : await this.sqlIds(q, skip, take);
        const rows = await this.rowsInOrder(ids);
        return (0, pagination_1.toPaginated)(rows.map(complex_mapper_1.toComplexSummary), total, q);
    }
    async autocomplete(q) {
        const version = await this.cache.version(constants_1.COMPLEXES_CACHE.SEARCH);
        const term = q.q.normalize('NFC').trim().toLowerCase();
        const key = `cache:complexes:ac:v${version}:${q.limit}:${encodeURIComponent(term)}`;
        return this.cache.getOrSet(key, constants_1.CACHE_TTL_SECONDS.AUTOCOMPLETE, async () => {
            const [regions, page] = await Promise.all([
                this.matchRegions(term, Math.min(5, q.limit)),
                (0, shared_1.isChosungQuery)(term)
                    ? this.chosungIds({ q: term, sort: 'relevance' }, 0, q.limit)
                    : this.sqlIds({ q: term, sort: 'relevance' }, 0, q.limit),
            ]);
            const rows = await this.rowsInOrder(page.ids);
            return { regions, complexes: rows.map(toSuggestion) };
        });
    }
    async matchRegions(term, limit) {
        const all = await this.regions.activeSubRegions();
        const chosung = (0, shared_1.isChosungQuery)(term);
        const hits = all.filter((r) => chosung ? (0, shared_1.matchesChosung)(r.name, term) : r.name.includes(term) || r.fullName.includes(term));
        // 읍면동 before 리, then exact-prefix before contains.
        hits.sort((a, b) => Number(b.level === 'EMD') - Number(a.level === 'EMD') ||
            Number(b.name.startsWith(term)) - Number(a.name.startsWith(term)));
        return hits.slice(0, limit);
    }
    async sqlIds(f, skip, take) {
        const conds = [
            client_1.Prisma.sql `c.deleted_at IS NULL`,
            client_1.Prisma.sql `c.sgg_code = ${this.config.get('REGION_SGG_CODE')}`,
        ];
        if (f.emdCode)
            conds.push(client_1.Prisma.sql `c.emd_code = ${f.emdCode}`);
        if (f.assetType)
            conds.push(client_1.Prisma.sql `c.asset_type = ${f.assetType}::asset_type`);
        let orderBy = ORDER_BY.popular;
        if (f.q) {
            const like = `%${escapeLike(f.q)}%`;
            conds.push(client_1.Prisma.sql `(
        c.name ILIKE ${like} OR c.road_address ILIKE ${like} OR c.jibun_address ILIKE ${like}
        OR c.emd_name = ${f.q} OR c.name % ${f.q}
      )`);
            if (f.sort === 'relevance') {
                orderBy = client_1.Prisma.sql `(c.name ILIKE ${`${escapeLike(f.q)}%`}) DESC,
          similarity(c.name, ${f.q}) DESC, c.view_count DESC, c.id ASC`;
            }
        }
        if (f.sort !== 'relevance')
            orderBy = ORDER_BY[f.sort];
        const where = client_1.Prisma.join(conds, ' AND ');
        const [rows, count] = await Promise.all([
            this.prisma.$queryRaw `
        SELECT c.id FROM complexes c WHERE ${where} ORDER BY ${orderBy} LIMIT ${take} OFFSET ${skip}`,
            this.prisma.$queryRaw `SELECT count(*)::int AS n FROM complexes c WHERE ${where}`,
        ]);
        return { ids: rows.map((r) => r.id), total: count[0]?.n ?? 0 };
    }
    async chosungIds(f, skip, take) {
        const index = await this.chosungIndex();
        const term = f.q ?? '';
        const hits = index.filter((e) => (!f.emdCode || e.emdCode === f.emdCode) &&
            (!f.assetType || e.assetType === f.assetType) &&
            (0, shared_1.matchesChosung)(e.name, term));
        hits.sort((a, b) => f.sort === 'name'
            ? a.name.localeCompare(b.name, 'ko') || a.id.localeCompare(b.id)
            : b.viewCount - a.viewCount || a.id.localeCompare(b.id));
        return { ids: hits.slice(skip, skip + take).map((e) => e.id), total: hits.length };
    }
    async chosungIndex() {
        const sggCode = this.config.get('REGION_SGG_CODE');
        const version = await this.cache.version(constants_1.COMPLEXES_CACHE.SEARCH);
        return this.cache.getOrSet(`cache:complexes:chosung:v${version}:${sggCode}`, constants_1.CACHE_TTL_SECONDS.CHOSUNG_INDEX, () => this.prisma.complex.findMany({
            where: { sggCode, deletedAt: null },
            select: { id: true, name: true, emdCode: true, assetType: true, viewCount: true },
        }));
    }
    async rowsInOrder(ids) {
        if (ids.length === 0)
            return [];
        const rows = await this.prisma.complex.findMany({
            where: { id: { in: [...ids] } },
            select: complex_mapper_1.COMPLEX_SUMMARY_SELECT,
        });
        const byId = new Map(rows.map((r) => [r.id, r]));
        return ids.flatMap((id) => {
            const r = byId.get(id);
            return r ? [r] : [];
        });
    }
};
exports.ComplexSearchService = ComplexSearchService;
exports.ComplexSearchService = ComplexSearchService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService,
        app_config_service_1.AppConfig,
        regions_service_1.RegionsService])
], ComplexSearchService);
function toSuggestion(r) {
    return {
        id: r.id,
        name: r.name,
        assetType: r.assetType,
        address: r.roadAddress ?? r.jibunAddress,
        emdName: r.emdName,
        lat: r.lat,
        lng: r.lng,
        households: r.households,
        activeListingCount: r.activeListingCount,
    };
}
//# sourceMappingURL=complex-search.service.js.map