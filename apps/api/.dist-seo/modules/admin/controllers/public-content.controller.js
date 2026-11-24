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
exports.PublicContentController = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../../common/decorators");
const dto_1 = require("../dto");
const faqs_service_1 = require("../services/faqs.service");
const notices_service_1 = require("../services/notices.service");
const site_settings_service_1 = require("../services/site-settings.service");
const videos_service_1 = require("../services/videos.service");
/** Public site content: 공지사항, FAQ, 지역 영상, footer/business settings. */
let PublicContentController = class PublicContentController {
    constructor(notices, faqs, videos, settings) {
        this.notices = notices;
        this.faqs = faqs;
        this.videos = videos;
        this.settings = settings;
    }
    listNotices(q) {
        return this.notices.publicList(q);
    }
    notice(p, userAgent) {
        return this.notices.publicDetail(p.id, !(0, shared_1.isBotUserAgent)(userAgent));
    }
    listFaqs(q) {
        return this.faqs.publicList(q);
    }
    listVideos(q) {
        return this.videos.publicList(q);
    }
    siteSettings() {
        return this.settings.publicSettings();
    }
};
exports.PublicContentController = PublicContentController;
__decorate([
    (0, common_1.Get)('notices'),
    (0, common_1.Header)('Cache-Control', 'public, max-age=60'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.PaginationQueryDto]),
    __metadata("design:returntype", Promise)
], PublicContentController.prototype, "listNotices", null);
__decorate([
    (0, common_1.Get)('notices/:id'),
    (0, common_1.Header)('Cache-Control', 'no-cache'),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto, Object]),
    __metadata("design:returntype", Promise)
], PublicContentController.prototype, "notice", null);
__decorate([
    (0, common_1.Get)('faqs'),
    (0, common_1.Header)('Cache-Control', 'public, max-age=60'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.FaqListQueryDto]),
    __metadata("design:returntype", Promise)
], PublicContentController.prototype, "listFaqs", null);
__decorate([
    (0, common_1.Get)('videos'),
    (0, common_1.Header)('Cache-Control', 'public, max-age=60'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.LocalVideoListQueryDto]),
    __metadata("design:returntype", Promise)
], PublicContentController.prototype, "listVideos", null);
__decorate([
    (0, common_1.Get)('site-settings/public'),
    (0, common_1.Header)('Cache-Control', 'public, max-age=300'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PublicContentController.prototype, "siteSettings", null);
exports.PublicContentController = PublicContentController = __decorate([
    (0, swagger_1.ApiTags)('content'),
    (0, decorators_1.Public)(),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [notices_service_1.NoticesService,
        faqs_service_1.FaqsService,
        videos_service_1.VideosService,
        site_settings_service_1.SiteSettingsService])
], PublicContentController);
//# sourceMappingURL=public-content.controller.js.map