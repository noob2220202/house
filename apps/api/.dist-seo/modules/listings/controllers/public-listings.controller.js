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
exports.PublicListingsController = exports.MapController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../../common/decorators");
const auth_1 = require("../../auth");
const dto_1 = require("../dto");
const listing_query_service_1 = require("../services/listing-query.service");
const map_search_service_1 = require("../services/map-search.service");
const similar_listings_service_1 = require("../services/similar-listings.service");
let MapController = class MapController {
    constructor(map) {
        this.map = map;
    }
    /** bbox + zoom + filters → 읍면동 clusters / grid clusters / 단지·매물 markers. */
    search(q) {
        return this.map.search(q);
    }
};
exports.MapController = MapController;
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.MapSearchQueryDto]),
    __metadata("design:returntype", Promise)
], MapController.prototype, "search", null);
exports.MapController = MapController = __decorate([
    (0, swagger_1.ApiTags)('listings'),
    (0, common_1.Controller)('map'),
    __metadata("design:paramtypes", [map_search_service_1.MapSearchService])
], MapController);
let PublicListingsController = class PublicListingsController {
    constructor(listings, similarListings) {
        this.listings = listings;
        this.similarListings = similarListings;
    }
    list(q) {
        return this.listings.list(q);
    }
    detail(p, principal) {
        return this.listings.detail(p.id, principal);
    }
    /** 비슷한 매물: 같은 단지 · 같은 지역 같은 평형 · 같은 가격대 (first cards + totals). */
    similar(p) {
        return this.similarListings.similar(p.id);
    }
    /**
     * View beacon of the detail page: counts a deduped view (same viewer key as GET /listings/:id,
     * so the SSR read and the beacon count once) and records the recent view of a signed-in user.
     * Not a member action: it still counts while the member has terms pending (TermsConsentGuard).
     */
    async view(p, principal, res) {
        res.setHeader('Cache-Control', 'no-store');
        await this.listings.recordView(p.id, principal);
    }
};
exports.PublicListingsController = PublicListingsController;
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.ListingListQueryDto]),
    __metadata("design:returntype", Promise)
], PublicListingsController.prototype, "list", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, decorators_1.CurrentPrincipal)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto, Object]),
    __metadata("design:returntype", Promise)
], PublicListingsController.prototype, "detail", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)(':id/similar'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], PublicListingsController.prototype, "similar", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, auth_1.SkipTermsCheck)(),
    (0, common_1.Post)(':id/view'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, decorators_1.CurrentPrincipal)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto, Object, Object]),
    __metadata("design:returntype", Promise)
], PublicListingsController.prototype, "view", null);
exports.PublicListingsController = PublicListingsController = __decorate([
    (0, swagger_1.ApiTags)('listings'),
    (0, common_1.Controller)('listings'),
    __metadata("design:paramtypes", [listing_query_service_1.ListingQueryService,
        similar_listings_service_1.SimilarListingsService])
], PublicListingsController);
//# sourceMappingURL=public-listings.controller.js.map