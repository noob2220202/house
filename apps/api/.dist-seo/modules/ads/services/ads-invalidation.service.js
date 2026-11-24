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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdsInvalidationService = void 0;
const common_1 = require("@nestjs/common");
const cache_service_1 = require("../../../common/cache/cache.service");
const constants_1 = require("../constants");
/**
 * Exported for other modules whose changes affect which ads may be served, e.g. an advertiser
 * agency being suspended (its banners must stop at once instead of after the serve TTL).
 */
let AdsInvalidationService = class AdsInvalidationService {
    constructor(cache) {
        this.cache = cache;
    }
    /** An advertiser agency's status changed; call after the transaction commits. */
    async agencyStatusChanged() {
        await this.cache.bump(constants_1.ADS_CACHE.BANNERS);
    }
};
exports.AdsInvalidationService = AdsInvalidationService;
exports.AdsInvalidationService = AdsInvalidationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [cache_service_1.CacheService])
], AdsInvalidationService);
//# sourceMappingURL=ads-invalidation.service.js.map