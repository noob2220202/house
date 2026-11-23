import { Injectable } from '@nestjs/common';
import {
  isChosungQuery,
  matchesChosung,
  type AssetType,
  type ComplexAutocompleteQuery,
  type ComplexAutocompleteResult,
  type ComplexSearchQuery,
  type ComplexSuggestion,
  type ComplexSummary,
  type Paginated,
  type RegionView,
} from '@house/shared';
import { Prisma } from '@prisma/client';
import { CacheService } from '../../../common/cache/cache.service';
import { toPaginated, toSkipTake } from '../../../common/pagination/pagination';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  COMPLEX_SUMMARY_SELECT,
  toComplexSummary,
  type ComplexSummaryRow,
} from '../complex.mapper';
import { CACHE_TTL_SECONDS, COMPLEXES_CACHE } from '../constants';
import { RegionsService } from './regions.service';

/** Cached 초성 index row (the whole 시군구 is a few hundred 단지). */
interface ChosungEntry {
  id: string;
  name: string;
  emdCode: string | null;
  assetType: AssetType;
  viewCount: number;
}

type SearchFilter = Pick<ComplexSearchQuery, 'q' | 'emdCode' | 'assetType' | 'sort'>;

/** Escapes LIKE wildcards so user input matches literally. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const ORDER_BY: Record<Exclude<ComplexSearchQuery['sort'], 'relevance'>, Prisma.Sql> = {
  name: Prisma.sql`c.name ASC, c.id ASC`,
  popular: Prisma.sql`c.view_count DESC, c.id ASC`,
  households: Prisma.sql`c.households DESC NULLS LAST, c.id ASC`,
  newest: Prisma.sql`c.approval_date DESC NULLS LAST, c.id ASC`,
};

/** 단지 search (trigram ILIKE/similarity on name + address, 초성 search) and 지역+단지 autocomplete. */
@Injectable()
export class ComplexSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly config: AppConfig,
    private readonly regions: RegionsService,
  ) {}

  async search(q: ComplexSearchQuery): Promise<Paginated<ComplexSummary>> {
    const { skip, take } = toSkipTake(q);
    const { ids, total } =
      q.q && isChosungQuery(q.q)
        ? await this.chosungIds(q, skip, take)
        : await this.sqlIds(q, skip, take);
    const rows = await this.rowsInOrder(ids);
    return toPaginated(rows.map(toComplexSummary), total, q);
  }

  async autocomplete(q: ComplexAutocompleteQuery): Promise<ComplexAutocompleteResult> {
    const version = await this.cache.version(COMPLEXES_CACHE.SEARCH);
    const term = q.q.normalize('NFC').trim().toLowerCase();
    const key = `cache:complexes:ac:v${version}:${q.limit}:${encodeURIComponent(term)}`;
    return this.cache.getOrSet(key, CACHE_TTL_SECONDS.AUTOCOMPLETE, async () => {
      const [regions, page] = await Promise.all([
        this.matchRegions(term, Math.min(5, q.limit)),
        isChosungQuery(term)
          ? this.chosungIds({ q: term, sort: 'relevance' }, 0, q.limit)
          : this.sqlIds({ q: term, sort: 'relevance' }, 0, q.limit),
      ]);
      const rows = await this.rowsInOrder(page.ids);
      return { regions, complexes: rows.map(toSuggestion) };
    });
  }

  private async matchRegions(term: string, limit: number): Promise<RegionView[]> {
    const all = await this.regions.activeSubRegions();
    const chosung = isChosungQuery(term);
    const hits = all.filter((r) =>
      chosung ? matchesChosung(r.name, term) : r.name.includes(term) || r.fullName.includes(term),
    );
    // 읍면동 before 리, then exact-prefix before contains.
    hits.sort(
      (a, b) =>
        Number(b.level === 'EMD') - Number(a.level === 'EMD') ||
        Number(b.name.startsWith(term)) - Number(a.name.startsWith(term)),
    );
    return hits.slice(0, limit);
  }

  private async sqlIds(
    f: SearchFilter,
    skip: number,
    take: number,
  ): Promise<{ ids: string[]; total: number }> {
    const conds: Prisma.Sql[] = [
      Prisma.sql`c.deleted_at IS NULL`,
      Prisma.sql`c.sgg_code = ${this.config.get('REGION_SGG_CODE')}`,
    ];
    if (f.emdCode) conds.push(Prisma.sql`c.emd_code = ${f.emdCode}`);
    if (f.assetType) conds.push(Prisma.sql`c.asset_type = ${f.assetType}::asset_type`);
    let orderBy = ORDER_BY.popular;
    if (f.q) {
      const like = `%${escapeLike(f.q)}%`;
      conds.push(Prisma.sql`(
        c.name ILIKE ${like} OR c.road_address ILIKE ${like} OR c.jibun_address ILIKE ${like}
        OR c.emd_name = ${f.q} OR c.name % ${f.q}
      )`);
      if (f.sort === 'relevance') {
        orderBy = Prisma.sql`(c.name ILIKE ${`${escapeLike(f.q)}%`}) DESC,
          similarity(c.name, ${f.q}) DESC, c.view_count DESC, c.id ASC`;
      }
    }
    if (f.sort !== 'relevance') orderBy = ORDER_BY[f.sort];
    const where = Prisma.join(conds, ' AND ');
    const [rows, count] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>`
        SELECT c.id FROM complexes c WHERE ${where} ORDER BY ${orderBy} LIMIT ${take} OFFSET ${skip}`,
      this.prisma.$queryRaw<
        { n: number }[]
      >`SELECT count(*)::int AS n FROM complexes c WHERE ${where}`,
    ]);
    return { ids: rows.map((r) => r.id), total: count[0]?.n ?? 0 };
  }

  private async chosungIds(
    f: SearchFilter,
    skip: number,
    take: number,
  ): Promise<{ ids: string[]; total: number }> {
    const index = await this.chosungIndex();
    const term = f.q ?? '';
    const hits = index.filter(
      (e) =>
        (!f.emdCode || e.emdCode === f.emdCode) &&
        (!f.assetType || e.assetType === f.assetType) &&
        matchesChosung(e.name, term),
    );
    hits.sort((a, b) =>
      f.sort === 'name'
        ? a.name.localeCompare(b.name, 'ko') || a.id.localeCompare(b.id)
        : b.viewCount - a.viewCount || a.id.localeCompare(b.id),
    );
    return { ids: hits.slice(skip, skip + take).map((e) => e.id), total: hits.length };
  }

  private async chosungIndex(): Promise<ChosungEntry[]> {
    const sggCode = this.config.get('REGION_SGG_CODE');
    const version = await this.cache.version(COMPLEXES_CACHE.SEARCH);
    return this.cache.getOrSet(
      `cache:complexes:chosung:v${version}:${sggCode}`,
      CACHE_TTL_SECONDS.CHOSUNG_INDEX,
      () =>
        this.prisma.complex.findMany({
          where: { sggCode, deletedAt: null },
          select: { id: true, name: true, emdCode: true, assetType: true, viewCount: true },
        }),
    );
  }

  private async rowsInOrder(ids: readonly string[]): Promise<ComplexSummaryRow[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.complex.findMany({
      where: { id: { in: [...ids] } },
      select: COMPLEX_SUMMARY_SELECT,
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.flatMap((id) => {
      const r = byId.get(id);
      return r ? [r] : [];
    });
  }
}

function toSuggestion(r: ComplexSummaryRow): ComplexSuggestion {
  return {
    id: r.id,
    name: r.name,
    assetType: r.assetType,
    address: r.roadAddress ?? r.jibunAddress,
    emdName: r.emdName,
    lat: r.lat,
    lng: r.lng,
    households: r.households,
    activeListingCount: r.activeListingCount,
  };
}
