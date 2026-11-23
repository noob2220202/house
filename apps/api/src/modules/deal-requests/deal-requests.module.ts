import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AgenciesModule } from '../agencies/agencies.module';
import { DEAL_REQUESTS_QUEUE } from './constants';
import { AdminDealRequestsController } from './controllers/admin-deal-requests.controller';
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
import { DEAL_REQUEST_MEDIA, PrismaDealRequestMedia } from './ports/media.port';
import { AdminDealRequestsService } from './services/admin-deal-requests.service';
import { AgencyActorService } from './services/agency-actor.service';
import { AgencyInboxService } from './services/agency-inbox.service';
import { DealRequestLifecycleService } from './services/deal-request-lifecycle.service';
import { DealRequestMaintenanceService } from './services/deal-request-maintenance.service';
import { DealRequestsService } from './services/deal-requests.service';
import { ProposalsService } from './services/proposals.service';

/**
 * 내놓기/구하기: requests, agency inbox, proposals, per-agency contact consent, in-app notifications
 * (/me/notifications), expiry + contact-scrub jobs. Exports NotificationsService so other modules
 * can write in-app notifications through one place.
 */
@Module({
  imports: [AgenciesModule, BullModule.registerQueue({ name: DEAL_REQUESTS_QUEUE })],
  controllers: [
    DealRequestsController,
    MyDealRequestsController,
    MyProposalsController,
    AgencyDealRequestsController,
    NotificationsController,
    AdminDealRequestsController,
  ],
  providers: [
    { provide: DEAL_REQUEST_AGENCIES, useClass: PrismaDealRequestAgencyDirectory },
    { provide: DEAL_REQUEST_COMPLEXES, useClass: PrismaDealRequestComplexes },
    { provide: DEAL_REQUEST_LISTINGS, useClass: PrismaDealRequestListings },
    { provide: DEAL_REQUEST_MEDIA, useClass: PrismaDealRequestMedia },
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
  ],
  exports: [NotificationsService, DealRequestMaintenanceService],
})
export class DealRequestsModule {}
