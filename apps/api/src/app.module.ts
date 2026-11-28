import { Module } from '@nestjs/common';
import { CoreModule } from './common/core.module';
import { AppConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { LoggerModule } from './logger/logger.module';
import { AdminModule } from './modules/admin/admin.module';
import { AdsModule } from './modules/ads/ads.module';
import { AgenciesModule } from './modules/agencies/agencies.module';
import { AuthModule } from './modules/auth/auth.module';
import { ComplexesModule } from './modules/complexes/complexes.module';
import { DealRequestsModule } from './modules/deal-requests/deal-requests.module';
import { E2eAuthModule } from './modules/e2e-auth/e2e-auth.module';
import { e2eFakeAuthEnabled } from './modules/e2e-auth/e2e-auth.enabled';
import { HomeModule } from './modules/home/home.module';
import { InquiriesModule } from './modules/inquiries/inquiries.module';
import { ListingsModule } from './modules/listings/listings.module';
import { MediaModule } from './modules/media/media.module';
import { SeoModule } from './modules/seo/seo.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';

/**
 * Root module. All feature modules are registered here already —
 * module teams should never need to edit this file.
 */
@Module({
  imports: [
    // infrastructure
    AppConfigModule,
    LoggerModule,
    PrismaModule,
    RedisModule,
    QueueModule,
    CoreModule,
    HealthModule,
    // features
    AuthModule,
    MediaModule,
    AgenciesModule,
    ComplexesModule,
    ListingsModule,
    InquiriesModule,
    DealRequestsModule,
    AdsModule,
    AdminModule,
    HomeModule,
    SeoModule,
    // TEST-ONLY browser e2e login: registered only with NODE_ENV=test and E2E_FAKE_OAUTH=1.
    ...(e2eFakeAuthEnabled() ? [E2eAuthModule] : []),
  ],
})
export class AppModule {}
