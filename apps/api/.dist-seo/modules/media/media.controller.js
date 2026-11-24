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
exports.MediaController = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const decorators_1 = require("../../common/decorators");
const throttle_constants_1 = require("../../common/throttle/throttle.constants");
const dto_1 = require("./dto");
const media_library_service_1 = require("./media-library.service");
const media_upload_service_1 = require("./media-upload.service");
const private_file_response_1 = require("./private-file.response");
const upload_interceptor_1 = require("./upload.interceptor");
let MediaController = class MediaController {
    constructor(uploads, library) {
        this.uploads = uploads;
        this.library = library;
    }
    /** multipart `file`; 202 for images (the worker decodes them; poll GET /media/:id), 201 for PDFs. */
    async upload(q, file, user, res) {
        const view = await this.uploads.upload(file, q.purpose, { kind: 'USER', principal: user });
        res.status(view.status === shared_1.MediaStatus.PENDING ? common_1.HttpStatus.ACCEPTED : common_1.HttpStatus.CREATED);
        return view;
    }
    listMine(q, user) {
        return this.library.listMine(user, q);
    }
    get(p, principal) {
        return this.library.getForViewer(p.id, principal);
    }
    /** Private file (agency documents): its uploader or staff of the agency it is attached to. */
    async privateFile(p, user) {
        const file = await this.library.openPrivate(p.id, user);
        return (0, private_file_response_1.privateFileResponse)(file);
    }
    delete(p, user) {
        return this.library.deleteMine(p.id, user);
    }
};
exports.MediaController = MediaController;
__decorate([
    (0, common_1.Post)(),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    (0, common_1.UseInterceptors)(upload_interceptor_1.MediaUploadInterceptor),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, decorators_1.CurrentUser)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.MediaUploadQueryDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], MediaController.prototype, "upload", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.MyMediaListQueryDto, Object]),
    __metadata("design:returntype", Promise)
], MediaController.prototype, "listMine", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, decorators_1.Public)(),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, decorators_1.CurrentPrincipal)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto, Object]),
    __metadata("design:returntype", Promise)
], MediaController.prototype, "get", null);
__decorate([
    (0, common_1.Get)(':id/private'),
    (0, common_1.Header)('Cache-Control', private_file_response_1.PRIVATE_FILE_HEADERS['Cache-Control']),
    (0, common_1.Header)('Content-Security-Policy', private_file_response_1.PRIVATE_FILE_HEADERS['Content-Security-Policy']),
    (0, common_1.Header)('X-Content-Type-Options', private_file_response_1.PRIVATE_FILE_HEADERS['X-Content-Type-Options']),
    (0, common_1.Header)('Cross-Origin-Resource-Policy', private_file_response_1.PRIVATE_FILE_HEADERS['Cross-Origin-Resource-Policy']),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto, Object]),
    __metadata("design:returntype", Promise)
], MediaController.prototype, "privateFile", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto, Object]),
    __metadata("design:returntype", Promise)
], MediaController.prototype, "delete", null);
exports.MediaController = MediaController = __decorate([
    (0, swagger_1.ApiTags)('media'),
    (0, common_1.Controller)('media'),
    __metadata("design:paramtypes", [media_upload_service_1.MediaUploadService,
        media_library_service_1.MediaLibraryService])
], MediaController);
//# sourceMappingURL=media.controller.js.map