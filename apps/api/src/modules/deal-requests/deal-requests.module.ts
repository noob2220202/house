import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AgenciesModule } from '../agencies/agencies.module';
import { InquiriesModule } from '../inquiries/inquiries.module';
import { MediaModule } from '../media/media.module';
import { DEAL_REQUESTS_QUEUE } from './constants';
import { AdminDealRequestsController } from './controllers/admin-deal-requests.controller';
import { AgencyDashboardController } from './controllers/agency-dashboard.controller';
import { AgencyDealRequestsController } from './controllers/agency-deal-requests.controller';
import {
  DealRequestsController,
  MyDealRequestsController,
} from './controllers/deal-requests.controller';
import { MyProposalsController } from './controllers/me-proposals.controller';
import { DealRequestMapper } from './deal-request.mapper';
import { DealRequestsProcessor } from './jobs/deal-requests.processor';
import {
  InAppOnlyNotificationDispatcher,
  NOTIFICATION_DISPATCHER,
} from './notifications/notification-dispatcher';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationsService } from './notifications/notifications.service';
import {
  DEAL_REQUEST_AGENCIES,
  PrismaDealRequestAgencyDirectory,
} from './ports/agency-directory.port';
import { DEAL_REQUEST_COMPLEXES, PrismaDealRequestComplexes } from './ports/complexes.port';
import { DEAL_REQUEST_LISTINGS, PrismaDealRequestListings } from './ports/listings.port';
import { DEAL_REQUEST_MEDIA, MediaServiceDealRequestMedia } from './ports/media.port';
import { AdminDealRequestsService } from './services/admin-deal-requests.service';
import { AgencyActorService } from './services/agency-actor.service';
import { AgencyInboxService } from './services/agency-inbox.service';
import { ConsoleDashboardService } from './services/console-dashboard.service';
import { DealRequestLifecycleService } from './services/deal-request-lifecycle.service';
import { DealRequestMaintenanceService } from './services/deal-request-maintenance.service';
import { DealRequestsService } from './services/deal-requests.service';
import { ListingCandidatesService } from './services/listing-candidates.service';
import { RegionNamesService } from './services/region-names.service';
import { RequestFormService } from './services/request-form.service';
import { ProposalsService } from './services/proposals.service';

/**
 * 내놓기/구하기: requests, agency inbox, proposals, per-agency contact consent, in-app notifications
 * (/me/notifications), expiry + contact-scrub jobs. Exports NotificationsService so other modules
 * can write in-app notifications through one place.
 */
@Module({
  imports: [
    AgenciesModule,
    MediaModule,
    // Console home: the inquiry block (inquiries never imports deal-requests).
    InquiriesModule,
    BullModule.registerQueue({ name: DEAL_REQUESTS_QUEUE }),
  ],
  controllers: [
    DealRequestsController,
    MyDealRequestsController,
    MyProposalsController,
    AgencyDealRequestsController,
    AgencyDashboardController,
    NotificationsController,
    AdminDealRequestsController,
  ],
  providers: [
    { provide: DEAL_REQUEST_AGENCIES, useClass: PrismaDealRequestAgencyDirectory },
    { provide: DEAL_REQUEST_COMPLEXES, useClass: PrismaDealRequestComplexes },
    { provide: DEAL_REQUEST_LISTINGS, useClass: PrismaDealRequestListings },
    { provide: DEAL_REQUEST_MEDIA, useClass: MediaServiceDealRequestMedia },
    { provide: NOTIFICATION_DISPATCHER, useClass: InAppOnlyNotificationDispatcher },
    DealRequestMapper,
    NotificationsService,
    AgencyActorService,
    DealRequestLifecycleService,
    DealRequestsService,
    ProposalsService,
    AgencyInboxService,
    AdminDealRequestsService,
    DealRequestMaintenanceService,
    DealRequestsProcessor,
    RegionNamesService,
    RequestFormService,
    ListingCandidatesService,
    ConsoleDashboardService,
  ],
  exports: [NotificationsService, DealRequestMaintenanceService],
})
export class DealRequestsModule {}
