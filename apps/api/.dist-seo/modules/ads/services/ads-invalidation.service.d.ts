import { CacheService } from '../../../common/cache/cache.service';
/**
 * Exported for other modules whose changes affect which ads may be served, e.g. an advertiser
 * agency being suspended (its banners must stop at once instead of after the serve TTL).
 */
export declare class AdsInvalidationService {
    private readonly cache;
    constructor(cache: CacheService);
    /** An advertiser agency's status changed; call after the transaction commits. */
    agencyStatusChanged(): Promise<void>;
}
