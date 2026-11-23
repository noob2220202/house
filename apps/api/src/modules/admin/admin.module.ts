import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { APP_INTERCEPTOR, DiscoveryModule } from '@nestjs/core';
import { AgenciesModule } from '../agencies/agencies.module';
import { DealRequestsModule } from '../deal-requests/deal-requests.module';
import { ListingsModule } from '../listings/listings.module';
import { AdminAuditCoverageService } from './audit/admin-audit-coverage.service';
import { AdminMutationAuditInterceptor } from './audit/admin-mutation-audit.interceptor';
import { AdminAccountsController } from './controllers/admin-accounts.controller';
import {
  AdminFaqsController,
  AdminNoticesController,
  AdminVideosController,
} from './controllers/admin-content.controllers';
import { AdminListingsController } from './controllers/admin-listings.controller';
import { AdminMembersController } from './controllers/admin-members.controller';
import {
  AdminAuditLogsController,
  AdminDashboardController,
  AdminPermissionsController,
} from './controllers/admin-overview.controllers';
import { AdminReportsController } from './controllers/admin-reports.controller';
import { AdminSiteSettingsController } from './controllers/admin-site-settings.controller';
import { AdminTermsController } from './controllers/admin-terms.controller';
import { PublicContentController } from './controllers/public-content.controller';
import { PublicReportsController } from './controllers/public-reports.controller';
import { LISTING_MODERATION, ListingModerationAdapter } from './ports/listing-moderation.port';
import { AdminAccountsService } from './services/admin-accounts.service';
import { AdminListingsService } from './services/admin-listings.service';
import { AdminTermsService } from './services/admin-terms.service';
import { AuditLogsService } from './services/audit-logs.service';
import { DashboardService } from './services/dashboard.service';
import { FaqsService } from './services/faqs.service';
import { MembersService } from './services/members.service';
import { NoticesService } from './services/notices.service';
import { ReportsService } from './services/reports.service';
import { SiteSettingsService } from './services/site-settings.service';
import { VideosService } from './services/videos.service';
import { VisitorCounterMiddleware } from './visitors/visitor-counter.middleware';
import { VisitorStatsService } from './visitors/visitor-stats.service';

/**
 * Back-office API (/api/v1/admin/**) not owned by another module, public content (공지·FAQ·영상·
 * 사이트 설정), 허위매물 신고, the visitor counter, and the admin-wide audit safety net.
 * Auth (SessionService, PasswordService, TermsService) comes from the global AuthModule.
 */
@Module({
  imports: [DiscoveryModule, ListingsModule, AgenciesModule, DealRequestsModule],
  controllers: [
    PublicReportsController,
    PublicContentController,
    AdminPermissionsController,
    AdminDashboardController,
    AdminAuditLogsController,
    AdminReportsController,
    AdminListingsController,
    AdminMembersController,
    AdminAccountsController,
    AdminNoticesController,
    AdminFaqsController,
    AdminVideosController,
    AdminTermsController,
    AdminSiteSettingsController,
  ],
  providers: [
    { provide: LISTING_MODERATION, useClass: ListingModerationAdapter },
    { provide: APP_INTERCEPTOR, useClass: AdminMutationAuditInterceptor },
    AdminAuditCoverageService,
    VisitorStatsService,
    ReportsService,
    AdminListingsService,
    MembersService,
    AdminAccountsService,
    NoticesService,
    FaqsService,
    VideosService,
    AdminTermsService,
    SiteSettingsService,
    DashboardService,
    AuditLogsService,
  ],
  exports: [VisitorStatsService],
})
export class AdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(VisitorCounterMiddleware)
      .forRoutes({ path: '*splat', method: RequestMethod.GET });
  }
}
