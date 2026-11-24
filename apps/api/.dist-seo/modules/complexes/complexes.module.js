"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplexesModule = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const queue_constants_1 = require("../../queue/queue.constants");
const listings_module_1 = require("../listings/listings.module");
const media_module_1 = require("../media/media.module");
const admin_complexes_controller_1 = require("./controllers/admin-complexes.controller");
const admin_trade_sync_controller_1 = require("./controllers/admin-trade-sync.controller");
const favorite_complexes_controller_1 = require("./controllers/favorite-complexes.controller");
const public_complexes_controller_1 = require("./controllers/public-complexes.controller");
const regions_controller_1 = require("./controllers/regions.controller");
const complex_media_port_1 = require("./ports/complex-media.port");
const complex_admin_service_1 = require("./services/complex-admin.service");
const complex_favorites_service_1 = require("./services/complex-favorites.service");
const complex_listings_service_1 = require("./services/complex-listings.service");
const complex_nearby_service_1 = require("./services/complex-nearby.service");
const complex_popularity_service_1 = require("./services/complex-popularity.service");
const complex_query_service_1 = require("./services/complex-query.service");
const complex_search_service_1 = require("./services/complex-search.service");
const complex_trades_service_1 = require("./services/complex-trades.service");
const regions_service_1 = require("./services/regions.service");
const trade_api_client_1 = require("./trade-sync/trade-api.client");
const trade_stats_service_1 = require("./trade-sync/trade-stats.service");
const trade_sync_jobs_1 = require("./trade-sync/trade-sync.jobs");
const trade_sync_processor_1 = require("./trade-sync/trade-sync.processor");
const trade_sync_service_1 = require("./trade-sync/trade-sync.service");
/**
 * 단지 (complexes), 평형, 법정동 regions, 실거래가 sync + stats, popularity, 관심 단지.
 * ListingsModule is imported only for RecentViewsService (최근 본 단지); MediaModule for photos.
 */
let ComplexesModule = class ComplexesModule {
};
exports.ComplexesModule = ComplexesModule;
exports.ComplexesModule = ComplexesModule = __decorate([
    (0, common_1.Module)({
        imports: [bullmq_1.BullModule.registerQueue({ name: queue_constants_1.QUEUES.TRADE_SYNC }), listings_module_1.ListingsModule, media_module_1.MediaModule],
        controllers: [
            // trade-sync before the generic admin complexes routes (`admin/complexes/:id`).
            admin_trade_sync_controller_1.AdminTradeSyncController,
            admin_complexes_controller_1.AdminComplexesController,
            public_complexes_controller_1.PublicComplexesController,
            favorite_complexes_controller_1.FavoriteComplexesController,
            regions_controller_1.RegionsController,
            regions_controller_1.AdminRegionsController,
        ],
        providers: [
            { provide: trade_api_client_1.TRADE_API_CLIENT, useClass: trade_api_client_1.DataGoKrTradeApiClient },
            { provide: complex_media_port_1.COMPLEX_MEDIA, useClass: complex_media_port_1.MediaServiceComplexMedia },
            regions_service_1.RegionsService,
            complex_listings_service_1.ComplexListingsService,
            complex_trades_service_1.ComplexTradesService,
            complex_popularity_service_1.ComplexPopularityService,
            complex_nearby_service_1.ComplexNearbyService,
            complex_favorites_service_1.ComplexFavoritesService,
            complex_search_service_1.ComplexSearchService,
            complex_query_service_1.ComplexQueryService,
            complex_admin_service_1.ComplexAdminService,
            trade_stats_service_1.TradeStatsService,
            trade_sync_service_1.TradeSyncService,
            trade_sync_jobs_1.TradeSyncJobs,
            trade_sync_processor_1.TradeSyncProcessor,
        ],
        exports: [
            regions_service_1.RegionsService,
            complex_listings_service_1.ComplexListingsService,
            complex_search_service_1.ComplexSearchService,
            complex_popularity_service_1.ComplexPopularityService,
            trade_sync_service_1.TradeSyncService,
        ],
    })
], ComplexesModule);
//# sourceMappingURL=complexes.module.js.map