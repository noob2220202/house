import { createHash } from 'node:crypto';
import {
  ASSET_TYPE_LABEL,
  AgencyStatus,
  ListingStatus,
  TradeDealType,
  DealType,
  REGION_CODE_LENGTH,
  sqmToPyeong,
  type AssetType,
  type Paginated,
} from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CacheService } from '../../../common/cache/cache.service';
import { toPaginated, toSkipTake } from '../../../common/pagination/pagination';
import { decimalToNumber } from '../../../common/utils/decimal';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AGENCY_CACHE } from '../../agencies/constants';
import { nameKey, roadKey, roadNameOf } from '../domain/road-address';
import type { AddressMatchQuery, TargetAgencyQuery } from '../dto';
import { DEAL_REQUEST_MEDIA, type DealRequestMediaPort } from '../ports/media.port';
import { RegionNamesService } from './region-names.service';

/** Agency card of the request form's picker / reach count (web `agencyBriefSchema`). */
export interface TargetAgencyView {
  id: string;
  name: string;
  representativeName: string;
  phone: string;
  roadAddress: string;
  /** "아파트·오피스텔 전문" from the office's specialties; null when none. */
  specialty: string | null;
  activeListingCount: number;
  /** Not measured yet (always null). */
  avgResponseMinutes: number | null;
  logoUrl: string | null;
}

export interface TargetAgencyPage extends Paginated<TargetAgencyView> {
  /** Names of the requested areas ("조례동·연향동"), null without codes. */
  areaLabel: string | null;
}

export interface AddressMatchView {
  emdCode: string | null;
  emdName: string | null;
  lat: number | null;
  lng: number | null;
  complex: {
    id: string;
    name: string;
    emdName: string | null;
    households: number | null;
    builtYear: number | null;
    floorsMax: number | null;
    areaTypes: {
      id: string;
      pyeongLabel: string | null;
      exclusiveArea: number;
      supplyArea: number | null;
    }[];
    market: {
      recentTradePrice: number | null;
      /** "2026-10" */
      recentTradeYm: string | null;
      recentTradePyeong: string | null;
      askingMin: number | null;
      askingMax: number | null;
      /** 만원 / 평 (공급면적) of the latest trade. */
      perPyeong: number | null;
    } | null;
  } | null;
}

interface AgencyRow {
  id: string;
  name: string;
  representativeName: string;
  phone: string;
  roadAddress: string;
  specialties: AssetType[];
  activeListingCount: number;
  logoStorageKey: string | null;
  logoVariants: Prisma.JsonValue | null;
}

/** Short-lived: counts follow approvals within a minute, and the agencies' version bump. */
const TARGETS_CACHE_TTL_SECONDS = 60;
/** Complexes and trades change at most daily (sync job). */
const ADDRESS_MATCH_CACHE_TTL_SECONDS = 300;
const AREA_LABEL_MAX = 3;

const escapeLike = (s: string): string => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const hash = (v: unknown): string =>
  createHash('sha1').update(JSON.stringify(v)).digest('hex').slice(0, 16);

/**
 * Lookups of the 내놓기 / 구하기 form (public): which offices a request reaches
 * (`ALL_AGENCIES_IN_REGION` = every APPROVED office of the service 시군구, the same rule as the
 * inbox) and which registered complex a postcode result is. Read-only; cached in Redis.
 */
