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
exports.AdminMediaController = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const audit_service_1 = require("../../common/audit/audit.service");
const decorators_1 = require("../../common/decorators");
const dto_1 = require("./dto");
const media_cleanup_service_1 = require("./media-cleanup.service");
const media_library_service_1 = require("./media-library.service");
const media_upload_service_1 = require("./media-upload.service");
const private_file_response_1 = require("./private-file.response");
const upload_interceptor_1 = require("./upload.interceptor");
let AdminMediaController = class AdminMediaController {
    constructor(uploads, library, cleanup, audit) {
        this.uploads = uploads;
        this.library = library;
        this.cleanup = cleanup;
        this.audit = audit;
    }
    /** Banner / popup / 단지 / content images (multipart `file`). */
    async upload(q, file, admin, res) {
        const view = await this.uploads.upload(file, q.purpose, {
            kind: 'ADMIN',
            adminId: admin.adminId,
        });
        res.status(view.status === shared_1.MediaStatus.PENDING ? common_1.HttpStatus.ACCEPTED : common_1.HttpStatus.CREATED);
        return view;
    }
    list(q) {
        return this.library.listAll(q);
    }
    /** Runs the orphan cleanup now (it also runs hourly when JOBS_ENABLED). */
    runCleanup() {
        return this.cleanup.run();
    }
    get(p) {
        return this.library.getForAdmin(p.id);
    }
    /** Streams the stored file (public or private). Every view is audited. */
    async file(p) {
        const file = await this.library.openForAdmin(p.id);
        this.audit.recordSafe({ action: 'media.file.view', resourceType: 'Media', resourceId: p.id });
        return (0, private_file_response_1.privateFileResponse)(file);
    }
    /** Moderation: removes an unattached upload (attached ones are removed via their owner). */
    delete(p) {
        return this.library.deleteAsAdmin(p.id);
    }
};
exports.AdminMediaController = AdminMediaController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseInterceptors)(upload_interceptor_1.MediaUploadInterceptor),
    (0, decorators_1.Audit)({ action: 'media.upload', resourceType: 'Media' }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, decorators_1.CurrentAdmin)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.MediaUploadQueryDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminMediaController.prototype, "upload", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.AdminMediaListQueryDto]),
    __metadata("design:returntype", Promise)
], AdminMediaController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('cleanup'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, decorators_1.AdminOnly)(shared_1.AdminRole.ADMIN),
    (0, decorators_1.Audit)({ action: 'media.cleanup', resourceType: 'Media' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminMediaController.prototype, "runCleanup", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminMediaController.prototype, "get", null);
__decorate([
    (0, common_1.Get)(':id/file'),
    (0, common_1.Header)('Cache-Control', private_file_response_1.PRIVATE_FILE_HEADERS['Cache-Control']),
    (0, common_1.Header)('Content-Security-Policy', private_file_response_1.PRIVATE_FILE_HEADERS['Content-Security-Policy']),
    (0, common_1.Header)('X-Content-Type-Options', private_file_response_1.PRIVATE_FILE_HEADERS['X-Content-Type-Options']),
    (0, common_1.Header)('Cross-Origin-Resource-Policy', private_file_response_1.PRIVATE_FILE_HEADERS['Cross-Origin-Resource-Policy']),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminMediaController.prototype, "file", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, decorators_1.AdminOnly)(shared_1.AdminRole.ADMIN),
    (0, decorators_1.Audit)({ action: 'media.delete', resourceType: 'Media' }),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminMediaController.prototype, "delete", null);
exports.AdminMediaController = AdminMediaController = __decorate([
    (0, swagger_1.ApiTags)('media'),
    (0, common_1.Controller)('admin/media'),
    (0, decorators_1.AdminOnly)(shared_1.AdminRole.OPERATOR),
    __metadata("design:paramtypes", [media_upload_service_1.MediaUploadService,
        media_library_service_1.MediaLibraryService,
        media_cleanup_service_1.MediaCleanupService,
        audit_service_1.AuditService])
], AdminMediaController);
//# sourceMappingURL=admin-media.controller.js.map