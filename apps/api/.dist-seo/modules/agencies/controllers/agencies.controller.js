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
exports.AgenciesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../../common/decorators");
const dto_1 = require("../dto");
const agency_public_service_1 = require("../services/agency-public.service");
/** 중개사무소 찾기 (public): list search, map, profile. Only APPROVED agencies are visible. */
let AgenciesController = class AgenciesController {
    constructor(agencies) {
        this.agencies = agencies;
    }
    search(q) {
        return this.agencies.search(q);
    }
    /** 읍면동 facet (code, name, office count) for the 지역 filter. Before `:id`. */
    regions() {
        return this.agencies.regions();
    }
    map(q) {
        return this.agencies.map(q);
    }
    profile(p) {
        return this.agencies.profile(p.id);
    }
};
exports.AgenciesController = AgenciesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.AgencySearchQueryDto]),
    __metadata("design:returntype", Promise)
], AgenciesController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('regions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AgenciesController.prototype, "regions", null);
__decorate([
    (0, common_1.Get)('map'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.AgencyMapQueryDto]),
    __metadata("design:returntype", Promise)
], AgenciesController.prototype, "map", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AgenciesController.prototype, "profile", null);
exports.AgenciesController = AgenciesController = __decorate([
    (0, swagger_1.ApiTags)('agencies'),
    (0, decorators_1.Public)(),
    (0, common_1.Controller)('agencies'),
    __metadata("design:paramtypes", [agency_public_service_1.AgencyPublicService])
], AgenciesController);
//# sourceMappingURL=agencies.controller.js.map