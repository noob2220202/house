import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { GEOCODE_THROTTLE } from '../constants';
import { GeocodeQueryDto } from '../dto';
import { GeocodeService, type GeocodeItemView } from '../services/geocode.service';

/**
 * Address search with coordinates (중개사무소 등록 신청 주소). Signed-in users only: it proxies a
 * metered external API with the server's keys, so it is also rate-limited per account.
 */
@ApiTags('home')
@Controller('geo')
export class GeoController {
  constructor(private readonly geocode: GeocodeService) {}

  @Get('geocode')
  @Throttle(GEOCODE_THROTTLE)
  search(@Query() q: GeocodeQueryDto): Promise<{ items: GeocodeItemView[] }> {
    return this.geocode.search(q.query);
  }
}
