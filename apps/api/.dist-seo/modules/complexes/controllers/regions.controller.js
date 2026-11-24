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
exports.AdminRegionsController = exports.RegionsController = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../../common/decorators");
const dto_1 = require("../dto");
const regions_service_1 = require("../services/regions.service");
let RegionsController = class RegionsController {
    constructor(regions) {
        this.regions = regions;
    }
    /** Children of `parentCode` (default: the service 시군구 → its 읍면동). */
    list(q) {
        return this.regions.list(q);
    }
    get(p) {
        return this.regions.get(p.code);
    }
};
exports.RegionsController = RegionsController;
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.RegionListQueryDto]),
    __metadata("design:returntype", Promise)
], RegionsController.prototype, "list", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)(':code'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.RegionCodeParamDto]),
    __metadata("design:returntype", Promise)
], RegionsController.prototype, "get", null);
exports.RegionsController = RegionsController = __decorate([
    (0, swagger_1.ApiTags)('regions'),
    (0, common_1.Controller)('regions'),
    __metadata("design:paramtypes", [regions_service_1.RegionsService])
], RegionsController);
let AdminRegionsController = class AdminRegionsController {
    constructor(regions) {
        this.regions = regions;
    }
    /** Idempotent load of the bundled 순천시 법정동 list (audited inside the service). */
    seedDefault() {
        return this.regions.seedDefault();
    }
    upsert(p, dto) {
        return this.regions.upsert(p.code, dto);
    }
};
exports.AdminRegionsController = AdminRegionsController;
__decorate([
    (0, common_1.Post)('seed-default'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminRegionsController.prototype, "seedDefault", null);
__decorate([
    (0, common_1.Put)(':code'),
    (0, decorators_1.Audit)({ action: 'region.upsert', resourceType: 'Region', idParam: 'code' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.RegionCodeParamDto, dto_1.RegionUpsertDto]),
    __metadata("design:returntype", Promise)
], AdminRegionsController.prototype, "upsert", null);
exports.AdminRegionsController = AdminRegionsController = __decorate([
    (0, swagger_1.ApiTags)('regions'),
    (0, common_1.Controller)('admin/regions'),
    (0, decorators_1.AdminOnly)(shared_1.AdminRole.ADMIN),
    __metadata("design:paramtypes", [regions_service_1.RegionsService])
], AdminRegionsController);
//# sourceMappingURL=regions.controller.js.map