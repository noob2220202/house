import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../../queue/queue.constants';
import { MediaModule } from '../media/media.module';
import { AdsMapper } from './ads.mapper';
import {
  AdminBannerSlotsController,
  AdminBannersController,
  AdminPopupsController,
} from './controllers/admin-banners.controller';
import { PublicAdsController } from './controllers/public-ads.controller';
import { BannerStatsProcessor } from './jobs/banner-stats.processor';
import { ADS_MEDIA, MediaServiceAdsMedia } from './ports/ads-media.port';
import { ADS_REFERENCES, PrismaAdsReferences } from './ports/ads-references.port';
import { AdServeService } from './services/ad-serve.service';
import { AdsInvalidationService } from './services/ads-invalidation.service';
import { AdTrackingService } from './services/ad-tracking.service';
import { BannerAdminService } from './services/banner-admin.service';
import { BannerSlotsService } from './services/banner-slots.service';
import { BannerStatsService } from './services/banner-stats.service';
import { PopupAdminService } from './services/popup-admin.service';

/** Ads: slot-based banners and popups — admin CRUD, cached public serving, tracking, stats. */
@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.BANNER_STATS }), MediaModule],
  controllers: [
    PublicAdsController,
    AdminBannersController,
    AdminBannerSlotsController,
    AdminPopupsController,
  ],
  providers: [
    { provide: ADS_MEDIA, useClass: MediaServiceAdsMedia },
    { provide: ADS_REFERENCES, useClass: PrismaAdsReferences },
    AdsMapper,
    BannerSlotsService,
    BannerAdminService,
    PopupAdminService,
    AdServeService,
    AdTrackingService,
    BannerStatsService,
    BannerStatsProcessor,
    AdsInvalidationService,
  ],
  exports: [AdTrackingService, AdsInvalidationService],
})
export class AdsModule {}
