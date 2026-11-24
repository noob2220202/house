import { CacheService } from '../../../common/cache/cache.service';
import { AppConfig } from '../../../config/app-config.service';
import { type GeocodeHit, type Geocoder } from '../clients/naver-geocode.client';
/** Item of GET /geo/geocode (web a-agency `geocodeItemSchema`) + the canonical 법정동 code. */
export interface GeocodeItemView extends GeocodeHit {
    /** 10-digit 법정동 code (canonical 12150…), null when the reverse lookup failed. */
    emdCode: string | null;
}
/**
 * Address search with coordinates, limited to the service 시군구 (REGION_SGG_CODE): proxies the
 * geocoder server-side, maps each hit's 법정동 code through canonicalRegionCode (legacy
 * 46150… → 12150…) and caches answers by normalized query.
 */
export declare class GeocodeService {
    private readonly geocoder;
    private readonly cache;
    private readonly config;
    private readonly logger;
    constructor(geocoder: Geocoder, cache: CacheService, config: AppConfig);
    search(query: string): Promise<{
        items: GeocodeItemView[];
    }>;
    /** "신대1로 18" → "순천시 신대1로 18" so results stay in the service region. */
    private anchor;
}
