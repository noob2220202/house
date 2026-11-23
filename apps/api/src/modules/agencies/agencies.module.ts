import { Module } from '@nestjs/common';
import { AdsModule } from '../ads/ads.module';
import { ListingsModule } from '../listings/listings.module';
import { MediaModule } from '../media/media.module';
import { AgencyMapper } from './agency.mapper';
import { AgencySearchRepository } from './agency-search.repository';
import { BROKER_REGISTRY, DataGoKrBrokerRegistryClient } from './clients/broker-registry.client';
import { AdminAgenciesController } from './controllers/admin-agencies.controller';
import { AgenciesController } from './controllers/agencies.controller';
import { MyAgencyController } from './controllers/my-agency.controller';
import { AGENCY_LISTINGS_READER, PrismaAgencyListingsReader } from './ports/agency-listings.reader';
import { AGENCY_LISTINGS_SYNC, ModerationAgencyListingsSync } from './ports/agency-listings.sync';
import { AGENCY_MEDIA, MediaServiceAgencyMedia } from './ports/agency-media.port';
import { AgenciesService } from './services/agencies.service';
import { AgencyCacheService } from './services/agency-cache.service';
import { AgencyInviteStore } from './services/agency-invite.store';
import { AgencyMembersService } from './services/agency-members.service';
import { AgencyPublicService } from './services/agency-public.service';
import { AgencyRegistrationService } from './services/agency-registration.service';
import { AgencyReviewService } from './services/agency-review.service';
import { AgencySessionSyncService } from './services/agency-session-sync.service';

/**
 * 중개사무소: registration + admin review, staff (invite codes), public search/map/profile.
 * Exports AgenciesService (membership checks, 표시·광고 disclosure, warnings) for other modules.
 */
@Module({
  imports: [ListingsModule, AdsModule, MediaModule],
  // Order matters: MyAgencyController's static routes (/agencies/mine, /join, /membership)
  // must be registered before AgenciesController's /agencies/:id.
  controllers: [MyAgencyController, AgenciesController, AdminAgenciesController],
  providers: [
    { provide: AGENCY_MEDIA, useClass: MediaServiceAgencyMedia },
    { provide: AGENCY_LISTINGS_READER, useClass: PrismaAgencyListingsReader },
    { provide: AGENCY_LISTINGS_SYNC, useClass: ModerationAgencyListingsSync },
    { provide: BROKER_REGISTRY, useClass: DataGoKrBrokerRegistryClient },
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
  ],
  exports: [AgenciesService],
})
export class AgenciesModule {}
