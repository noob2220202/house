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
exports.RecentViewsController = exports.FavoriteListingsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const decorators_1 = require("../../../common/decorators");
const throttle_constants_1 = require("../../../common/throttle/throttle.constants");
const dto_1 = require("../dto");
const favorites_service_1 = require("../services/favorites.service");
const recent_views_service_1 = require("../services/recent-views.service");
let FavoriteListingsController = class FavoriteListingsController {
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
exports.FavoriteListingsController = FavoriteListingsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.PaginationQueryDto]),
    __metadata("design:returntype", Promise)
], FavoriteListingsController.prototype, "list", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], FavoriteListingsController.prototype, "add", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], FavoriteListingsController.prototype, "remove", null);
exports.FavoriteListingsController = FavoriteListingsController = __decorate([
    (0, swagger_1.ApiTags)('listings'),
    (0, common_1.Controller)('me/favorites/listings'),
    __metadata("design:paramtypes", [favorites_service_1.FavoritesService])
], FavoriteListingsController);
let RecentViewsController = class RecentViewsController {
    constructor(recent) {
        this.recent = recent;
    }
    list(user, q) {
        return this.recent.list(user.userId, q);
    }
    async clear(user, q) {
        await this.recent.clear(user.userId, q.targetType);
    }
};
exports.RecentViewsController = RecentViewsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.RecentViewsQueryDto]),
    __metadata("design:returntype", Promise)
], RecentViewsController.prototype, "list", null);
__decorate([
    (0, common_1.Delete)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.RecentViewsClearQueryDto]),
    __metadata("design:returntype", Promise)
], RecentViewsController.prototype, "clear", null);
exports.RecentViewsController = RecentViewsController = __decorate([
    (0, swagger_1.ApiTags)('listings'),
    (0, common_1.Controller)('me/recent-views'),
    __metadata("design:paramtypes", [recent_views_service_1.RecentViewsService])
], RecentViewsController);
//# sourceMappingURL=me-listings.controller.js.map