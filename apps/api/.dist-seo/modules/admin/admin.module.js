"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminModule = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const agencies_module_1 = require("../agencies/agencies.module");
const deal_requests_module_1 = require("../deal-requests/deal-requests.module");
const listings_module_1 = require("../listings/listings.module");
const media_module_1 = require("../media/media.module");
const admin_audit_coverage_service_1 = require("./audit/admin-audit-coverage.service");
const admin_mutation_audit_interceptor_1 = require("./audit/admin-mutation-audit.interceptor");
const admin_accounts_controller_1 = require("./controllers/admin-accounts.controller");
const admin_content_controllers_1 = require("./controllers/admin-content.controllers");
const admin_insights_controllers_1 = require("./controllers/admin-insights.controllers");
const admin_listings_controller_1 = require("./controllers/admin-listings.controller");
const admin_members_controller_1 = require("./controllers/admin-members.controller");
const admin_overview_controllers_1 = require("./controllers/admin-overview.controllers");
const admin_reports_controller_1 = require("./controllers/admin-reports.controller");
const admin_site_settings_controller_1 = require("./controllers/admin-site-settings.controller");
const admin_terms_controller_1 = require("./controllers/admin-terms.controller");
const constants_1 = require("./constants");
const admin_maintenance_processor_1 = require("./jobs/admin-maintenance.processor");
const public_content_controller_1 = require("./controllers/public-content.controller");
const public_reports_controller_1 = require("./controllers/public-reports.controller");
const listing_moderation_port_1 = require("./ports/listing-moderation.port");
const admin_accounts_service_1 = require("./services/admin-accounts.service");
const admin_listings_service_1 = require("./services/admin-listings.service");
const admin_notifications_service_1 = require("./services/admin-notifications.service");
const admin_search_service_1 = require("./services/admin-search.service");
const admin_stats_service_1 = require("./services/admin-stats.service");
const dashboard_queues_service_1 = require("./services/dashboard-queues.service");
const social_login_status_service_1 = require("./services/social-login-status.service");
const admin_terms_service_1 = require("./services/admin-terms.service");
const audit_logs_service_1 = require("./services/audit-logs.service");
const dashboard_service_1 = require("./services/dashboard.service");
const faqs_service_1 = require("./services/faqs.service");
const members_service_1 = require("./services/members.service");
const notices_service_1 = require("./services/notices.service");
const reports_service_1 = require("./services/reports.service");
const site_settings_service_1 = require("./services/site-settings.service");
const videos_service_1 = require("./services/videos.service");
const visitor_counter_middleware_1 = require("./visitors/visitor-counter.middleware");
const visitor_stats_service_1 = require("./visitors/visitor-stats.service");
/**
 * Back-office API (/api/v1/admin/**) not owned by another module, public content (공지·FAQ·영상·
 * 사이트 설정), 허위매물 신고, the visitor counter, and the admin-wide audit safety net.
 * Auth (SessionService, PasswordService, TermsService) comes from the global AuthModule.
 */
let AdminModule = class AdminModule {
    configure(consumer) {
        consumer
            .apply(visitor_counter_middleware_1.VisitorCounterMiddleware)
            .forRoutes({ path: '*splat', method: common_1.RequestMethod.GET });
    }
};
exports.AdminModule = AdminModule;
exports.AdminModule = AdminModule = __decorate([
    (0, common_1.Module)({
        imports: [
            core_1.DiscoveryModule,
            listings_module_1.ListingsModule,
            agencies_module_1.AgenciesModule,
            deal_requests_module_1.DealRequestsModule,
            media_module_1.MediaModule,
            bullmq_1.BullModule.registerQueue({ name: constants_1.ADMIN_QUEUE }),
        ],
        controllers: [
            public_reports_controller_1.PublicReportsController,
            public_content_controller_1.PublicContentController,
            admin_overview_controllers_1.AdminPermissionsController,
            admin_overview_controllers_1.AdminDashboardController,
            admin_overview_controllers_1.AdminAuditLogsController,
            admin_reports_controller_1.AdminReportsController,
            admin_listings_controller_1.AdminListingsController,
            admin_members_controller_1.AdminMembersController,
            admin_accounts_controller_1.AdminAccountsController,
            admin_content_controllers_1.AdminNoticesController,
            admin_content_controllers_1.AdminFaqsController,
            admin_content_controllers_1.AdminVideosController,
            admin_terms_controller_1.AdminTermsController,
            admin_site_settings_controller_1.AdminSiteSettingsController,
            admin_insights_controllers_1.AdminSearchController,
            admin_insights_controllers_1.AdminNotificationsController,
            admin_insights_controllers_1.AdminStatsController,
            admin_insights_controllers_1.AdminSocialLoginController,
        ],
        providers: [
            { provide: listing_moderation_port_1.LISTING_MODERATION, useClass: listing_moderation_port_1.ListingModerationAdapter },
            { provide: core_1.APP_INTERCEPTOR, useClass: admin_mutation_audit_interceptor_1.AdminMutationAuditInterceptor },
            admin_audit_coverage_service_1.AdminAuditCoverageService,
            admin_maintenance_processor_1.AdminMaintenanceProcessor,
            visitor_stats_service_1.VisitorStatsService,
            reports_service_1.ReportsService,
            admin_listings_service_1.AdminListingsService,
            members_service_1.MembersService,
            admin_accounts_service_1.AdminAccountsService,
            notices_service_1.NoticesService,
            faqs_service_1.FaqsService,
            videos_service_1.VideosService,
            admin_terms_service_1.AdminTermsService,
            site_settings_service_1.SiteSettingsService,
            dashboard_service_1.DashboardService,
            dashboard_queues_service_1.DashboardQueuesService,
            admin_search_service_1.AdminSearchService,
            admin_notifications_service_1.AdminNotificationsService,
            admin_stats_service_1.AdminStatsService,
            social_login_status_service_1.SocialLoginStatusService,
            audit_logs_service_1.AuditLogsService,
        ],
        exports: [visitor_stats_service_1.VisitorStatsService],
    })
], AdminModule);
//# sourceMappingURL=admin.module.js.map