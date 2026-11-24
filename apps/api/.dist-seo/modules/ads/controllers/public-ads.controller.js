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
exports.PublicAdsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const decorators_1 = require("../../../common/decorators");
const auth_1 = require("../../auth");
const constants_1 = require("../constants");
const dto_1 = require("../dto");
const ad_serve_service_1 = require("../services/ad-serve.service");
const ad_tracking_service_1 = require("../services/ad-tracking.service");
const header = (req, name, max) => {
    const v = req.headers[name];
    return typeof v === 'string' ? v.slice(0, max) : null;
};
function visitorOf(req) {
    return {
        sessionId: req.principal?.sessionId ?? null,
        ip: req.ip ?? null,
        userAgent: header(req, 'user-agent', 500),
        fetchDest: header(req, 'sec-fetch-dest', 32),
        fetchMode: header(req, 'sec-fetch-mode', 32),
    };
}
/**
 * Public ad serving + tracking. Beacons are POSTs: the frontend sends them with
 * `fetch(..., { method: 'POST', keepalive: true, credentials: 'include' })` plus the CSRF header
 * when logged in (sendBeacon cannot set headers). Beacons are not member actions, so they are
 * exempt from TermsConsentGuard (@SkipTermsCheck): they count for members with pending terms.
 */
let PublicAdsController = class PublicAdsController {
    constructor(serve, tracking) {
        this.serve = serve;
        this.tracking = tracking;
    }
    async banners(q) {
        return { items: await this.serve.banners(q) };
    }
    async popups(q) {
        return { items: await this.serve.popups(q.page) };
    }
    async impressions(dto, req) {
        await this.tracking.recordImpressions(dto.ids, visitorOf(req));
    }
    async impression(p, req) {
        await this.tracking.recordImpressions([p.id], visitorOf(req));
    }
    // A GET (the guard never blocks reads); marked so a later switch to POST keeps counting.
    async click(p, req) {
        return { url: await this.tracking.click(p.id, visitorOf(req)), statusCode: common_1.HttpStatus.FOUND };
    }
};
exports.PublicAdsController = PublicAdsController;
__decorate([
    (0, common_1.Get)('banners'),
    (0, common_1.Header)('Cache-Control', 'public, max-age=30'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.BannerServeQueryDto]),
    __metadata("design:returntype", Promise)
], PublicAdsController.prototype, "banners", null);
__decorate([
    (0, common_1.Get)('popups'),
    (0, common_1.Header)('Cache-Control', 'public, max-age=30'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.PopupServeQueryDto]),
    __metadata("design:returntype", Promise)
], PublicAdsController.prototype, "popups", null);
__decorate([
    (0, common_1.Post)('banners/impressions'),
    (0, auth_1.SkipTermsCheck)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, throttler_1.Throttle)(constants_1.AD_TRACKING_THROTTLE),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.BannerImpressionBatchDto, Object]),
    __metadata("design:returntype", Promise)
], PublicAdsController.prototype, "impressions", null);
__decorate([
    (0, common_1.Post)('banners/:id/impression'),
    (0, auth_1.SkipTermsCheck)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, throttler_1.Throttle)(constants_1.AD_TRACKING_THROTTLE),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto, Object]),
    __metadata("design:returntype", Promise)
], PublicAdsController.prototype, "impression", null);
__decorate([
    (0, common_1.Get)('banners/:id/click'),
    (0, auth_1.SkipTermsCheck)(),
    (0, common_1.Redirect)(),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    (0, common_1.Header)('Referrer-Policy', 'strict-origin-when-cross-origin'),
    (0, throttler_1.Throttle)(constants_1.AD_TRACKING_THROTTLE),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto, Object]),
    __metadata("design:returntype", Promise)
], PublicAdsController.prototype, "click", null);
exports.PublicAdsController = PublicAdsController = __decorate([
    (0, swagger_1.ApiTags)('ads'),
    (0, common_1.Controller)(),
    (0, decorators_1.Public)(),
    __metadata("design:paramtypes", [ad_serve_service_1.AdServeService,
        ad_tracking_service_1.AdTrackingService])
], PublicAdsController);
//# sourceMappingURL=public-ads.controller.js.map