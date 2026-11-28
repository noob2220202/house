import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AdsModule } from '../ads/ads.module';
import { ListingsModule } from '../listings/listings.module';
import { MediaModule } from '../media/media.module';
import { AgencyMapper } from './agency.mapper';
import { AgenciesProcessor } from './jobs/agencies.processor';
import { AGENCIES_QUEUE } from './constants';
import { AgencySearchRepository } from './agency-search.repository';
import { BROKER_REGISTRY, VworldBrokerRegistryClient } from './clients/broker-registry.client';
import { AdminAgenciesController } from './controllers/admin-agencies.controller';
import { AdminAgencySitesController } from './controllers/admin-agency-sites.controller';
import { AgenciesController } from './controllers/agencies.controller';
import { MyAgencySiteController } from './controllers/my-agency-site.controller';
import { MyAgencyController } from './controllers/my-agency.controller';
import { SitesController } from './controllers/sites.controller';
import { AGENCY_LISTINGS_READER, PrismaAgencyListingsReader } from './ports/agency-listings.reader';
import { AGENCY_LISTINGS_SYNC, ModerationAgencyListingsSync } from './ports/agency-listings.sync';
import { AGENCY_MEDIA, MediaServiceAgencyMedia } from './ports/agency-media.port';
import { AgenciesService } from './services/agencies.service';
import { AgencyCacheService } from './services/agency-cache.service';
import { AgencyDashboardService } from './services/agency-dashboard.service';
import { AgencyInviteStore } from './services/agency-invite.store';
import { AgencyMembersService } from './services/agency-members.service';
import { AgencyPublicService } from './services/agency-public.service';
import { AgencyRegistrationService } from './services/agency-registration.service';
import { AgencyRetentionService } from './services/agency-retention.service';
import { AgencyReviewService } from './services/agency-review.service';
import { AgencySessionSyncService } from './services/agency-session-sync.service';
import { AgencySiteGateService } from './services/agency-site-gate.service';
import { AgencySiteReviewService } from './services/agency-site-review.service';
import { AgencySitesService } from './services/agency-sites.service';
import { AgencySubscriptionsService } from './services/agency-subscriptions.service';

/**
 * 중개사무소: registration + admin review, staff (invite codes), public search/map/profile,
 * 사무소 홈페이지 (request → admin approval, public GET /sites/:slug) and 이용권 records.
 * Exports AgenciesService (membership checks, 표시·광고 disclosure, warnings),
 * AgencyDashboardService (console home listing/view numbers) and AgencySiteGateService (the
 * admin module reports FEATURES changes to it) for other modules.
 */
@Module({
  imports: [
    ListingsModule,
    AdsModule,
    MediaModule,
    BullModule.registerQueue({ name: AGENCIES_QUEUE }),
  ],
  // Order matters: MyAgencyController's static routes (/agencies/mine, /join, /membership)
  // must be registered before AgenciesController's /agencies/:id.
  controllers: [
    MyAgencySiteController,
    MyAgencyController,
    AgenciesController,
    SitesController,
    AdminAgenciesController,
    AdminAgencySitesController,
  ],
  providers: [
    { provide: AGENCY_MEDIA, useClass: MediaServiceAgencyMedia },
    { provide: AGENCY_LISTINGS_READER, useClass: PrismaAgencyListingsReader },
    { provide: AGENCY_LISTINGS_SYNC, useClass: ModerationAgencyListingsSync },
    { provide: BROKER_REGISTRY, useClass: VworldBrokerRegistryClient },
    AgencyMapper,
    AgencySearchRepository,
    AgencyCacheService,
    AgencySessionSyncService,
    AgencyInviteStore,
    AgenciesService,
    AgencyRegistrationService,
    AgencyMembersService,
    AgencyPublicService,
    AgencyReviewService,
    AgencyDashboardService,
    AgencyRetentionService,
    AgencySiteGateService,
    AgencySitesService,
    AgencySiteReviewService,
    AgencySubscriptionsService,
    AgenciesProcessor,
  ],
  exports: [AgenciesService, AgencyDashboardService, AgencySiteGateService],
})
export class AgenciesModule {}
