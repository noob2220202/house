import { createHash } from 'node:crypto';
import {
  canonicalRegionCode,
  DEFAULT_MAP_CENTER,
  DEFAULT_SGG_CODE,
  ErrorCode,
} from '@house/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../../common/cache/cache.service';
import { AppException } from '../../../common/errors/app.exception';
import { AppConfig } from '../../../config/app-config.service';
import {
  GEOCODER,
  GeocoderUnavailableError,
  type GeocodeHit,
  type Geocoder,
} from '../clients/naver-geocode.client';
import { GEOCODE_MAX_RESULTS, HOME_CACHE_TTL_SECONDS } from '../constants';

/** Item of GET /geo/geocode (web a-agency `geocodeItemSchema`) + the canonical 법정동 code. */
export interface GeocodeItemView extends GeocodeHit {
  /** 10-digit 법정동 code (canonical 12150…), null when the reverse lookup failed. */
  emdCode: string | null;
}

/** 시군구 name the query is anchored to when the visitor did not type it ("순천시"). */
const SERVICE_CITY = '순천시';

/**
 * Address search with coordinates, limited to the service 시군구 (REGION_SGG_CODE): proxies the
 * geocoder server-side, maps each hit's 법정동 code through canonicalRegionCode (legacy
 * 46150… → 12150…) and caches answers by normalized query.
 */
@Injectable()
export class GeocodeService {
  private readonly logger = new Logger(GeocodeService.name);

  constructor(
    @Inject(GEOCODER) private readonly geocoder: Geocoder,
    private readonly cache: CacheService,
    private readonly config: AppConfig,
  ) {}

  async search(query: string): Promise<{ items: GeocodeItemView[] }> {
    if (!this.geocoder.isConfigured()) {
      throw new AppException(ErrorCode.GEOCODE_UNAVAILABLE);
    }
    const sgg = this.config.get('REGION_SGG_CODE');
    const anchored = this.anchor(query, sgg);
    const key = `cache:home:geocode:${sgg}:${createHash('sha256').update(anchored).digest('hex').slice(0, 32)}`;
    const cached = await this.cache.get<GeocodeItemView[]>(key);
    if (cached) return { items: cached };

    let hits: GeocodeHit[];
    try {
      hits = await this.geocoder.geocode(
        anchored,
        sgg === DEFAULT_SGG_CODE ? DEFAULT_MAP_CENTER : null,
      );
    } catch (err) {
      if (!(err instanceof GeocoderUnavailableError)) throw err;
      this.logger.warn({ err: err.message }, 'geocoding failed');
      throw new AppException(ErrorCode.GEOCODE_UNAVAILABLE);
    }
    const coded = await Promise.all(
      hits.slice(0, GEOCODE_MAX_RESULTS).map(async (h): Promise<GeocodeItemView> => {
        const code = await this.geocoder.legalCode(h.lat, h.lng);
        return { ...h, emdCode: code ? canonicalRegionCode(code) : null };
      }),
    );
    const items = coded.filter((h) =>
      h.emdCode
        ? h.emdCode.startsWith(sgg)
        : `${h.roadAddress} ${h.jibunAddress ?? ''}`.includes(SERVICE_CITY),
    );
    await this.cache.set(
      key,
      items,
      items.length > 0 ? HOME_CACHE_TTL_SECONDS.GEOCODE : HOME_CACHE_TTL_SECONDS.GEOCODE_EMPTY,
    );
    return { items };
  }

  /** "신대1로 18" → "순천시 신대1로 18" so results stay in the service region. */
  private anchor(query: string, sgg: string): string {
    if (sgg !== DEFAULT_SGG_CODE || query.includes('순천')) return query;
    return `${SERVICE_CITY} ${query}`;
  }
}
