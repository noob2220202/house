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
exports.HomeController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../../common/decorators");
const dto_1 = require("../dto");
const home_stats_service_1 = require("../services/home-stats.service");
let HomeController = class HomeController {
    constructor(stats) {
        this.stats = stats;
    }
    /** Site-wide counters + 지역 현황 of the home hero (cached ~2 min). */
    summary() {
        return this.stats.summary();
    }
    /** 많이 찾는 지역: 읍면동/리 by this week's listing views, with listing counts per deal type. */
    popularRegions(q) {
        return this.stats.popularRegions(q);
    }
};
exports.HomeController = HomeController;
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)('summary'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HomeController.prototype, "summary", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)('popular-regions'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.PopularRegionsQueryDto]),
    __metadata("design:returntype", Promise)
], HomeController.prototype, "popularRegions", null);
exports.HomeController = HomeController = __decorate([
    (0, swagger_1.ApiTags)('home'),
    (0, common_1.Controller)('home'),
    __metadata("design:paramtypes", [home_stats_service_1.HomeStatsService])
], HomeController);
//# sourceMappingURL=home.controller.js.map