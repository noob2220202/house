"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HomeModule = void 0;
const common_1 = require("@nestjs/common");
const complexes_module_1 = require("../complexes/complexes.module");
const listings_module_1 = require("../listings/listings.module");
const media_module_1 = require("../media/media.module");
const naver_geocode_client_1 = require("./clients/naver-geocode.client");
const geo_controller_1 = require("./controllers/geo.controller");
const home_controller_1 = require("./controllers/home.controller");
const me_controller_1 = require("./controllers/me.controller");
const policies_controller_1 = require("./controllers/policies.controller");
const search_controller_1 = require("./controllers/search.controller");
const favorite_agencies_service_1 = require("./services/favorite-agencies.service");
const geocode_service_1 = require("./services/geocode.service");
const home_stats_service_1 = require("./services/home-stats.service");
const home_user_data_service_1 = require("./services/home-user-data.service");
const interest_regions_service_1 = require("./services/interest-regions.service");
const policies_service_1 = require("./services/policies.service");
const search_suggest_service_1 = require("./services/search-suggest.service");
/**
 * Public discovery endpoints the site calls outside one listing / 단지 / office: home counters and
 * 지역 ranking, unified autocomplete, address geocoding, operating policy pages, plus the user's
 * 관심 중개사무소 and 관심 지역. Reads listing / 단지 data through the exported services of the
 * listings and complexes modules.
 */
let HomeModule = class HomeModule {
};
exports.HomeModule = HomeModule;
exports.HomeModule = HomeModule = __decorate([
    (0, common_1.Module)({
        imports: [listings_module_1.ListingsModule, complexes_module_1.ComplexesModule, media_module_1.MediaModule],
        controllers: [
            home_controller_1.HomeController,
            search_controller_1.SearchController,
            geo_controller_1.GeoController,
            policies_controller_1.PoliciesController,
            policies_controller_1.AdminPoliciesController,
            me_controller_1.FavoriteAgenciesController,
            me_controller_1.InterestRegionsController,
        ],
        providers: [
            { provide: naver_geocode_client_1.GEOCODER, useClass: naver_geocode_client_1.NaverGeocoder },
            home_stats_service_1.HomeStatsService,
            search_suggest_service_1.SearchSuggestService,
            geocode_service_1.GeocodeService,
            policies_service_1.PoliciesService,
            favorite_agencies_service_1.FavoriteAgenciesService,
            interest_regions_service_1.InterestRegionsService,
            home_user_data_service_1.HomeUserDataService,
        ],
        exports: [home_user_data_service_1.HomeUserDataService],
    })
], HomeModule);
//# sourceMappingURL=home.module.js.map