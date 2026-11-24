"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingsModule = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const queue_constants_1 = require("../../queue/queue.constants");
const media_module_1 = require("../media/media.module");
const agency_listings_controller_1 = require("./controllers/agency-listings.controller");
const me_listings_controller_1 = require("./controllers/me-listings.controller");
const public_listings_controller_1 = require("./controllers/public-listings.controller");
const listing_counters_processor_1 = require("./jobs/listing-counters.processor");
const listing_expiry_processor_1 = require("./jobs/listing-expiry.processor");
const listing_search_repository_1 = require("./listing-search.repository");
const listing_mapper_1 = require("./listing.mapper");
const agency_membership_port_1 = require("./ports/agency-membership.port");
const listing_media_port_1 = require("./ports/listing-media.port");
const listing_notifier_port_1 = require("./ports/listing-notifier.port");
const agency_console_service_1 = require("./services/agency-console.service");
const agency_listings_service_1 = require("./services/agency-listings.service");
const co_brokerage_service_1 = require("./services/co-brokerage.service");
const favorites_service_1 = require("./services/favorites.service");
const listing_counters_service_1 = require("./services/listing-counters.service");
const listing_expiry_service_1 = require("./services/listing-expiry.service");
const listing_query_service_1 = require("./services/listing-query.service");
const listing_region_names_service_1 = require("./services/listing-region-names.service");
const listing_region_stats_service_1 = require("./services/listing-region-stats.service");
const listing_summaries_service_1 = require("./services/listing-summaries.service");
const listing_views_service_1 = require("./services/listing-views.service");
const listings_moderation_service_1 = require("./services/listings-moderation.service");
const map_search_service_1 = require("./services/map-search.service");
const recent_views_service_1 = require("./services/recent-views.service");
const similar_listings_service_1 = require("./services/similar-listings.service");
/** Listings: properties, listings, 공동중개, 실매물 확인, map/list search, favorites, recent views. */
let ListingsModule = class ListingsModule {
};
exports.ListingsModule = ListingsModule;
exports.ListingsModule = ListingsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            bullmq_1.BullModule.registerQueue({ name: queue_constants_1.QUEUES.COUNTERS_FLUSH }),
            bullmq_1.BullModule.registerQueue({ name: queue_constants_1.QUEUES.CLEANUP }),
            media_module_1.MediaModule,
        ],
        controllers: [
            public_listings_controller_1.MapController,
            public_listings_controller_1.PublicListingsController,
            agency_listings_controller_1.AgencyListingsController,
            me_listings_controller_1.FavoriteListingsController,
            me_listings_controller_1.RecentViewsController,
        ],
        providers: [
            { provide: agency_membership_port_1.LISTING_AGENCY_MEMBERSHIP, useClass: agency_membership_port_1.PrismaAgencyMembership },
            { provide: listing_media_port_1.LISTING_MEDIA, useClass: listing_media_port_1.MediaServiceListingMedia },
            { provide: listing_notifier_port_1.LISTING_NOTIFIER, useClass: listing_notifier_port_1.PrismaListingNotifier },
            listing_search_repository_1.ListingSearchRepository,
            listing_mapper_1.ListingMapper,
            listing_region_names_service_1.ListingRegionNamesService,
            listing_region_stats_service_1.ListingRegionStatsService,
            listing_summaries_service_1.ListingSummariesService,
            similar_listings_service_1.SimilarListingsService,
            agency_console_service_1.AgencyConsoleService,
            listing_counters_service_1.ListingCountersService,
            listing_views_service_1.ListingViewsService,
            recent_views_service_1.RecentViewsService,
            favorites_service_1.FavoritesService,
            listing_query_service_1.ListingQueryService,
            map_search_service_1.MapSearchService,
            agency_listings_service_1.AgencyListingsService,
            co_brokerage_service_1.CoBrokerageService,
            listings_moderation_service_1.ListingsModerationService,
            listing_counters_processor_1.ListingCountersProcessor,
            listing_expiry_service_1.ListingExpiryService,
            listing_expiry_processor_1.ListingExpiryProcessor,
        ],
        exports: [
            listing_region_names_service_1.ListingRegionNamesService,
            listing_region_stats_service_1.ListingRegionStatsService,
            listing_summaries_service_1.ListingSummariesService,
            listings_moderation_service_1.ListingsModerationService,
            listing_counters_service_1.ListingCountersService,
            recent_views_service_1.RecentViewsService,
            listing_views_service_1.ListingViewsService,
            listing_expiry_service_1.ListingExpiryService,
        ],
    })
], ListingsModule);
//# sourceMappingURL=listings.module.js.map