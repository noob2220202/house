import { Injectable } from '@nestjs/common';
import { CacheService } from '../../../common/cache/cache.service';
import { ADS_CACHE } from '../constants';

/**
 * Exported for other modules whose changes affect which ads may be served, e.g. an advertiser
 * agency being suspended (its banners must stop at once instead of after the serve TTL).
 */
@Injectable()
export class AdsInvalidationService {
  constructor(private readonly cache: CacheService) {}

  /** An advertiser agency's status changed; call after the transaction commits. */
  async agencyStatusChanged(): Promise<void> {
    await this.cache.bump(ADS_CACHE.BANNERS);
  }
}
