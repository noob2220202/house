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
exports.InterestRegionsController = exports.FavoriteAgenciesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const decorators_1 = require("../../../common/decorators");
const throttle_constants_1 = require("../../../common/throttle/throttle.constants");
const dto_1 = require("../dto");
const favorite_agencies_service_1 = require("../services/favorite-agencies.service");
const interest_regions_service_1 = require("../services/interest-regions.service");
/** 관심 중개사무소 (same contract as 관심 매물/단지: id list via GET, idempotent PUT/DELETE). */
let FavoriteAgenciesController = class FavoriteAgenciesController {
    constructor(favorites) {
        this.favorites = favorites;
    }
    list(user, q) {
        return this.favorites.list(user.userId, q);
    }
    add(user, p) {
        return this.favorites.add(user.userId, p.id);
    }
    remove(user, p) {
        return this.favorites.remove(user.userId, p.id);
    }
};
exports.FavoriteAgenciesController = FavoriteAgenciesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.PaginationQueryDto]),
    __metadata("design:returntype", Promise)
], FavoriteAgenciesController.prototype, "list", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], FavoriteAgenciesController.prototype, "add", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], FavoriteAgenciesController.prototype, "remove", null);
exports.FavoriteAgenciesController = FavoriteAgenciesController = __decorate([
    (0, swagger_1.ApiTags)('home'),
    (0, common_1.Controller)('me/favorites/agencies'),
    __metadata("design:paramtypes", [favorite_agencies_service_1.FavoriteAgenciesService])
], FavoriteAgenciesController);
/** 관심 지역 (signup step + MY). */
let InterestRegionsController = class InterestRegionsController {
    constructor(interest) {
        this.interest = interest;
    }
    get(user) {
        return this.interest.get(user.userId);
    }
    put(user, dto) {
        return this.interest.put(user.userId, dto);
    }
};
exports.InterestRegionsController = InterestRegionsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InterestRegionsController.prototype, "get", null);
__decorate([
    (0, common_1.Put)(),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.InterestRegionsInputDto]),
    __metadata("design:returntype", Promise)
], InterestRegionsController.prototype, "put", null);
exports.InterestRegionsController = InterestRegionsController = __decorate([
    (0, swagger_1.ApiTags)('home'),
    (0, common_1.Controller)('me/interest-regions'),
    __metadata("design:paramtypes", [interest_regions_service_1.InterestRegionsService])
], InterestRegionsController);
//# sourceMappingURL=me.controller.js.map