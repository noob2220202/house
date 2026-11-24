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
exports.AdminVideosController = exports.AdminFaqsController = exports.AdminNoticesController = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../../common/decorators");
const dto_1 = require("../dto");
const permissions_decorator_1 = require("../permissions.decorator");
const faqs_service_1 = require("../services/faqs.service");
const notices_service_1 = require("../services/notices.service");
const videos_service_1 = require("../services/videos.service");
let AdminNoticesController = class AdminNoticesController {
    constructor(notices) {
        this.notices = notices;
    }
    list(q) {
        return this.notices.adminList(q);
    }
    detail(p) {
        return this.notices.adminDetail(p.id);
    }
    create(dto, admin) {
        return this.notices.create(dto, admin);
    }
    update(p, dto) {
        return this.notices.update(p.id, dto);
    }
    remove(p) {
        return this.notices.remove(p.id);
    }
};
exports.AdminNoticesController = AdminNoticesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.NoticeAdminListQueryDto]),
    __metadata("design:returntype", Promise)
], AdminNoticesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminNoticesController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(),
    (0, decorators_1.Audit)({ action: 'notice.create', resourceType: 'Notice' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.NoticeInputDto, Object]),
    __metadata("design:returntype", Promise)
], AdminNoticesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, decorators_1.Audit)({ action: 'notice.update', resourceType: 'Notice' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto, dto_1.NoticeUpdateDto]),
    __metadata("design:returntype", Promise)
], AdminNoticesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, decorators_1.Audit)({ action: 'notice.delete', resourceType: 'Notice' }),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminNoticesController.prototype, "remove", null);
exports.AdminNoticesController = AdminNoticesController = __decorate([
    (0, swagger_1.ApiTags)('admin/content'),
    (0, permissions_decorator_1.RequirePermission)(shared_1.AdminPermission.CONTENT_MANAGE),
    (0, common_1.Controller)('admin/notices'),
    __metadata("design:paramtypes", [notices_service_1.NoticesService])
], AdminNoticesController);
let AdminFaqsController = class AdminFaqsController {
    constructor(faqs) {
        this.faqs = faqs;
    }
    list(q) {
        return this.faqs.adminList(q);
    }
    /** Declared before `:id` routes so "order" is never parsed as an id. */
    reorder(dto) {
        return this.faqs.reorder(dto);
    }
    detail(p) {
        return this.faqs.adminDetail(p.id);
    }
    create(dto) {
        return this.faqs.create(dto);
    }
    update(p, dto) {
        return this.faqs.update(p.id, dto);
    }
    remove(p) {
        return this.faqs.remove(p.id);
    }
};
exports.AdminFaqsController = AdminFaqsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.FaqAdminListQueryDto]),
    __metadata("design:returntype", Promise)
], AdminFaqsController.prototype, "list", null);
__decorate([
    (0, common_1.Put)('order'),
    (0, decorators_1.Audit)({ action: 'faq.reorder', resourceType: 'Faq' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.FaqOrderDto]),
    __metadata("design:returntype", Promise)
], AdminFaqsController.prototype, "reorder", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminFaqsController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(),
    (0, decorators_1.Audit)({ action: 'faq.create', resourceType: 'Faq' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.FaqInputDto]),
    __metadata("design:returntype", Promise)
], AdminFaqsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, decorators_1.Audit)({ action: 'faq.update', resourceType: 'Faq' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto, dto_1.FaqUpdateDto]),
    __metadata("design:returntype", Promise)
], AdminFaqsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, decorators_1.Audit)({ action: 'faq.delete', resourceType: 'Faq' }),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminFaqsController.prototype, "remove", null);
exports.AdminFaqsController = AdminFaqsController = __decorate([
    (0, swagger_1.ApiTags)('admin/content'),
    (0, permissions_decorator_1.RequirePermission)(shared_1.AdminPermission.CONTENT_MANAGE),
    (0, common_1.Controller)('admin/faqs'),
    __metadata("design:paramtypes", [faqs_service_1.FaqsService])
], AdminFaqsController);
let AdminVideosController = class AdminVideosController {
    constructor(videos) {
        this.videos = videos;
    }
    list(q) {
        return this.videos.adminList(q);
    }
    /** `{ ids }` in display order → sortOrder 1…n. Declared before `:id` routes. */
    reorder(dto) {
        return this.videos.reorder(dto.ids);
    }
    detail(p) {
        return this.videos.adminDetail(p.id);
    }
    create(dto) {
        return this.videos.create(dto);
    }
    update(p, dto) {
        return this.videos.update(p.id, dto);
    }
    remove(p) {
        return this.videos.remove(p.id);
    }
};
exports.AdminVideosController = AdminVideosController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.LocalVideoAdminListQueryDto]),
    __metadata("design:returntype", Promise)
], AdminVideosController.prototype, "list", null);
__decorate([
    (0, common_1.Put)('order'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, decorators_1.Audit)({ action: 'video.reorder', resourceType: 'LocalVideo' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.VideoOrderDto]),
    __metadata("design:returntype", Promise)
], AdminVideosController.prototype, "reorder", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminVideosController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(),
    (0, decorators_1.Audit)({ action: 'video.create', resourceType: 'LocalVideo' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.LocalVideoInputDto]),
    __metadata("design:returntype", Promise)
], AdminVideosController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, decorators_1.Audit)({ action: 'video.update', resourceType: 'LocalVideo' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto, dto_1.LocalVideoUpdateDto]),
    __metadata("design:returntype", Promise)
], AdminVideosController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, decorators_1.Audit)({ action: 'video.delete', resourceType: 'LocalVideo' }),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminVideosController.prototype, "remove", null);
exports.AdminVideosController = AdminVideosController = __decorate([
    (0, swagger_1.ApiTags)('admin/content'),
    (0, permissions_decorator_1.RequirePermission)(shared_1.AdminPermission.CONTENT_MANAGE),
    (0, common_1.Controller)('admin/videos'),
    __metadata("design:paramtypes", [videos_service_1.VideosService])
], AdminVideosController);
//# sourceMappingURL=admin-content.controllers.js.map