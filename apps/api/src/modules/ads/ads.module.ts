import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../../queue/queue.constants';
import { AdsMapper } from './ads.mapper';
import {
  AdminBannerSlotsController,
  AdminBannersController,
  AdminPopupsController,
} from './controllers/admin-banners.controller';
import { PublicAdsController } from './controllers/public-ads.controller';
import { BannerStatsProcessor } from './jobs/banner-stats.processor';
import { ADS_MEDIA, PrismaAdsMedia } from './ports/ads-media.port';
import { ADS_REFERENCES, PrismaAdsReferences } from './ports/ads-references.port';
import { AdServeService } from './services/ad-serve.service';
import { AdTrackingService } from './services/ad-tracking.service';
import { BannerAdminService } from './services/banner-admin.service';
import { BannerSlotsService } from './services/banner-slots.service';
import { BannerStatsService } from './services/banner-stats.service';
import { PopupAdminService } from './services/popup-admin.service';

/** Ads: slot-based banners and popups — admin CRUD, cached public serving, tracking, stats. */
@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.BANNER_STATS })],
  controllers: [
    PublicAdsController,
    AdminBannersController,
    AdminBannerSlotsController,
    AdminPopupsController,
  ],
  providers: [
    { provide: ADS_MEDIA, useClass: PrismaAdsMedia },
    { provide: ADS_REFERENCES, useClass: PrismaAdsReferences },
    AdsMapper,
    BannerSlotsService,
    BannerAdminService,
    PopupAdminService,
    AdServeService,
    AdTrackingService,
    BannerStatsService,
    BannerStatsProcessor,
  ],
  exports: [AdTrackingService],
})
export class AdsModule {}
