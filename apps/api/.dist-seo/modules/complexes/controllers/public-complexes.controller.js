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
exports.PublicComplexesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../../common/decorators");
const dto_1 = require("../dto");
const complex_nearby_service_1 = require("../services/complex-nearby.service");
const complex_popularity_service_1 = require("../services/complex-popularity.service");
const complex_query_service_1 = require("../services/complex-query.service");
const complex_search_service_1 = require("../services/complex-search.service");
const complex_trades_service_1 = require("../services/complex-trades.service");
/** Static routes are declared before `:id` so they are matched first. */
let PublicComplexesController = class PublicComplexesController {
    constructor(search, popularity, query, trades, neighbourhood) {
        this.search = search;
        this.popularity = popularity;
        this.query = query;
        this.trades = trades;
        this.neighbourhood = neighbourhood;
    }
    list(q) {
        return this.search.search(q);
    }
    /** 지역(읍면동·리) + 단지명 suggestions; supports 초성 ("ㅇㅎ"). */
    autocomplete(q) {
        return this.search.autocomplete(q);
    }
    /** 자주 찾는 단지: 30-day time-decayed views, with active listing counts per deal type. */
    popular(q) {
        return this.popularity.popular(q);
    }
    detail(p, principal) {
        return this.query.detail(p.id, principal);
    }
    tradeList(p, q) {
        return this.trades.list(p.id, q);
    }
    stats(p, q) {
        return this.trades.stats(p.id, q);
    }
    listings(p) {
        return this.query.listingSummary(p.id);
    }
    /** 주변 단지 within `radius` m (default 3 km), nearest first, with listing counts per deal type. */
    async nearby(p, q) {
        return { items: await this.neighbourhood.nearby(p.id, q.limit, q.radius) };
    }
    /** Offices with public listings in this 단지, most listings first. */
    async agencies(p, q) {
        return { items: await this.neighbourhood.agencies(p.id, q.limit) };
    }
};
exports.PublicComplexesController = PublicComplexesController;
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.ComplexSearchQueryDto]),
    __metadata("design:returntype", Promise)
], PublicComplexesController.prototype, "list", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)('autocomplete'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.ComplexAutocompleteQueryDto]),
    __metadata("design:returntype", Promise)
], PublicComplexesController.prototype, "autocomplete", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)('popular'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.PopularComplexesQueryDto]),
    __metadata("design:returntype", Promise)
], PublicComplexesController.prototype, "popular", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, decorators_1.CurrentPrincipal)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto, Object]),
    __metadata("design:returntype", Promise)
], PublicComplexesController.prototype, "detail", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)(':id/trades'),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto,
        dto_1.ComplexTradesQueryDto]),
    __metadata("design:returntype", Promise)
], PublicComplexesController.prototype, "tradeList", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)(':id/stats'),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto, dto_1.ComplexStatsQueryDto]),
    __metadata("design:returntype", Promise)
], PublicComplexesController.prototype, "stats", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)(':id/listings'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], PublicComplexesController.prototype, "listings", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)(':id/nearby'),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto,
        dto_1.ComplexNearbyQueryDto]),
    __metadata("design:returntype", Promise)
], PublicComplexesController.prototype, "nearby", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)(':id/agencies'),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto,
        dto_1.ComplexAgenciesQueryDto]),
    __metadata("design:returntype", Promise)
], PublicComplexesController.prototype, "agencies", null);
exports.PublicComplexesController = PublicComplexesController = __decorate([
    (0, swagger_1.ApiTags)('complexes'),
    (0, common_1.Controller)('complexes'),
    __metadata("design:paramtypes", [complex_search_service_1.ComplexSearchService,
        complex_popularity_service_1.ComplexPopularityService,
        complex_query_service_1.ComplexQueryService,
        complex_trades_service_1.ComplexTradesService,
        complex_nearby_service_1.ComplexNearbyService])
], PublicComplexesController);
//# sourceMappingURL=public-complexes.controller.js.map