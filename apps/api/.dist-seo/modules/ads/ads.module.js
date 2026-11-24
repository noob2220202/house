"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdsModule = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const queue_constants_1 = require("../../queue/queue.constants");
const media_module_1 = require("../media/media.module");
const ads_mapper_1 = require("./ads.mapper");
const admin_banners_controller_1 = require("./controllers/admin-banners.controller");
const public_ads_controller_1 = require("./controllers/public-ads.controller");
const banner_stats_processor_1 = require("./jobs/banner-stats.processor");
const ads_media_port_1 = require("./ports/ads-media.port");
const ads_references_port_1 = require("./ports/ads-references.port");
const ad_serve_service_1 = require("./services/ad-serve.service");
const ads_invalidation_service_1 = require("./services/ads-invalidation.service");
const ad_tracking_service_1 = require("./services/ad-tracking.service");
const banner_admin_service_1 = require("./services/banner-admin.service");
const banner_slots_service_1 = require("./services/banner-slots.service");
const banner_stats_service_1 = require("./services/banner-stats.service");
const popup_admin_service_1 = require("./services/popup-admin.service");
/** Ads: slot-based banners and popups — admin CRUD, cached public serving, tracking, stats. */
let AdsModule = class AdsModule {
};
exports.AdsModule = AdsModule;
exports.AdsModule = AdsModule = __decorate([
    (0, common_1.Module)({
        imports: [bullmq_1.BullModule.registerQueue({ name: queue_constants_1.QUEUES.BANNER_STATS }), media_module_1.MediaModule],
        controllers: [
            public_ads_controller_1.PublicAdsController,
            admin_banners_controller_1.AdminBannersController,
            admin_banners_controller_1.AdminBannerSlotsController,
            admin_banners_controller_1.AdminPopupsController,
        ],
        providers: [
            { provide: ads_media_port_1.ADS_MEDIA, useClass: ads_media_port_1.MediaServiceAdsMedia },
            { provide: ads_references_port_1.ADS_REFERENCES, useClass: ads_references_port_1.PrismaAdsReferences },
            ads_mapper_1.AdsMapper,
            banner_slots_service_1.BannerSlotsService,
            banner_admin_service_1.BannerAdminService,
            popup_admin_service_1.PopupAdminService,
            ad_serve_service_1.AdServeService,
            ad_tracking_service_1.AdTrackingService,
            banner_stats_service_1.BannerStatsService,
            banner_stats_processor_1.BannerStatsProcessor,
            ads_invalidation_service_1.AdsInvalidationService,
        ],
        exports: [ad_tracking_service_1.AdTrackingService, ads_invalidation_service_1.AdsInvalidationService],
    })
], AdsModule);
//# sourceMappingURL=ads.module.js.map