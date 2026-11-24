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
exports.AgencyCacheService = void 0;
const common_1 = require("@nestjs/common");
const cache_service_1 = require("../../../common/cache/cache.service");
const constants_1 = require("../constants");
/** Version-bump invalidation for the cached public agency reads (profiles, map tiles). */
let AgencyCacheService = class AgencyCacheService {
    constructor(cache) {
        this.cache = cache;
    }
    async publicKey(...parts) {
        const v = await this.cache.version(constants_1.AGENCY_CACHE.PUBLIC);
        return `cache:agencies:v${v}:${parts.join(':')}`;
    }
    getOrSet(key, ttlSeconds, compute) {
        return this.cache.getOrSet(key, ttlSeconds, compute);
    }
    invalidatePublic() {
        return this.cache.bump(constants_1.AGENCY_CACHE.PUBLIC);
    }
};
exports.AgencyCacheService = AgencyCacheService;
exports.AgencyCacheService = AgencyCacheService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [cache_service_1.CacheService])
], AgencyCacheService);
//# sourceMappingURL=agency-cache.service.js.map