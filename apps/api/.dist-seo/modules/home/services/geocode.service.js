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
var GeocodeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeocodeService = void 0;
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const cache_service_1 = require("../../../common/cache/cache.service");
const app_exception_1 = require("../../../common/errors/app.exception");
const app_config_service_1 = require("../../../config/app-config.service");
const naver_geocode_client_1 = require("../clients/naver-geocode.client");
const constants_1 = require("../constants");
/** 시군구 name the query is anchored to when the visitor did not type it ("순천시"). */
const SERVICE_CITY = '순천시';
/**
 * Address search with coordinates, limited to the service 시군구 (REGION_SGG_CODE): proxies the
 * geocoder server-side, maps each hit's 법정동 code through canonicalRegionCode (legacy
 * 46150… → 12150…) and caches answers by normalized query.
 */
let GeocodeService = GeocodeService_1 = class GeocodeService {
    constructor(geocoder, cache, config) {
        this.geocoder = geocoder;
        this.cache = cache;
        this.config = config;
        this.logger = new common_1.Logger(GeocodeService_1.name);
    }
    async search(query) {
        if (!this.geocoder.isConfigured()) {
            throw new app_exception_1.AppException(shared_1.ErrorCode.GEOCODE_UNAVAILABLE);
        }
        const sgg = this.config.get('REGION_SGG_CODE');
        const anchored = this.anchor(query, sgg);
        const key = `cache:home:geocode:${sgg}:${(0, node_crypto_1.createHash)('sha256').update(anchored).digest('hex').slice(0, 32)}`;
        const cached = await this.cache.get(key);
        if (cached)
            return { items: cached };
        let hits;
        try {
            hits = await this.geocoder.geocode(anchored, sgg === shared_1.DEFAULT_SGG_CODE ? shared_1.DEFAULT_MAP_CENTER : null);
        }
        catch (err) {
            if (!(err instanceof naver_geocode_client_1.GeocoderUnavailableError))
                throw err;
            this.logger.warn({ err: err.message }, 'geocoding failed');
            throw new app_exception_1.AppException(shared_1.ErrorCode.GEOCODE_UNAVAILABLE);
        }
        const coded = await Promise.all(hits.slice(0, constants_1.GEOCODE_MAX_RESULTS).map(async (h) => {
            const code = await this.geocoder.legalCode(h.lat, h.lng);
            return { ...h, emdCode: code ? (0, shared_1.canonicalRegionCode)(code) : null };
        }));
        const items = coded.filter((h) => h.emdCode
            ? h.emdCode.startsWith(sgg)
            : `${h.roadAddress} ${h.jibunAddress ?? ''}`.includes(SERVICE_CITY));
        await this.cache.set(key, items, items.length > 0 ? constants_1.HOME_CACHE_TTL_SECONDS.GEOCODE : constants_1.HOME_CACHE_TTL_SECONDS.GEOCODE_EMPTY);
        return { items };
    }
    /** "신대1로 18" → "순천시 신대1로 18" so results stay in the service region. */
    anchor(query, sgg) {
        if (sgg !== shared_1.DEFAULT_SGG_CODE || query.includes('순천'))
            return query;
        return `${SERVICE_CITY} ${query}`;
    }
};
exports.GeocodeService = GeocodeService;
exports.GeocodeService = GeocodeService = GeocodeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(naver_geocode_client_1.GEOCODER)),
    __metadata("design:paramtypes", [Object, cache_service_1.CacheService,
        app_config_service_1.AppConfig])
], GeocodeService);
//# sourceMappingURL=geocode.service.js.map