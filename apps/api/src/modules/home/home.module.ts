import { Module } from '@nestjs/common';
import { ComplexesModule } from '../complexes/complexes.module';
import { ListingsModule } from '../listings/listings.module';
import { MediaModule } from '../media/media.module';
import { GEOCODER, NaverGeocoder } from './clients/naver-geocode.client';
import { GeoController } from './controllers/geo.controller';
import { HomeController } from './controllers/home.controller';
import { FavoriteAgenciesController, InterestRegionsController } from './controllers/me.controller';
import { AdminPoliciesController, PoliciesController } from './controllers/policies.controller';
import { SearchController } from './controllers/search.controller';
import { FavoriteAgenciesService } from './services/favorite-agencies.service';
import { GeocodeService } from './services/geocode.service';
import { HomeStatsService } from './services/home-stats.service';
import { HomeUserDataService } from './services/home-user-data.service';
import { InterestRegionsService } from './services/interest-regions.service';
import { PoliciesService } from './services/policies.service';
import { SearchSuggestService } from './services/search-suggest.service';

/**
 * Public discovery endpoints the site calls outside one listing / 단지 / office: home counters and
 * 지역 ranking, unified autocomplete, address geocoding, operating policy pages, plus the user's
 * 관심 중개사무소 and 관심 지역. Reads listing / 단지 data through the exported services of the
 * listings and complexes modules.
 */
@Module({
  imports: [ListingsModule, ComplexesModule, MediaModule],
  controllers: [
    HomeController,
    SearchController,
    GeoController,
    PoliciesController,
    AdminPoliciesController,
    FavoriteAgenciesController,
    InterestRegionsController,
  ],
  providers: [
    { provide: GEOCODER, useClass: NaverGeocoder },
    HomeStatsService,
    SearchSuggestService,
    GeocodeService,
    PoliciesService,
    FavoriteAgenciesService,
    InterestRegionsService,
    HomeUserDataService,
  ],
  exports: [HomeUserDataService],
})
export class HomeModule {}
