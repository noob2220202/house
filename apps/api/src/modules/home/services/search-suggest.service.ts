import { AgencyStatus } from '@house/shared';
import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../../common/cache/cache.service';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ComplexPopularityService } from '../../complexes/services/complex-popularity.service';
import { ComplexSearchService } from '../../complexes/services/complex-search.service';
import { RegionsService } from '../../complexes/services/regions.service';
import { HOME_CACHE_TTL_SECONDS } from '../constants';
import type { SearchSuggestQuery } from '../dto';
import { HomeStatsService } from './home-stats.service';

export const SuggestionType = { REGION: 'REGION', COMPLEX: 'COMPLEX', AGENCY: 'AGENCY' } as const;
export type SuggestionType = (typeof SuggestionType)[keyof typeof SuggestionType];

/** Item of GET /search/suggest (web w-content `searchSuggestionSchema`). */
export interface SuggestionView {
  type: SuggestionType;
  /** REGION: 법정동 code; COMPLEX / AGENCY: uuid. */
  id: string;
  label: string;
  description: string | null;
  lat: number | null;
  lng: number | null;
}

export interface SuggestResult {
  items: SuggestionView[];
  /** Keywords offered before typing (popular 지역 and 단지 names). */
  popular: string[];
}

const POPULAR_REGION_KEYWORDS = 3;
const POPULAR_COMPLEX_KEYWORDS = 2;

/** "%…%" pattern with LIKE metacharacters escaped. */
function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

const stripSido = (address: string): string =>
  address.replace(/^(전남광주통합특별시|전라남도|전남)\s+/, '');

/**
 * Autocomplete of the site search fields: 지역 (읍면동/리), 단지 and 중개사무소, in that order,
 * cut to `limit`. 지역 and 단지 reuse the complexes autocomplete (trigram + 초성).
 */
@Injectable()
export class SearchSuggestService {
  private readonly logger = new Logger(SearchSuggestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly config: AppConfig,
    private readonly regions: RegionsService,
    private readonly complexSearch: ComplexSearchService,
    private readonly complexPopularity: ComplexPopularityService,
    private readonly homeStats: HomeStatsService,
  ) {}

  async suggest(q: SearchSuggestQuery): Promise<SuggestResult> {
    const popular = await this.popularKeywords();
    if (q.q === '') return { items: [], popular };
    const items = await this.cache.getOrSet(
      `cache:home:suggest:${q.limit}:${encodeURIComponent(q.q.toLowerCase())}`,
      HOME_CACHE_TTL_SECONDS.SUGGEST,
      () => this.items(q.q, q.limit),
    );
    return { items, popular };
  }

  private async items(term: string, limit: number): Promise<SuggestionView[]> {
    const [ac, agencies, subRegions, sggName] = await Promise.all([
      this.complexSearch.autocomplete({ q: term, limit }),
      this.agencies(term, limit),
      this.regions.activeSubRegions(),
      this.homeStats.regionName(),
    ]);
    const names = new Map(subRegions.map((r) => [r.code, r.name]));
    const regionItems = ac.regions.map(
      (r): SuggestionView => ({
        type: SuggestionType.REGION,
        id: r.code,
        label: r.name,
        description:
          [sggName, r.level === 'RI' && r.parentCode ? names.get(r.parentCode) : null]
            .filter(Boolean)
            .join(' ') || null,
        lat: r.lat,
        lng: r.lng,
      }),
    );
    const complexItems = ac.complexes.map(
      (c): SuggestionView => ({
        type: SuggestionType.COMPLEX,
        id: c.id,
        label: c.name,
        description:
          [c.emdName, c.households ? `${c.households.toLocaleString('ko-KR')}세대` : null]
            .filter(Boolean)
            .join(' · ') || null,
        lat: c.lat,
        lng: c.lng,
      }),
    );
    return [...regionItems, ...complexItems, ...agencies].slice(0, limit);
  }

  /** Approved offices of the service region whose name or address contains the term. */
  private async agencies(term: string, limit: number): Promise<SuggestionView[]> {
    const like = likePattern(term);
    const prefix = `${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const rows = await this.prisma.$queryRaw<
      { id: string; name: string; roadAddress: string; lat: number; lng: number }[]
    >`
      SELECT a.id, a.name, a.road_address AS "roadAddress", a.lat, a.lng
      FROM agencies a
      WHERE a.status = ${AgencyStatus.APPROVED}::agency_status AND a.deleted_at IS NULL
        AND a.sgg_code = ${this.config.get('REGION_SGG_CODE')}
        AND (a.name ILIKE ${like} OR a.road_address ILIKE ${like})
      ORDER BY (a.name ILIKE ${prefix}) DESC, (a.name ILIKE ${like}) DESC,
        a.active_listing_count DESC, a.id ASC
      LIMIT ${limit}`;
    return rows.map((a) => ({
      type: SuggestionType.AGENCY,
      id: a.id,
      label: a.name,
      description: stripSido(a.roadAddress),
      lat: a.lat,
      lng: a.lng,
    }));
  }

  /** Names of the most viewed 지역 this week and the most popular 단지 (deduplicated). */
  private popularKeywords(): Promise<string[]> {
    return this.cache.getOrSet(
      `cache:home:popular-keywords:${this.config.get('REGION_SGG_CODE')}`,
      HOME_CACHE_TTL_SECONDS.POPULAR_KEYWORDS,
      async () => {
        try {
          const [regions, complexes] = await Promise.all([
            this.homeStats.popularRegions({ limit: POPULAR_REGION_KEYWORDS }),
            this.complexPopularity.popular({ limit: POPULAR_COMPLEX_KEYWORDS }),
          ]);
          return [
            ...new Set([...regions.items.map((r) => r.name), ...complexes.map((c) => c.name)]),
          ];
        } catch (err) {
          this.logger.warn({ err }, 'popular keywords failed');
          return [];
        }
      },
    );
  }
}
