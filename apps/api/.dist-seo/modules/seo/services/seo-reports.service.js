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
exports.SeoReportsService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const cache_service_1 = require("../../../common/cache/cache.service");
const app_exception_1 = require("../../../common/errors/app.exception");
const app_config_service_1 = require("../../../config/app-config.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
const constants_1 = require("../constants");
const seo_domain_1 = require("../seo.domain");
const seo_regions_service_1 = require("./seo-regions.service");
/**
 * Monthly 아파트 매매 실거래 report of the service 시군구 (/reports/suncheon-apartment-trades):
 * 거래량, 평균·중위 거래가 overall and per 법정동, from the 국토교통부 rows synced into
 * trade_records. 해제(cancelled) trades are excluded from every statistic and counted separately.
 */
let SeoReportsService = class SeoReportsService {
    constructor(prisma, cache, config, regions) {
        this.prisma = prisma;
        this.cache = cache;
        this.config = config;
        this.regions = regions;
    }
    get sggCode() {
        return this.config.get('REGION_SGG_CODE');
    }
    async apartmentTrades(ym, now = new Date()) {
        const currentYm = (0, shared_1.yearMonthOf)(now);
        const months = await this.availableMonths();
        const latest = (0, seo_domain_1.latestReportMonth)(months, currentYm);
        const target = ym ?? latest;
        if (target === null || !months.includes(target)) {
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.NOT_FOUND);
        }
        return this.cache.getOrSet(`cache:seo:report:apt-trades:${this.sggCode}:${target}:${latest}:${months.length}`, constants_1.SEO_CACHE_TTL_SECONDS.REPORT, () => this.compute(target, latest, months, now));
    }
    /** Months with at least one non-cancelled 매매 trade, newest first. */
    async availableMonths() {
        const rows = await this.prisma.$queryRaw `
      SELECT t.deal_ym AS "ym" FROM trade_records t
      WHERE t.sgg_code = ${this.sggCode} AND t.kind = 'APT_TRADE'::trade_sync_kind
        AND t.deal_type = 'SALE'::trade_deal_type AND t.cancelled = false
      GROUP BY 1 ORDER BY 1 DESC LIMIT ${constants_1.REPORT_MONTHS}`;
        return rows.map((r) => r.ym);
    }
    async compute(ym, latest, months, now) {
        const sgg = this.sggCode;
        const prev = (0, shared_1.addMonths)(ym, -1);
        const yearAgo = (0, shared_1.addMonths)(ym, -12);
        const [rows, index, regionName, sync] = await Promise.all([
            this.prisma.$queryRaw `
        SELECT t.deal_type::text AS "dealType", t.deal_ym AS "dealYm", t.cancelled,
          t.price, t.deposit, t.exclusive_area::float AS "exclusiveArea", t.emd_name AS "emdName",
          t.apt_name AS "aptName", c.id AS "complexId", c.name AS "complexName",
          c.emd_code AS "complexEmdCode"
        FROM trade_records t
        LEFT JOIN complexes c ON c.id = t.complex_id AND c.deleted_at IS NULL
        WHERE t.sgg_code = ${sgg}
          AND t.deal_type IN ('SALE'::trade_deal_type, 'JEONSE'::trade_deal_type)
          AND t.deal_ym IN (${ym}, ${prev}, ${yearAgo})`,
            this.regions.regionIndex(),
            this.regions.regionName(),
            this.prisma.tradeSyncRun.findFirst({
                where: { kind: 'APT_TRADE', sggCode: sgg, yearMonth: ym, status: 'SUCCEEDED' },
                orderBy: { finishedAt: 'desc' },
                select: { finishedAt: true },
            }),
        ]);
        const salesOf = (month) => rows.filter((r) => r.dealYm === month &&
            r.dealType === 'SALE' &&
            !r.cancelled &&
            r.price !== null &&
            r.price > 0);
        const summaryOf = (month) => {
            const sales = salesOf(month);
            return sales.length
                ? (0, seo_domain_1.summarizeSales)(sales.map((r) => ({ price: r.price, exclusiveArea: r.exclusiveArea })))
                : null;
        };
        const sales = salesOf(ym).map((r) => ({
            price: r.price,
            exclusiveArea: r.exclusiveArea,
            emdName: r.emdName,
            complexRegionKey: (0, seo_domain_1.regionKeyOf)(r.complexEmdCode),
            complexId: r.complexId,
            complexName: r.complexName,
            aptName: r.aptName,
        }));
        const cancelledCount = rows.filter((r) => r.dealYm === ym && r.dealType === 'SALE' && r.cancelled).length;
        const resolve = (0, seo_domain_1.regionNameResolver)(index);
        const prevSummary = summaryOf(prev);
        const yearAgoSummary = summaryOf(yearAgo);
        return {
            sggCode: sgg,
            regionName,
            yearMonth: ym,
            latestYearMonth: latest,
            availableMonths: months,
            sale: { ...(0, seo_domain_1.summarizeSales)(sales), cancelledCount },
            jeonse: (0, seo_domain_1.summarizeDeposits)(rows
                .filter((r) => r.dealYm === ym && r.dealType === 'JEONSE' && !r.cancelled)
                .map((r) => r.deposit ?? 0)),
            previous: prevSummary ? { yearMonth: prev, sale: prevSummary } : null,
            yearAgo: yearAgoSummary ? { yearMonth: yearAgo, sale: yearAgoSummary } : null,
            byRegion: (0, seo_domain_1.groupByRegion)(sales, index, resolve).map((g) => ({
                regionCode: g.regionCode,
                name: g.name,
                sale: (0, seo_domain_1.summarizeSales)(g.rows),
            })),
            topComplexes: (0, seo_domain_1.topComplexes)(sales, constants_1.REPORT_TOP_COMPLEXES).map((c) => ({
                complexId: c.complexId,
                name: c.name,
                emdName: c.emdName,
                count: c.prices.length,
                medianPrice: (0, seo_domain_1.median)(c.prices),
            })),
            syncedAt: sync?.finishedAt?.toISOString() ?? null,
            updatedAt: now.toISOString(),
        };
    }
};
exports.SeoReportsService = SeoReportsService;
exports.SeoReportsService = SeoReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService,
        app_config_service_1.AppConfig,
        seo_regions_service_1.SeoRegionsService])
], SeoReportsService);
//# sourceMappingURL=seo-reports.service.js.map