import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../../queue/queue.constants';
import { ListingsModule } from '../listings/listings.module';
import { AdminComplexesController } from './controllers/admin-complexes.controller';
import { AdminTradeSyncController } from './controllers/admin-trade-sync.controller';
import { FavoriteComplexesController } from './controllers/favorite-complexes.controller';
import { PublicComplexesController } from './controllers/public-complexes.controller';
import { AdminRegionsController, RegionsController } from './controllers/regions.controller';
import { COMPLEX_MEDIA, PrismaComplexMedia } from './ports/complex-media.port';
import { ComplexAdminService } from './services/complex-admin.service';
import { ComplexFavoritesService } from './services/complex-favorites.service';
import { ComplexListingsService } from './services/complex-listings.service';
import { ComplexPopularityService } from './services/complex-popularity.service';
import { ComplexQueryService } from './services/complex-query.service';
import { ComplexSearchService } from './services/complex-search.service';
import { ComplexTradesService } from './services/complex-trades.service';
import { RegionsService } from './services/regions.service';
import { DataGoKrTradeApiClient, TRADE_API_CLIENT } from './trade-sync/trade-api.client';
import { TradeStatsService } from './trade-sync/trade-stats.service';
import { TradeSyncProcessor } from './trade-sync/trade-sync.processor';
import { TradeSyncService } from './trade-sync/trade-sync.service';

/**
 * 단지 (complexes), 평형, 법정동 regions, 실거래가 sync + stats, popularity, 관심 단지.
 * ListingsModule is imported only for RecentViewsService (최근 본 단지).
 */
@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.TRADE_SYNC }), ListingsModule],
  controllers: [
    // trade-sync before the generic admin complexes routes (`admin/complexes/:id`).
    AdminTradeSyncController,
    AdminComplexesController,
    PublicComplexesController,
    FavoriteComplexesController,
    RegionsController,
    AdminRegionsController,
  ],
  providers: [
    { provide: TRADE_API_CLIENT, useClass: DataGoKrTradeApiClient },
    { provide: COMPLEX_MEDIA, useClass: PrismaComplexMedia },
    RegionsService,
    ComplexListingsService,
    ComplexTradesService,
    ComplexPopularityService,
    ComplexFavoritesService,
    ComplexSearchService,
    ComplexQueryService,
    ComplexAdminService,
    TradeStatsService,
    TradeSyncService,
    TradeSyncProcessor,
  ],
  exports: [RegionsService, ComplexListingsService, TradeSyncService],
})
export class ComplexesModule {}
