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
exports.ComplexAdminService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const client_1 = require("@prisma/client");
const cache_service_1 = require("../../../common/cache/cache.service");
const request_context_1 = require("../../../common/context/request-context");
const app_exception_1 = require("../../../common/errors/app.exception");
const pagination_1 = require("../../../common/pagination/pagination");
const area_1 = require("../../../common/utils/area");
const app_config_service_1 = require("../../../config/app-config.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
const complex_mapper_1 = require("../complex.mapper");
const constants_1 = require("../constants");
const complex_media_port_1 = require("../ports/complex-media.port");
const trade_stats_service_1 = require("../trade-sync/trade-stats.service");
const trade_sync_jobs_1 = require("../trade-sync/trade-sync.jobs");
const complex_query_service_1 = require("./complex-query.service");
const regions_service_1 = require("./regions.service");
const ADMIN_DETAIL_SELECT = {
    ...complex_query_service_1.COMPLEX_DETAIL_SELECT,
    jibun: true,
    externalCode: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    _count: { select: { trades: true } },
};
function uniqueTarget(err) {
    if (!(err instanceof client_1.Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002')
        return null;
    const target = err.meta?.target;
    return Array.isArray(target) ? target.join(',') : typeof target === 'string' ? target : '';
}
/** Maps unique violations to domain codes; rethrows everything else. */
function rethrowUnique(err) {
    const target = uniqueTarget(err);
    if (target !== null) {
        if (/external_code|externalCode/.test(target)) {
            throw app_exception_1.AppException.conflict(shared_1.ErrorCode.COMPLEX_EXTERNAL_CODE_DUPLICATE);
        }
        throw app_exception_1.AppException.conflict(shared_1.ErrorCode.COMPLEX_AREA_TYPE_DUPLICATE);
    }
    throw err;
}
function areaTypeData(input) {
    return {
        ...(input.exclusiveArea !== undefined ? { exclusiveArea: input.exclusiveArea } : {}),
        ...(input.supplyArea !== undefined ? { supplyArea: input.supplyArea } : {}),
        ...(input.typeName !== undefined ? { typeName: input.typeName } : {}),
        ...(input.pyeongLabel !== undefined
            ? { pyeongLabel: input.pyeongLabel }
            : input.supplyArea
                ? { pyeongLabel: (0, area_1.pyeongLabel)(input.supplyArea) }
                : {}),
        ...(input.households !== undefined ? { households: input.households } : {}),
        ...(input.rooms !== undefined ? { rooms: input.rooms } : {}),
        ...(input.baths !== undefined ? { baths: input.baths } : {}),
    };
}
/** Fields the trade matcher reads: changing any of them can re-attribute 실거래 rows. */
const MATCH_FIELDS = [
    'name',
    'emdCode',
    'emdName',
    'jibun',
    'jibunAddress',
    'externalCode',
];
/** Interactive transactions that also rebuild one 단지's stats history. */
const STATS_TX_OPTIONS = { timeout: 30_000 };
/** Admin CRUD for 단지, 평형 and 단지 photos. Every mutation is audited by the controller. */
let ComplexAdminService = class ComplexAdminService {
    constructor(prisma, regions, query, stats, cache, config, jobs, media) {
        this.prisma = prisma;
        this.regions = regions;
        this.query = query;
        this.stats = stats;
        this.cache = cache;
        this.config = config;
        this.jobs = jobs;
        this.media = media;
    }
    list(q) {
        const where = {
            ...(q.includeDeleted ? {} : { deletedAt: null }),
            ...(q.emdCode ? { emdCode: q.emdCode } : {}),
            ...(q.missingExternalCode ? { externalCode: null } : {}),
            ...(q.q
                ? {
                    OR: [
                        { name: { contains: q.q, mode: 'insensitive' } },
                        { roadAddress: { contains: q.q, mode: 'insensitive' } },
                        { jibunAddress: { contains: q.q, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };
        return (0, pagination_1.paginate)(q, async (args) => (await this.prisma.complex.findMany({
            where,
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            select: { ...complex_mapper_1.COMPLEX_SUMMARY_SELECT, externalCode: true, deletedAt: true },
            ...args,
        })).map((r) => ({
            ...(0, complex_mapper_1.toComplexSummary)(r),
            externalCode: r.externalCode,
            deletedAt: r.deletedAt?.toISOString() ?? null,
        })), () => this.prisma.complex.count({ where }));
    }
    async get(id) {
        const row = await this.prisma.complex.findUnique({
            where: { id },
            select: ADMIN_DETAIL_SELECT,
        });
        if (!row)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.COMPLEX_NOT_FOUND);
        const region = row.emdCode
            ? await this.prisma.region.findUnique({
                where: { code: row.emdCode },
                select: { code: true, name: true, fullName: true },
            })
            : null;
        return {
            ...this.query.base(row),
            region,
            jibun: row.jibun,
            externalCode: row.externalCode,
            tradeCount: row._count.trades,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
            deletedAt: row.deletedAt?.toISOString() ?? null,
        };
    }
    async create(input) {
        const location = await this.resolveLocation(input, null);
        let id;
        try {
            id = await this.prisma.$transaction(async (tx) => {
                const c = await tx.complex.create({
                    data: {
                        ...this.scalarData(input),
                        ...location,
                        name: input.name,
                        assetType: input.assetType,
                        lat: input.lat,
                        lng: input.lng,
                        sggCode: this.config.get('REGION_SGG_CODE'),
                    },
                    select: { id: true },
                });
                if (input.areaTypes.length > 0) {
                    await tx.complexAreaType.createMany({
                        data: input.areaTypes.map((a) => ({
                            complexId: c.id,
                            ...areaTypeData(a),
                            exclusiveArea: a.exclusiveArea,
                        })),
                    });
                }
                return c.id;
            });
        }
        catch (err) {
            rethrowUnique(err);
        }
        await this.invalidate();
        // A new 단지 may own trades synced before it existed.
        await this.jobs.requestRematch();
        return this.get(id);
    }
    async update(id, input) {
        const current = await this.prisma.complex.findFirst({ where: { id, deletedAt: null } });
        if (!current)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.COMPLEX_NOT_FOUND);
        request_context_1.RequestContext.setAuditBefore(current);
        const location = await this.resolveLocation(input, current);
        try {
            await this.prisma.complex.update({
                where: { id },
                data: {
                    ...this.scalarData(input),
                    ...location,
                    ...(input.name !== undefined ? { name: input.name } : {}),
                    ...(input.assetType !== undefined ? { assetType: input.assetType } : {}),
                    ...(input.lat !== undefined ? { lat: input.lat } : {}),
                    ...(input.lng !== undefined ? { lng: input.lng } : {}),
                },
            });
        }
        catch (err) {
            rethrowUnique(err);
        }
        await this.invalidate();
        if (MATCH_FIELDS.some((f) => input[f] !== undefined))
            await this.jobs.requestRematch();
        return this.get(id);
    }
    async remove(id) {
        const current = await this.prisma.complex.findFirst({ where: { id, deletedAt: null } });
        if (!current)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.COMPLEX_NOT_FOUND);
        request_context_1.RequestContext.setAuditBefore(current);
        await this.prisma.$transaction(async (tx) => {
            await trade_stats_service_1.TradeStatsService.lock(tx, [id]);
            // Its 실거래 rows become unmatched (a replacement 단지 picks them up on rematch) and its
            // stats go with it.
            await tx.$executeRaw `
        UPDATE trade_records SET complex_id = NULL, area_type_id = NULL
        WHERE complex_id = ${id}::uuid`;
            await tx.$executeRaw `DELETE FROM complex_trade_stats WHERE complex_id = ${id}::uuid`;
            // Soft delete; the 국토교통부 code is released so a replacement 단지 can take it.
            await tx.complex.update({
                where: { id },
                data: { deletedAt: new Date(), externalCode: null },
            });
        }, STATS_TX_OPTIONS);
        await this.invalidate();
        await this.jobs.requestRematch();
    }
    async addAreaType(id, input) {
        await this.requireComplex(id);
        let row;
        try {
            row = await this.prisma.$transaction(async (tx) => {
                await trade_stats_service_1.TradeStatsService.lock(tx, [id]);
                const created = await tx.complexAreaType.create({
                    data: { complexId: id, ...areaTypeData(input), exclusiveArea: input.exclusiveArea },
                    select: complex_mapper_1.AREA_TYPE_SELECT,
                });
                await this.reassignAreaTypes(tx, id);
                return created;
            }, STATS_TX_OPTIONS);
        }
        catch (err) {
            rethrowUnique(err);
        }
        await this.invalidate();
        return (0, complex_mapper_1.toAreaTypeView)(row);
    }
    async updateAreaType(id, areaTypeId, input) {
        await this.requireComplex(id);
        const current = await this.prisma.complexAreaType.findFirst({
            where: { id: areaTypeId, complexId: id },
        });
        if (!current)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.COMPLEX_AREA_TYPE_NOT_FOUND);
        request_context_1.RequestContext.setAuditBefore(current);
        let row;
        try {
            row = await this.prisma.$transaction(async (tx) => {
                await trade_stats_service_1.TradeStatsService.lock(tx, [id]);
                const updated = await tx.complexAreaType.update({
                    where: { id: areaTypeId },
                    data: areaTypeData(input),
                    select: complex_mapper_1.AREA_TYPE_SELECT,
                });
                if (input.exclusiveArea !== undefined)
                    await this.reassignAreaTypes(tx, id);
                return updated;
            }, STATS_TX_OPTIONS);
        }
        catch (err) {
            rethrowUnique(err);
        }
        await this.invalidate();
        return (0, complex_mapper_1.toAreaTypeView)(row);
    }
    async removeAreaType(id, areaTypeId) {
        await this.requireComplex(id);
        const current = await this.prisma.complexAreaType.findFirst({
            where: { id: areaTypeId, complexId: id },
        });
        if (!current)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.COMPLEX_AREA_TYPE_NOT_FOUND);
        request_context_1.RequestContext.setAuditBefore(current);
        await this.prisma.$transaction(async (tx) => {
            await trade_stats_service_1.TradeStatsService.lock(tx, [id]);
            // trade_records / properties keep their rows (area_type_id → NULL, then trades move to the
            // nearest remaining 평형 within tolerance).
            await tx.complexAreaType.delete({ where: { id: areaTypeId } });
            await this.reassignAreaTypes(tx, id);
        }, STATS_TX_OPTIONS);
        await this.invalidate();
    }
    /** Replaces the photo list (order = array order). */
    async setPhotos(id, input) {
        await this.requireComplex(id);
        const mediaIds = input.items.map((i) => i.mediaId);
        const before = await this.prisma.$transaction(async (tx) => {
            // Locks the uploads FOR SHARE so the orphan cleanup cannot delete them under us.
            await this.media.assertUsable(mediaIds, tx);
            const prev = await tx.complexPhoto.findMany({
                where: { complexId: id },
                orderBy: { sortOrder: 'asc' },
                select: { mediaId: true, caption: true, sortOrder: true },
            });
            await tx.complexPhoto.deleteMany({ where: { complexId: id } });
            if (input.items.length > 0) {
                await tx.complexPhoto.createMany({
                    data: input.items.map((item, i) => ({
                        complexId: id,
                        mediaId: item.mediaId,
                        caption: item.caption ?? null,
                        sortOrder: i,
                    })),
                });
            }
            const kept = new Set(mediaIds);
            await this.media.released(prev.map((p) => p.mediaId).filter((m) => !kept.has(m)), tx);
            return prev;
        });
        request_context_1.RequestContext.setAuditBefore(before);
        return (await this.get(id)).photos;
    }
    // ---------- internals ----------
    async requireComplex(id) {
        const n = await this.prisma.complex.count({ where: { id, deletedAt: null } });
        if (n === 0)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.COMPLEX_NOT_FOUND);
    }
    /**
     * Re-assigns every trade of the 단지 to its nearest 평형 within the tolerance (ties → lowest id,
     * as ComplexMatcher.areaTypeFor) and rebuilds the 단지's stats, which are grouped by the 평형's
     * 전용면적. Call inside the transaction that changed the 평형 (stats lock already held).
     */
    async reassignAreaTypes(tx, complexId) {
        await tx.$executeRaw `
      UPDATE trade_records tr SET area_type_id = best.id
      FROM (
        SELECT tr2.id AS tid,
               (SELECT at.id FROM complex_area_types at
                WHERE at.complex_id = tr2.complex_id
                  AND abs(at.exclusive_area - tr2.exclusive_area) <= ${constants_1.AREA_TYPE_MATCH_TOLERANCE_SQM}
                ORDER BY abs(at.exclusive_area - tr2.exclusive_area), at.id
                LIMIT 1) AS id
        FROM trade_records tr2
        WHERE tr2.complex_id = ${complexId}::uuid
      ) best
      WHERE tr.id = best.tid AND tr.area_type_id IS DISTINCT FROM best.id`;
        await this.stats.recomputeIn(tx, [complexId]);
    }
    async invalidate() {
        await Promise.all([
            this.cache.bump(constants_1.COMPLEXES_CACHE.SEARCH),
            this.cache.bump(constants_1.COMPLEXES_CACHE.POPULAR),
        ]);
    }
    /**
     * emdCode → validated 읍면동; emdName / jibun default to what the 지번주소 says (that is how
     * 국토교통부 reports them), else the 읍면동 name.
     */
    async resolveLocation(input, current) {
        const out = {};
        let regionName;
        if (input.emdCode !== undefined) {
            out.emdCode = input.emdCode;
            regionName = input.emdCode
                ? (await this.regions.requireServiceEmd(input.emdCode)).name
                : null;
        }
        const parsed = (0, shared_1.parseJibunAddress)(input.jibunAddress ?? current?.jibunAddress ?? null);
        if (input.jibun !== undefined)
            out.jibun = input.jibun;
        else if (input.jibunAddress !== undefined || !current)
            out.jibun = parsed.jibun ?? current?.jibun ?? null;
        if (input.emdName !== undefined)
            out.emdName = input.emdName;
        else if (input.jibunAddress !== undefined || input.emdCode !== undefined || !current) {
            out.emdName = parsed.emdName ?? regionName ?? current?.emdName ?? null;
        }
        return out;
    }
    scalarData(input) {
        const approvalDate = input.approvalDate === undefined
            ? undefined
            : input.approvalDate === null
                ? null
                : new Date(`${input.approvalDate}T00:00:00Z`);
        const builtYear = input.builtYear !== undefined
            ? input.builtYear
            : approvalDate
                ? approvalDate.getUTCFullYear()
                : undefined;
        const parkingPerHousehold = input.parkingPerHousehold !== undefined
            ? input.parkingPerHousehold
            : input.parkingTotal && input.households
                ? Math.round((input.parkingTotal / input.households) * 100) / 100
                : undefined;
        const d = input;
        return {
            ...(d.roadAddress !== undefined ? { roadAddress: d.roadAddress } : {}),
            ...(d.jibunAddress !== undefined ? { jibunAddress: d.jibunAddress } : {}),
            ...(d.households !== undefined ? { households: d.households } : {}),
            ...(d.buildings !== undefined ? { buildings: d.buildings } : {}),
            ...(d.floorsMin !== undefined ? { floorsMin: d.floorsMin } : {}),
            ...(d.floorsMax !== undefined ? { floorsMax: d.floorsMax } : {}),
            ...(d.parkingTotal !== undefined ? { parkingTotal: d.parkingTotal } : {}),
            ...(d.floorAreaRatio !== undefined ? { floorAreaRatio: d.floorAreaRatio } : {}),
            ...(d.buildingCoverageRatio !== undefined
                ? { buildingCoverageRatio: d.buildingCoverageRatio }
                : {}),
            ...(d.heatingType !== undefined ? { heatingType: d.heatingType } : {}),
            ...(d.builder !== undefined ? { builder: d.builder } : {}),
            ...(d.externalCode !== undefined ? { externalCode: d.externalCode } : {}),
            ...(approvalDate !== undefined ? { approvalDate } : {}),
            ...(builtYear !== undefined ? { builtYear } : {}),
            ...(parkingPerHousehold !== undefined ? { parkingPerHousehold } : {}),
        };
    }
};
exports.ComplexAdminService = ComplexAdminService;
exports.ComplexAdminService = ComplexAdminService = __decorate([
    (0, common_1.Injectable)(),
    __param(7, (0, common_1.Inject)(complex_media_port_1.COMPLEX_MEDIA)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        regions_service_1.RegionsService,
        complex_query_service_1.ComplexQueryService,
        trade_stats_service_1.TradeStatsService,
        cache_service_1.CacheService,
        app_config_service_1.AppConfig,
        trade_sync_jobs_1.TradeSyncJobs, Object])
], ComplexAdminService);
//# sourceMappingURL=complex-admin.service.js.map