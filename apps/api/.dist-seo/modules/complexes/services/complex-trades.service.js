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
exports.ComplexTradesService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const client_1 = require("@prisma/client");
const app_exception_1 = require("../../../common/errors/app.exception");
const pagination_1 = require("../../../common/pagination/pagination");
const area_1 = require("../../../common/utils/area");
const decimal_1 = require("../../../common/utils/decimal");
const prisma_service_1 = require("../../../prisma/prisma.service");
const complex_mapper_1 = require("../complex.mapper");
/** 실거래가 reads for 단지 pages: trade list, monthly trends per 평형, latest per 평형. */
let ComplexTradesService = class ComplexTradesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(complexId, q) {
        await this.assertComplex(complexId);
        const where = {
            complexId,
            ...(q.dealType ? { dealType: q.dealType } : {}),
            ...(q.areaTypeId ? { areaTypeId: q.areaTypeId } : {}),
            ...(q.fromYm || q.toYm
                ? {
                    dealYm: {
                        ...(q.fromYm ? { gte: q.fromYm } : {}),
                        ...(q.toYm ? { lte: q.toYm } : {}),
                    },
                }
                : {}),
            ...(q.includeCancelled ? {} : { cancelled: false }),
        };
        return (0, pagination_1.paginate)(q, async (args) => (await this.prisma.tradeRecord.findMany({
            where,
            orderBy: [{ dealDate: 'desc' }, { id: 'desc' }],
            select: complex_mapper_1.TRADE_SELECT,
            ...args,
        })).map(complex_mapper_1.toTradeView), () => this.prisma.tradeRecord.count({ where }));
    }
    async stats(complexId, q) {
        await this.assertComplex(complexId);
        const areaTypes = await this.prisma.complexAreaType.findMany({
            where: { complexId },
            select: complex_mapper_1.AREA_TYPE_SELECT,
            orderBy: [{ exclusiveArea: 'asc' }, { typeName: 'asc' }],
        });
        const selected = q.areaTypeId ? areaTypes.find((a) => a.id === q.areaTypeId) : undefined;
        if (q.areaTypeId && !selected)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.COMPLEX_AREA_TYPE_NOT_FOUND);
        const latestStat = await this.prisma.complexTradeStat.findFirst({
            where: { complexId, dealType: q.dealType },
            orderBy: { yearMonth: 'desc' },
            select: { yearMonth: true },
        });
        const toYm = latestStat?.yearMonth ?? null;
        const fromYm = toYm === null ? null : (0, shared_1.addMonths)(toYm, -(q.months - 1));
        const latest = await this.latestTrades(complexId, q.dealType);
        if (toYm === null || fromYm === null) {
            return { complexId, dealType: q.dealType, fromYm, toYm, series: [], overall: [], latest };
        }
        const stats = await this.prisma.complexTradeStat.findMany({
            where: {
                complexId,
                dealType: q.dealType,
                yearMonth: { gte: fromYm, lte: toYm },
                ...(selected ? { exclusiveArea: selected.exclusiveArea } : {}),
            },
            orderBy: [{ exclusiveArea: 'asc' }, { yearMonth: 'asc' }],
        });
        const series = new Map();
        for (const s of stats) {
            const key = s.exclusiveArea.toFixed(2);
            let entry = series.get(key);
            if (!entry) {
                const area = s.exclusiveArea.toNumber();
                const at = areaTypes.find((a) => a.exclusiveArea.equals(s.exclusiveArea));
                entry = {
                    exclusiveArea: area,
                    exclusivePyeong: (0, shared_1.sqmToPyeong)(area),
                    areaTypeId: at?.id ?? null,
                    pyeongLabel: at ? (0, complex_mapper_1.areaTypeLabel)(at) : (0, area_1.pyeongLabel)(area),
                    points: [],
                };
                series.set(key, entry);
            }
            entry.points.push({
                yearMonth: s.yearMonth,
                tradeCount: s.tradeCount,
                medianPrice: s.medianPrice,
                minPrice: s.minPrice,
                maxPrice: s.maxPrice,
                avgPrice: s.avgPrice,
                medianMonthlyRent: s.medianMonthlyRent,
            });
        }
        return {
            complexId,
            dealType: q.dealType,
            fromYm,
            toYm,
            series: [...series.values()],
            overall: selected ? [] : await this.overall(complexId, q.dealType, fromYm, toYm),
            latest: selected ? latest.filter((t) => this.belongsTo(t, selected)) : latest,
        };
    }
    /** Latest non-cancelled trade per 평형 (or 전용면적 when unassigned) and deal type. */
    async latestTrades(complexId, dealType) {
        const typeFilter = dealType
            ? client_1.Prisma.sql `AND deal_type = ${dealType}::trade_deal_type`
            : client_1.Prisma.empty;
        const ids = await this.prisma.$queryRaw `
      SELECT DISTINCT ON (COALESCE(area_type_id::text, exclusive_area::text), deal_type) id
      FROM trade_records
      WHERE complex_id = ${complexId}::uuid AND NOT cancelled ${typeFilter}
      ORDER BY COALESCE(area_type_id::text, exclusive_area::text), deal_type, deal_date DESC, id DESC
      LIMIT 200`;
        if (ids.length === 0)
            return [];
        const rows = await this.prisma.tradeRecord.findMany({
            where: { id: { in: ids.map((r) => r.id) } },
            select: complex_mapper_1.TRADE_SELECT,
            orderBy: [{ exclusiveArea: 'asc' }, { dealType: 'asc' }],
        });
        return rows.map(complex_mapper_1.toTradeView);
    }
    belongsTo(t, at) {
        return (t.areaTypeId === at.id ||
            (t.areaTypeId === null && t.exclusiveArea === (0, decimal_1.decimalToNumber)(at.exclusiveArea)));
    }
    async overall(complexId, dealType, fromYm, toYm) {
        const rows = await this.prisma.$queryRaw `
      SELECT deal_ym AS "yearMonth",
             count(*)::int AS "tradeCount",
             round(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(price, deposit)))::int AS "medianPrice",
             min(COALESCE(price, deposit))::int AS "minPrice",
             max(COALESCE(price, deposit))::int AS "maxPrice",
             round(avg(COALESCE(price, deposit)))::int AS "avgPrice",
             CASE WHEN ${dealType}::trade_deal_type = 'MONTHLY'
                  THEN round(percentile_cont(0.5) WITHIN GROUP (ORDER BY monthly_rent))::int
             END AS "medianMonthlyRent"
      FROM trade_records
      WHERE complex_id = ${complexId}::uuid
        AND deal_type = ${dealType}::trade_deal_type
        AND deal_ym BETWEEN ${fromYm} AND ${toYm}
        AND NOT cancelled
        AND COALESCE(price, deposit) IS NOT NULL
      GROUP BY deal_ym
      ORDER BY deal_ym`;
        return rows;
    }
    async assertComplex(id) {
        const n = await this.prisma.complex.count({ where: { id, deletedAt: null } });
        if (n === 0)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.COMPLEX_NOT_FOUND);
    }
};
exports.ComplexTradesService = ComplexTradesService;
exports.ComplexTradesService = ComplexTradesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ComplexTradesService);
//# sourceMappingURL=complex-trades.service.js.map