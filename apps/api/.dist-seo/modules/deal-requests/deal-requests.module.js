"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DealRequestsModule = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const agencies_module_1 = require("../agencies/agencies.module");
const media_module_1 = require("../media/media.module");
const constants_1 = require("./constants");
const admin_deal_requests_controller_1 = require("./controllers/admin-deal-requests.controller");
const agency_dashboard_controller_1 = require("./controllers/agency-dashboard.controller");
const agency_deal_requests_controller_1 = require("./controllers/agency-deal-requests.controller");
const deal_requests_controller_1 = require("./controllers/deal-requests.controller");
const me_proposals_controller_1 = require("./controllers/me-proposals.controller");
const deal_request_mapper_1 = require("./deal-request.mapper");
const deal_requests_processor_1 = require("./jobs/deal-requests.processor");
const notification_dispatcher_1 = require("./notifications/notification-dispatcher");
const notifications_controller_1 = require("./notifications/notifications.controller");
const notifications_service_1 = require("./notifications/notifications.service");
const agency_directory_port_1 = require("./ports/agency-directory.port");
const complexes_port_1 = require("./ports/complexes.port");
const listings_port_1 = require("./ports/listings.port");
const media_port_1 = require("./ports/media.port");
const admin_deal_requests_service_1 = require("./services/admin-deal-requests.service");
const agency_actor_service_1 = require("./services/agency-actor.service");
const agency_inbox_service_1 = require("./services/agency-inbox.service");
const console_dashboard_service_1 = require("./services/console-dashboard.service");
const deal_request_lifecycle_service_1 = require("./services/deal-request-lifecycle.service");
const deal_request_maintenance_service_1 = require("./services/deal-request-maintenance.service");
const deal_requests_service_1 = require("./services/deal-requests.service");
const listing_candidates_service_1 = require("./services/listing-candidates.service");
const region_names_service_1 = require("./services/region-names.service");
const request_form_service_1 = require("./services/request-form.service");
const proposals_service_1 = require("./services/proposals.service");
/**
 * 내놓기/구하기: requests, agency inbox, proposals, per-agency contact consent, in-app notifications
 * (/me/notifications), expiry + contact-scrub jobs. Exports NotificationsService so other modules
 * can write in-app notifications through one place.
 */
let DealRequestsModule = class DealRequestsModule {
};
exports.DealRequestsModule = DealRequestsModule;
exports.DealRequestsModule = DealRequestsModule = __decorate([
    (0, common_1.Module)({
        imports: [agencies_module_1.AgenciesModule, media_module_1.MediaModule, bullmq_1.BullModule.registerQueue({ name: constants_1.DEAL_REQUESTS_QUEUE })],
        controllers: [
            deal_requests_controller_1.DealRequestsController,
            deal_requests_controller_1.MyDealRequestsController,
            me_proposals_controller_1.MyProposalsController,
            agency_deal_requests_controller_1.AgencyDealRequestsController,
            agency_dashboard_controller_1.AgencyDashboardController,
            notifications_controller_1.NotificationsController,
            admin_deal_requests_controller_1.AdminDealRequestsController,
        ],
        providers: [
            { provide: agency_directory_port_1.DEAL_REQUEST_AGENCIES, useClass: agency_directory_port_1.PrismaDealRequestAgencyDirectory },
            { provide: complexes_port_1.DEAL_REQUEST_COMPLEXES, useClass: complexes_port_1.PrismaDealRequestComplexes },
            { provide: listings_port_1.DEAL_REQUEST_LISTINGS, useClass: listings_port_1.PrismaDealRequestListings },
            { provide: media_port_1.DEAL_REQUEST_MEDIA, useClass: media_port_1.MediaServiceDealRequestMedia },
            { provide: notification_dispatcher_1.NOTIFICATION_DISPATCHER, useClass: notification_dispatcher_1.InAppOnlyNotificationDispatcher },
            deal_request_mapper_1.DealRequestMapper,
            notifications_service_1.NotificationsService,
            agency_actor_service_1.AgencyActorService,
            deal_request_lifecycle_service_1.DealRequestLifecycleService,
            deal_requests_service_1.DealRequestsService,
            proposals_service_1.ProposalsService,
            agency_inbox_service_1.AgencyInboxService,
            admin_deal_requests_service_1.AdminDealRequestsService,
            deal_request_maintenance_service_1.DealRequestMaintenanceService,
            deal_requests_processor_1.DealRequestsProcessor,
            region_names_service_1.RegionNamesService,
            request_form_service_1.RequestFormService,
            listing_candidates_service_1.ListingCandidatesService,
            console_dashboard_service_1.ConsoleDashboardService,
        ],
        exports: [notifications_service_1.NotificationsService, deal_request_maintenance_service_1.DealRequestMaintenanceService],
    })
], DealRequestsModule);
//# sourceMappingURL=deal-requests.module.js.map