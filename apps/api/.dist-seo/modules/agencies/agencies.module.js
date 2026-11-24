"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgenciesModule = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const ads_module_1 = require("../ads/ads.module");
const listings_module_1 = require("../listings/listings.module");
const media_module_1 = require("../media/media.module");
const agency_mapper_1 = require("./agency.mapper");
const agencies_processor_1 = require("./jobs/agencies.processor");
const constants_1 = require("./constants");
const agency_search_repository_1 = require("./agency-search.repository");
const broker_registry_client_1 = require("./clients/broker-registry.client");
const admin_agencies_controller_1 = require("./controllers/admin-agencies.controller");
const agencies_controller_1 = require("./controllers/agencies.controller");
const my_agency_controller_1 = require("./controllers/my-agency.controller");
const agency_listings_reader_1 = require("./ports/agency-listings.reader");
const agency_listings_sync_1 = require("./ports/agency-listings.sync");
const agency_media_port_1 = require("./ports/agency-media.port");
const agencies_service_1 = require("./services/agencies.service");
const agency_cache_service_1 = require("./services/agency-cache.service");
const agency_dashboard_service_1 = require("./services/agency-dashboard.service");
const agency_invite_store_1 = require("./services/agency-invite.store");
const agency_members_service_1 = require("./services/agency-members.service");
const agency_public_service_1 = require("./services/agency-public.service");
const agency_registration_service_1 = require("./services/agency-registration.service");
const agency_review_service_1 = require("./services/agency-review.service");
const agency_session_sync_service_1 = require("./services/agency-session-sync.service");
/**
 * 중개사무소: registration + admin review, staff (invite codes), public search/map/profile.
 * Exports AgenciesService (membership checks, 표시·광고 disclosure, warnings) and
 * AgencyDashboardService (console home listing/view numbers) for other modules.
 */
let AgenciesModule = class AgenciesModule {
};
exports.AgenciesModule = AgenciesModule;
exports.AgenciesModule = AgenciesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            listings_module_1.ListingsModule,
            ads_module_1.AdsModule,
            media_module_1.MediaModule,
            bullmq_1.BullModule.registerQueue({ name: constants_1.AGENCIES_QUEUE }),
        ],
        // Order matters: MyAgencyController's static routes (/agencies/mine, /join, /membership)
        // must be registered before AgenciesController's /agencies/:id.
        controllers: [my_agency_controller_1.MyAgencyController, agencies_controller_1.AgenciesController, admin_agencies_controller_1.AdminAgenciesController],
        providers: [
            { provide: agency_media_port_1.AGENCY_MEDIA, useClass: agency_media_port_1.MediaServiceAgencyMedia },
            { provide: agency_listings_reader_1.AGENCY_LISTINGS_READER, useClass: agency_listings_reader_1.PrismaAgencyListingsReader },
            { provide: agency_listings_sync_1.AGENCY_LISTINGS_SYNC, useClass: agency_listings_sync_1.ModerationAgencyListingsSync },
            { provide: broker_registry_client_1.BROKER_REGISTRY, useClass: broker_registry_client_1.VworldBrokerRegistryClient },
            agency_mapper_1.AgencyMapper,
            agency_search_repository_1.AgencySearchRepository,
            agency_cache_service_1.AgencyCacheService,
            agency_session_sync_service_1.AgencySessionSyncService,
            agency_invite_store_1.AgencyInviteStore,
            agencies_service_1.AgenciesService,
            agency_registration_service_1.AgencyRegistrationService,
            agency_members_service_1.AgencyMembersService,
            agency_public_service_1.AgencyPublicService,
            agency_review_service_1.AgencyReviewService,
            agency_dashboard_service_1.AgencyDashboardService,
            agencies_processor_1.AgenciesProcessor,
        ],
        exports: [agencies_service_1.AgenciesService, agency_dashboard_service_1.AgencyDashboardService],
    })
], AgenciesModule);
//# sourceMappingURL=agencies.module.js.map