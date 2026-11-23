import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../../queue/queue.constants';
import { MediaModule } from '../media/media.module';
import { AgencyListingsController } from './controllers/agency-listings.controller';
import {
  FavoriteListingsController,
  RecentViewsController,
} from './controllers/me-listings.controller';
import { MapController, PublicListingsController } from './controllers/public-listings.controller';
import { ListingCountersProcessor } from './jobs/listing-counters.processor';
import { ListingExpiryProcessor } from './jobs/listing-expiry.processor';
import { ListingSearchRepository } from './listing-search.repository';
import { ListingMapper } from './listing.mapper';
import { LISTING_AGENCY_MEMBERSHIP, PrismaAgencyMembership } from './ports/agency-membership.port';
import { LISTING_MEDIA, MediaServiceListingMedia } from './ports/listing-media.port';
import { LISTING_NOTIFIER, PrismaListingNotifier } from './ports/listing-notifier.port';
import { AgencyListingsService } from './services/agency-listings.service';
import { CoBrokerageService } from './services/co-brokerage.service';
import { FavoritesService } from './services/favorites.service';
import { ListingCountersService } from './services/listing-counters.service';
import { ListingExpiryService } from './services/listing-expiry.service';
import { ListingQueryService } from './services/listing-query.service';
import { ListingSummariesService } from './services/listing-summaries.service';
import { ListingViewsService } from './services/listing-views.service';
import { ListingsModerationService } from './services/listings-moderation.service';
import { MapSearchService } from './services/map-search.service';
import { RecentViewsService } from './services/recent-views.service';

/** Listings: properties, listings, 공동중개, 실매물 확인, map/list search, favorites, recent views. */
@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.COUNTERS_FLUSH }),
    BullModule.registerQueue({ name: QUEUES.CLEANUP }),
    MediaModule,
  ],
  controllers: [
    MapController,
    PublicListingsController,
    AgencyListingsController,
    FavoriteListingsController,
    RecentViewsController,
  ],
  providers: [
    { provide: LISTING_AGENCY_MEMBERSHIP, useClass: PrismaAgencyMembership },
    { provide: LISTING_MEDIA, useClass: MediaServiceListingMedia },
    { provide: LISTING_NOTIFIER, useClass: PrismaListingNotifier },
    ListingSearchRepository,
    ListingMapper,
    ListingSummariesService,
    ListingCountersService,
    ListingViewsService,
    RecentViewsService,
    FavoritesService,
    ListingQueryService,
    MapSearchService,
    AgencyListingsService,
    CoBrokerageService,
    ListingsModerationService,
    ListingCountersProcessor,
    ListingExpiryService,
    ListingExpiryProcessor,
  ],
  exports: [
    ListingsModerationService,
    ListingCountersService,
    RecentViewsService,
    ListingViewsService,
    ListingExpiryService,
  ],
})
export class ListingsModule {}