@Injectable()
export class RequestFormService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly cache: CacheService,
    private readonly regionNames: RegionNamesService,
    @Inject(DEAL_REQUEST_MEDIA) private readonly media: DealRequestMediaPort,
  ) {}

  async targetAgencies(q: TargetAgencyQuery): Promise<TargetAgencyPage> {
    const codes = [...new Set([...(q.regionCodes ?? []), ...(q.emdCode ? [q.emdCode] : [])])];
    const v = await this.cache.version(AGENCY_CACHE.PUBLIC);
    const key = `cache:deal-requests:targets:v${v}:${hash([q.q ?? '', [...codes].sort(), q.page, q.pageSize])}`;
    return this.cache.getOrSet(key, TARGETS_CACHE_TTL_SECONDS, () => this.loadTargets(q, codes));
  }

  private async loadTargets(q: TargetAgencyQuery, codes: string[]): Promise<TargetAgencyPage> {
    const sggCode = this.config.get('REGION_SGG_CODE');
    const parts: Prisma.Sql[] = [
      Prisma.sql`a.deleted_at IS NULL`,
      Prisma.sql`a.status = ${AgencyStatus.APPROVED}::agency_status`,
      Prisma.sql`a.sgg_code = ${sggCode}`,
    ];
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      parts.push(
        Prisma.sql`(a.name ILIKE ${like} OR a.representative_name ILIKE ${like} OR a.road_address ILIKE ${like})`,
      );
    }
    const where = Prisma.join(parts, ' AND ');
    // Offices based in the requested 읍면동 first, then the busiest.
    const prefixes = codes.map((c) => c.slice(0, REGION_CODE_LENGTH.EMD));
    // (A bare integer in ORDER BY would be a column position, so no constant fallback.)
    const local =
      prefixes.length > 0
        ? Prisma.sql`CASE WHEN LEFT(a.emd_code, ${REGION_CODE_LENGTH.EMD}::int) = ANY(${prefixes}::text[]) THEN 0 ELSE 1 END, `
        : Prisma.empty;
    const { skip, take } = toSkipTake(q);
    const [rows, [count], names] = await Promise.all([
      this.prisma.$queryRaw<AgencyRow[]>`
        SELECT a.id::text AS id, a.name, a.representative_name AS "representativeName", a.phone,
               a.road_address AS "roadAddress", a.specialties::text[] AS specialties,
               a.active_listing_count AS "activeListingCount",
               m.storage_key AS "logoStorageKey", m.variants AS "logoVariants"
        FROM agencies a
        LEFT JOIN media m ON m.id = a.logo_media_id AND m.deleted_at IS NULL
        WHERE ${where}
        ORDER BY ${local}a.active_listing_count DESC, a.name ASC, a.id ASC
        LIMIT ${take} OFFSET ${skip}`,
      this.prisma.$queryRaw<{ count: number }[]>`
        SELECT count(*)::int AS count FROM agencies a WHERE ${where}`,
      this.regionNames.namesOf(codes),
    ]);
    const labels = [...new Set(codes.map((c) => names.get(c)).filter((n): n is string => !!n))];
    return {
      ...toPaginated(
        rows.map((r) => this.toTarget(r)),
        count?.count ?? 0,
        q,
      ),
      areaLabel: labels.length > 0 ? labels.slice(0, AREA_LABEL_MAX).join('·') : null,
    };
  }

  private toTarget(r: AgencyRow): TargetAgencyView {
    return {
      id: r.id,
      name: r.name,
      representativeName: r.representativeName,
      phone: r.phone,
      roadAddress: r.roadAddress,
      specialty:
        r.specialties.length > 0
          ? `${r.specialties.map((s) => ASSET_TYPE_LABEL[s]).join('·')} 전문`
          : null,
      activeListingCount: r.activeListingCount,
      avgResponseMinutes: null,
      logoUrl: r.logoStorageKey
        ? this.media.publicUrl({ storageKey: r.logoStorageKey, variants: r.logoVariants }, 'thumb')
        : null,
    };
  }

  async addressMatch(q: AddressMatchQuery): Promise<AddressMatchView> {
    const key = `cache:deal-requests:address-match:${hash([q.roadAddress, q.buildingName ?? '', q.bcode ?? ''])}`;
    return this.cache.getOrSet(key, ADDRESS_MATCH_CACHE_TTL_SECONDS, () => this.loadMatch(q));
  }

  private async loadMatch(q: AddressMatchQuery): Promise<AddressMatchView> {
    const complexId = await this.findComplexId(q);
    if (!complexId) {
      const emdCode = q.bcode ?? null;
      const names = await this.regionNames.namesOf([emdCode]);
      return {
        emdCode,
        emdName: emdCode ? (names.get(emdCode) ?? null) : null,
        lat: null,
        lng: null,
        complex: null,
      };
    }
    const c = await this.prisma.complex.findUniqueOrThrow({
      where: { id: complexId },
      select: {
        id: true,
        name: true,
        emdCode: true,
        lat: true,
        lng: true,
        households: true,
        builtYear: true,
        floorsMax: true,
        areaTypes: {
          select: { id: true, pyeongLabel: true, exclusiveArea: true, supplyArea: true },
          orderBy: [{ exclusiveArea: 'asc' }, { id: 'asc' }],
        },
      },
    });
    const emdCode = c.emdCode ?? q.bcode ?? null;
    const [names, market] = await Promise.all([
      this.regionNames.namesOf([emdCode]),
      this.market(c.id),
    ]);
    const emdName = emdCode ? (names.get(emdCode) ?? null) : null;
    return {
      emdCode,
      emdName,
      lat: c.lat,
      lng: c.lng,
      complex: {
        id: c.id,
        name: c.name,
        emdName,
        households: c.households,
        builtYear: c.builtYear,
        floorsMax: c.floorsMax,
        areaTypes: c.areaTypes.map((a) => ({
          id: a.id,
          pyeongLabel:
            a.pyeongLabel ??
            pyeongLabelOf(decimalToNumber(a.supplyArea), decimalToNumber(a.exclusiveArea)),
          exclusiveArea: decimalToNumber(a.exclusiveArea) ?? 0,
          supplyArea: decimalToNumber(a.supplyArea),
        })),
        market,
      },
    };
  }

  /**
   * The registered complex of a postcode result: same road name + building number, else the same
   * building name (spaces ignored) in the 읍면동 of `bcode` (or the service 시군구).
   */
  private async findComplexId(q: AddressMatchQuery): Promise<string | null> {
    const sggCode = this.config.get('REGION_SGG_CODE');
    const key = roadKey(q.roadAddress);
    const road = roadNameOf(q.roadAddress);
    if (key && road) {
      const rows = await this.prisma.complex.findMany({
        where: { deletedAt: null, sggCode, roadAddress: { contains: road } },
        select: { id: true, roadAddress: true },
        orderBy: { id: 'asc' },
        take: 50,
      });
      const hit = rows.find((r) => roadKey(r.roadAddress) === key);
      if (hit) return hit.id;
    }
    const wanted = nameKey(q.buildingName);
    if (wanted.length < 2) return null;
    const emd = q.bcode && q.bcode.length >= REGION_CODE_LENGTH.EMD ? q.bcode.slice(0, 8) : null;
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT c.id::text AS id FROM complexes c
      WHERE c.deleted_at IS NULL AND c.sgg_code = ${sggCode}
        ${emd ? Prisma.sql`AND c.emd_code LIKE ${`${emd}%`}` : Prisma.empty}
        AND lower(regexp_replace(c.name, '[\\s()·.,-]', '', 'g')) = ${wanted}
      ORDER BY c.households DESC NULLS LAST, c.id ASC
      LIMIT 1`;
    return rows[0]?.id ?? null;
  }

  /** Latest 매매 실거래 + asking range of the complex's advertised 매매 listings. */
  private async market(
    complexId: string,
  ): Promise<NonNullable<AddressMatchView['complex']>['market']> {
    const [trade, asking] = await Promise.all([
      this.prisma.tradeRecord.findFirst({
        where: { complexId, dealType: TradeDealType.SALE, cancelled: false, price: { not: null } },
        orderBy: [{ dealDate: 'desc' }, { id: 'desc' }],
        select: {
          price: true,
          dealYm: true,
          exclusiveArea: true,
          areaType: { select: { pyeongLabel: true, supplyArea: true } },
        },
      }),
      this.prisma.listing.aggregate({
        where: {
          complexId,
          deletedAt: null,
          status: ListingStatus.ACTIVE,
          dealType: DealType.SALE,
          salePrice: { not: null },
          primaryAgency: { status: AgencyStatus.APPROVED, deletedAt: null },
        },
        _min: { salePrice: true },
        _max: { salePrice: true },
      }),
    ]);
    const askingMin = asking._min.salePrice ?? null;
    const askingMax = asking._max.salePrice ?? null;
    if (!trade && askingMin === null) return null;
    const supply = decimalToNumber(trade?.areaType?.supplyArea ?? null);
    const exclusive = decimalToNumber(trade?.exclusiveArea ?? null);
    const pyeong = supply ?? exclusive;
    const ym = trade ? String(trade.dealYm) : null;
    return {
      recentTradePrice: trade?.price ?? null,
      recentTradeYm: ym ? `${ym.slice(0, 4)}-${ym.slice(4, 6)}` : null,
      recentTradePyeong: trade
        ? (trade.areaType?.pyeongLabel ?? pyeongLabelOf(supply, exclusive))
        : null,
      askingMin,
      askingMax,
      perPyeong: trade?.price && pyeong ? Math.round(trade.price / sqmToPyeong(pyeong, 4)) : null,
    };
  }
}

/** "34평" from 공급면적 (else 전용); null without an area. */
function pyeongLabelOf(supply: number | null, exclusive: number | null): string | null {
  const area = supply ?? exclusive;
  return area ? `${Math.round(sqmToPyeong(area))}평` : null;
}
