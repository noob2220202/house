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
exports.AdminComplexesController = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../../common/decorators");
const dto_1 = require("../dto");
const complex_admin_service_1 = require("../services/complex-admin.service");
let AdminComplexesController = class AdminComplexesController {
    constructor(admin) {
        this.admin = admin;
    }
    list(q) {
        return this.admin.list(q);
    }
    get(p) {
        return this.admin.get(p.id);
    }
    create(dto) {
        return this.admin.create(dto);
    }
    update(p, dto) {
        return this.admin.update(p.id, dto);
    }
    remove(p) {
        return this.admin.remove(p.id);
    }
    addAreaType(p, dto) {
        return this.admin.addAreaType(p.id, dto);
    }
    updateAreaType(p, dto) {
        return this.admin.updateAreaType(p.id, p.areaTypeId, dto);
    }
    removeAreaType(p) {
        return this.admin.removeAreaType(p.id, p.areaTypeId);
    }
    /** Replaces the 단지 photo list; order = array order. */
    setPhotos(p, dto) {
        return this.admin.setPhotos(p.id, dto);
    }
};
exports.AdminComplexesController = AdminComplexesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.AdminComplexListQueryDto]),
    __metadata("design:returntype", Promise)
], AdminComplexesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminComplexesController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(),
    (0, decorators_1.Audit)({ action: 'complex.create', resourceType: 'Complex' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreateComplexDto]),
    __metadata("design:returntype", Promise)
], AdminComplexesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, decorators_1.Audit)({ action: 'complex.update', resourceType: 'Complex' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto, dto_1.UpdateComplexDto]),
    __metadata("design:returntype", Promise)
], AdminComplexesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, decorators_1.AdminOnly)(shared_1.AdminRole.ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, decorators_1.Audit)({ action: 'complex.delete', resourceType: 'Complex' }),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminComplexesController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/area-types'),
    (0, decorators_1.Audit)({ action: 'complex.area-type.create', resourceType: 'ComplexAreaType', idParam: 'id' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto,
        dto_1.CreateAreaTypeDto]),
    __metadata("design:returntype", Promise)
], AdminComplexesController.prototype, "addAreaType", null);
__decorate([
    (0, common_1.Patch)(':id/area-types/:areaTypeId'),
    (0, decorators_1.Audit)({
        action: 'complex.area-type.update',
        resourceType: 'ComplexAreaType',
        idParam: 'areaTypeId',
    }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.AreaTypeParamDto,
        dto_1.UpdateAreaTypeDto]),
    __metadata("design:returntype", Promise)
], AdminComplexesController.prototype, "updateAreaType", null);
__decorate([
    (0, common_1.Delete)(':id/area-types/:areaTypeId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, decorators_1.Audit)({
        action: 'complex.area-type.delete',
        resourceType: 'ComplexAreaType',
        idParam: 'areaTypeId',
    }),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.AreaTypeParamDto]),
    __metadata("design:returntype", Promise)
], AdminComplexesController.prototype, "removeAreaType", null);
__decorate([
    (0, common_1.Put)(':id/photos'),
    (0, decorators_1.Audit)({ action: 'complex.photos.set', resourceType: 'Complex' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto, dto_1.ComplexPhotosDto]),
    __metadata("design:returntype", Promise)
], AdminComplexesController.prototype, "setPhotos", null);
exports.AdminComplexesController = AdminComplexesController = __decorate([
    (0, swagger_1.ApiTags)('complexes'),
    (0, common_1.Controller)('admin/complexes'),
    (0, decorators_1.AdminOnly)(shared_1.AdminRole.OPERATOR),
    __metadata("design:paramtypes", [complex_admin_service_1.ComplexAdminService])
], AdminComplexesController);
//# sourceMappingURL=admin-complexes.controller.js.map