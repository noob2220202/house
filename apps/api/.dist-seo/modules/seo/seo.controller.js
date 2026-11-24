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
exports.SeoController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../common/decorators");
const dto_1 = require("./dto");
const seo_regions_service_1 = require("./services/seo-regions.service");
const seo_reports_service_1 = require("./services/seo-reports.service");
const seo_sitemap_service_1 = require("./services/seo-sitemap.service");
/** Read-only public data for search landing pages, sitemaps, llms.txt and the 실거래 report. */
let SeoController = class SeoController {
    constructor(regions, reports, sitemaps) {
        this.regions = regions;
        this.reports = reports;
        this.sitemaps = sitemaps;
    }
    /** 읍면동/리 with listings, 단지 or 아파트 실거래 (counts per asset type; Redis 10 min). */
    regionIndex() {
        return this.regions.index();
    }
    /** Facts of one landing page: listings per deal type, 단지, 12-month 실거래 (Redis 10 min). */
    landing(p, q) {
        return this.regions.landing(p.code, q.assetTypes);
    }
    /** Monthly 아파트 매매 실거래 report (default: latest reported month; Redis 1 h). */
    apartmentTrades(q) {
        return this.reports.apartmentTrades(q.ym);
    }
    /** Public 단지 / 매물 / 중개사무소 ids with their last change (≤ 50,000; Redis 15 min). */
    sitemap(p) {
        return this.sitemaps.sitemap(p.kind);
    }
    /** PUBLIC / GONE of a published listing (redirect target for closed listings; not cached). */
    listingStatus(p) {
        return this.sitemaps.listingStatus(p.id);
    }
};
exports.SeoController = SeoController;
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)('regions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SeoController.prototype, "regionIndex", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)('regions/:code/landing'),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.SeoRegionParamDto,
        dto_1.SeoLandingQueryDto]),
    __metadata("design:returntype", Promise)
], SeoController.prototype, "landing", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)('reports/apartment-trades'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.SeoReportQueryDto]),
    __metadata("design:returntype", Promise)
], SeoController.prototype, "apartmentTrades", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)('sitemap/:kind'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.SeoSitemapParamDto]),
    __metadata("design:returntype", Promise)
], SeoController.prototype, "sitemap", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)('listings/:id/status'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.SeoIdParamDto]),
    __metadata("design:returntype", Promise)
], SeoController.prototype, "listingStatus", null);
exports.SeoController = SeoController = __decorate([
    (0, swagger_1.ApiTags)('seo'),
    (0, common_1.Controller)('seo'),
    __metadata("design:paramtypes", [seo_regions_service_1.SeoRegionsService,
        seo_reports_service_1.SeoReportsService,
        seo_sitemap_service_1.SeoSitemapService])
], SeoController);
//# sourceMappingURL=seo.controller.js.map