"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("./common/core.module");
const config_module_1 = require("./config/config.module");
const health_module_1 = require("./health/health.module");
const logger_module_1 = require("./logger/logger.module");
const admin_module_1 = require("./modules/admin/admin.module");
const ads_module_1 = require("./modules/ads/ads.module");
const agencies_module_1 = require("./modules/agencies/agencies.module");
const auth_module_1 = require("./modules/auth/auth.module");
const complexes_module_1 = require("./modules/complexes/complexes.module");
const deal_requests_module_1 = require("./modules/deal-requests/deal-requests.module");
const e2e_auth_module_1 = require("./modules/e2e-auth/e2e-auth.module");
const e2e_auth_enabled_1 = require("./modules/e2e-auth/e2e-auth.enabled");
const home_module_1 = require("./modules/home/home.module");
const listings_module_1 = require("./modules/listings/listings.module");
const media_module_1 = require("./modules/media/media.module");
const seo_module_1 = require("./modules/seo/seo.module");
const prisma_module_1 = require("./prisma/prisma.module");
const queue_module_1 = require("./queue/queue.module");
const redis_module_1 = require("./redis/redis.module");
/**
 * Root module. All feature modules are registered here already —
 * module teams should never need to edit this file.
 */
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            // infrastructure
            config_module_1.AppConfigModule,
            logger_module_1.LoggerModule,
            prisma_module_1.PrismaModule,
            redis_module_1.RedisModule,
            queue_module_1.QueueModule,
            core_module_1.CoreModule,
            health_module_1.HealthModule,
            // features
            auth_module_1.AuthModule,
            media_module_1.MediaModule,
            agencies_module_1.AgenciesModule,
            complexes_module_1.ComplexesModule,
            listings_module_1.ListingsModule,
            deal_requests_module_1.DealRequestsModule,
            ads_module_1.AdsModule,
            admin_module_1.AdminModule,
            home_module_1.HomeModule,
            seo_module_1.SeoModule,
            // TEST-ONLY browser e2e login: registered only with NODE_ENV=test and E2E_FAKE_OAUTH=1.
            ...((0, e2e_auth_enabled_1.e2eFakeAuthEnabled)() ? [e2e_auth_module_1.E2eAuthModule] : []),
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map