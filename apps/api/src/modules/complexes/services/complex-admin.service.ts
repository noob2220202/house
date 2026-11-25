import { Inject, Injectable } from '@nestjs/common';
import {
  ComplexDataSource,
  ErrorCode,
  parseJibunAddress,
  type AdminComplexListItem,
  type AdminComplexListQuery,
  type AdminComplexView,
  type ComplexAreaTypeInput,
  type ComplexAreaTypeUpdate,
  type ComplexAreaTypeView,
  type ComplexCreateInput,
  type ComplexPhotosInput,
  type ComplexPhotoView,
  type ComplexUpdateInput,
  type Paginated,
  TradeDealType,
} from '@house/shared';
import { Prisma } from '@prisma/client';
import { CacheService } from '../../../common/cache/cache.service';
import { RequestContext } from '../../../common/context/request-context';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { pyeongLabel } from '../../../common/utils/area';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import {
  AREA_TYPE_SELECT,
  COMPLEX_SUMMARY_SELECT,
  toAreaTypeView,
  toComplexSummary,
} from '../complex.mapper';
import { AREA_TYPE_MATCH_TOLERANCE_SQM, COMPLEXES_CACHE } from '../constants';
import { COMPLEX_MEDIA, type ComplexMediaPort } from '../ports/complex-media.port';
import { TradeStatsService } from '../trade-sync/trade-stats.service';
import { TradeSyncJobs } from '../trade-sync/trade-sync.jobs';
import { COMPLEX_DETAIL_SELECT, ComplexQueryService } from './complex-query.service';
import { RegionsService } from './regions.service';

const ADMIN_DETAIL_SELECT = {
  ...COMPLEX_DETAIL_SELECT,
  jibun: true,
  externalCode: true,
  source: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  _count: { select: { trades: true } },
} as const satisfies Prisma.ComplexSelect;

function uniqueTarget(err: unknown): string | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return null;
  const target = err.meta?.target;
  return Array.isArray(target) ? target.join(',') : typeof target === 'string' ? target : '';
}

/** Maps unique violations to domain codes; rethrows everything else. */
function rethrowUnique(err: unknown): never {
  const target = uniqueTarget(err);
  if (target !== null) {
    if (/external_code|externalCode/.test(target)) {
      throw AppException.conflict(ErrorCode.COMPLEX_EXTERNAL_CODE_DUPLICATE);
    }
    throw AppException.conflict(ErrorCode.COMPLEX_AREA_TYPE_DUPLICATE);
  }
  throw err;
}

function areaTypeData(input: ComplexAreaTypeInput | ComplexAreaTypeUpdate) {
  return {
    ...(input.exclusiveArea !== undefined ? { exclusiveArea: input.exclusiveArea } : {}),
    ...(input.supplyArea !== undefined ? { supplyArea: input.supplyArea } : {}),
    ...(input.typeName !== undefined ? { typeName: input.typeName } : {}),
    ...(input.pyeongLabel !== undefined
      ? { pyeongLabel: input.pyeongLabel }
      : input.supplyArea
        ? { pyeongLabel: pyeongLabel(input.supplyArea) }
        : {}),
    ...(input.households !== undefined ? { households: input.households } : {}),
    ...(input.rooms !== undefined ? { rooms: input.rooms } : {}),
    ...(input.baths !== undefined ? { baths: input.baths } : {}),
  };
}

/** Fields the trade matcher reads: changing any of them can re-attribute 실거래 rows. */
const MATCH_FIELDS = [
  'name',
  'emdCode',
  'emdName',
  'jibun',
  'jibunAddress',
  'externalCode',
] as const;

/** Interactive transactions that also rebuild one 단지's stats history. */
const STATS_TX_OPTIONS = { timeout: 30_000 } as const;

/** Admin CRUD for 단지, 평형 and 단지 photos. Every mutation is audited by the controller. */
@Injectable()
export class ComplexAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly regions: RegionsService,
    private readonly query: ComplexQueryService,
    private readonly stats: TradeStatsService,
    private readonly cache: CacheService,
    private readonly config: AppConfig,
    private readonly jobs: TradeSyncJobs,
    @Inject(COMPLEX_MEDIA) private readonly media: ComplexMediaPort,
  ) {}

  list(q: AdminComplexListQuery): Promise<Paginated<AdminComplexListItem>> {
    const where: Prisma.ComplexWhereInput = {
      ...(q.includeDeleted ? {} : { deletedAt: null }),
      ...(q.emdCode ? { emdCode: q.emdCode } : {}),
      ...(q.missingExternalCode ? { externalCode: null } : {}),
      ...(q.source ? { source: q.source } : {}),
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q, mode: 'insensitive' } },
              { roadAddress: { contains: q.q, mode: 'insensitive' } },
              { jibunAddress: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return paginate(
      q,
      async (args) =>
        (
          await this.prisma.complex.findMany({
            where,
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            select: {
              ...COMPLEX_SUMMARY_SELECT,
              externalCode: true,
              source: true,
              deletedAt: true,
            },
            ...args,
          })
        ).map((r) => ({
          ...toComplexSummary(r),
          externalCode: r.externalCode,
          source: r.source,
          deletedAt: r.deletedAt?.toISOString() ?? null,
        })),
      () => this.prisma.complex.count({ where }),
    );
  }

  async get(id: string): Promise<AdminComplexView> {
    const row = await this.prisma.complex.findUnique({
      where: { id },
      select: ADMIN_DETAIL_SELECT,
    });
    if (!row) throw AppException.notFound(ErrorCode.COMPLEX_NOT_FOUND);
    const live = { complexId: id, cancelled: false };
    const [region, perType, lastSales, unmatched, last] = await Promise.all([
      row.emdCode
        ? this.prisma.region.findUnique({
            where: { code: row.emdCode },
            select: { code: true, name: true, fullName: true },
          })
        : null,
      this.prisma.tradeRecord.groupBy({
        by: ['areaTypeId'],
        where: { complexId: id, areaTypeId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.tradeRecord.findMany({
        where: {
          ...live,
          dealType: TradeDealType.SALE,
          areaTypeId: { not: null },
          price: { not: null },
        },
        distinct: ['areaTypeId'],
        orderBy: [{ areaTypeId: 'asc' }, { dealDate: 'desc' }],
        select: { areaTypeId: true, price: true },
      }),
      this.prisma.tradeRecord.count({ where: { ...live, areaTypeId: null } }),
      this.prisma.tradeRecord.findFirst({
        where: live,
        orderBy: { dealDate: 'desc' },
        select: { dealDate: true },
      }),
    ]);
    const countOf = new Map(perType.map((g) => [g.areaTypeId, g._count._all]));
    const lastSaleOf = new Map(lastSales.map((t) => [t.areaTypeId, t.price]));
    const base = this.query.base(row);
    return {
      ...base,
      areaTypes: base.areaTypes.map((a) => ({
        ...a,
        tradeCount: countOf.get(a.id) ?? 0,
        lastSalePrice: lastSaleOf.get(a.id) ?? null,
      })),
      region,
      jibun: row.jibun,
      externalCode: row.externalCode,
      source: row.source,
      tradeCount: row._count.trades,
      trades: {
        total: row._count.trades,
        unmatched,
        lastDealDate: last ? last.dealDate.toISOString().slice(0, 10) : null,
      },
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    };
  }

  async create(input: ComplexCreateInput): Promise<AdminComplexView> {
    const location = await this.resolveLocation(input, null);
    let id: string;
    try {
      id = await this.prisma.$transaction(async (tx) => {
        const c = await tx.complex.create({
          data: {
            ...this.scalarData(input),
            ...location,
            name: input.name,
            assetType: input.assetType,
            lat: input.lat,
            lng: input.lng,
            sggCode: this.config.get('REGION_SGG_CODE'),
          },
          select: { id: true },
        });
        if (input.areaTypes.length > 0) {
          await tx.complexAreaType.createMany({
            data: input.areaTypes.map((a) => ({
              complexId: c.id,
              ...areaTypeData(a),
              exclusiveArea: a.exclusiveArea,
            })),
          });
        }
        return c.id;
      });
    } catch (err) {
      rethrowUnique(err);
    }
    await this.invalidate();
    // A new 단지 may own trades synced before it existed.
    await this.jobs.requestRematch();
    return this.get(id);
  }

  async update(id: string, input: ComplexUpdateInput): Promise<AdminComplexView> {
    const current = await this.prisma.complex.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw AppException.notFound(ErrorCode.COMPLEX_NOT_FOUND);
    RequestContext.setAuditBefore(current);
    const location = await this.resolveLocation(input, current);
    try {
      await this.prisma.complex.update({
        where: { id },
        data: {
          ...this.scalarData(input),
          ...location,
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.assetType !== undefined ? { assetType: input.assetType } : {}),
          ...(input.lat !== undefined ? { lat: input.lat } : {}),
          ...(input.lng !== undefined ? { lng: input.lng } : {}),
        },
      });
    } catch (err) {
      rethrowUnique(err);
    }
    await this.invalidate();
    if (MATCH_FIELDS.some((f) => input[f] !== undefined)) await this.jobs.requestRematch();
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    const current = await this.prisma.complex.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw AppException.notFound(ErrorCode.COMPLEX_NOT_FOUND);
    RequestContext.setAuditBefore(current);
    await this.prisma.$transaction(async (tx) => {
      await TradeStatsService.lock(tx, [id]);
      // Its 실거래 rows become unmatched (a replacement 단지 picks them up on rematch) and its
      // stats go with it.
      await tx.$executeRaw`
        UPDATE trade_records SET complex_id = NULL, area_type_id = NULL
        WHERE complex_id = ${id}::uuid`;
      await tx.$executeRaw`DELETE FROM complex_trade_stats WHERE complex_id = ${id}::uuid`;
      // Soft delete; the 국토교통부 code is released so a replacement 단지 can take it.
      await tx.complex.update({
        where: { id },
        data: { deletedAt: new Date(), externalCode: null },
      });
    }, STATS_TX_OPTIONS);
    await this.invalidate();
    await this.jobs.requestRematch();
  }

  async addAreaType(id: string, input: ComplexAreaTypeInput): Promise<ComplexAreaTypeView> {
    await this.requireComplex(id);
    let row;
    try {
      row = await this.prisma.$transaction(async (tx) => {
        await TradeStatsService.lock(tx, [id]);
        const created = await tx.complexAreaType.create({
          data: { complexId: id, ...areaTypeData(input), exclusiveArea: input.exclusiveArea },
          select: AREA_TYPE_SELECT,
        });
        await this.reassignAreaTypes(tx, id);
        return created;
      }, STATS_TX_OPTIONS);
    } catch (err) {
      rethrowUnique(err);
    }
    await this.invalidate();
    return toAreaTypeView(row);
  }

  async updateAreaType(
    id: string,
    areaTypeId: string,
    input: ComplexAreaTypeUpdate,
  ): Promise<ComplexAreaTypeView> {
    await this.requireComplex(id);
    const current = await this.prisma.complexAreaType.findFirst({
      where: { id: areaTypeId, complexId: id },
    });
    if (!current) throw AppException.notFound(ErrorCode.COMPLEX_AREA_TYPE_NOT_FOUND);
    RequestContext.setAuditBefore(current);
    let row;
    try {
      row = await this.prisma.$transaction(async (tx) => {
        await TradeStatsService.lock(tx, [id]);
        const updated = await tx.complexAreaType.update({
          where: { id: areaTypeId },
          // An admin-edited 평형 is theirs: the 실거래가 bootstrap stops adding 평형 to this 단지.
          data: { ...areaTypeData(input), source: ComplexDataSource.ADMIN },
          select: AREA_TYPE_SELECT,
        });
        if (input.exclusiveArea !== undefined) await this.reassignAreaTypes(tx, id);
        return updated;
      }, STATS_TX_OPTIONS);
    } catch (err) {
      rethrowUnique(err);
    }
    await this.invalidate();
    return toAreaTypeView(row);
  }

  async removeAreaType(id: string, areaTypeId: string): Promise<void> {
    await this.requireComplex(id);
    const current = await this.prisma.complexAreaType.findFirst({
      where: { id: areaTypeId, complexId: id },
    });
    if (!current) throw AppException.notFound(ErrorCode.COMPLEX_AREA_TYPE_NOT_FOUND);
    RequestContext.setAuditBefore(current);
    await this.prisma.$transaction(async (tx) => {
      await TradeStatsService.lock(tx, [id]);
      // trade_records / properties keep their rows (area_type_id → NULL, then trades move to the
      // nearest remaining 평형 within tolerance).
      await tx.complexAreaType.delete({ where: { id: areaTypeId } });
      // The admin curated the 평형 list: the 실거래가 bootstrap must not add the deleted one back.
      await tx.complexAreaType.updateMany({
        where: { complexId: id, source: { not: ComplexDataSource.ADMIN } },
        data: { source: ComplexDataSource.ADMIN },
      });
      await this.reassignAreaTypes(tx, id);
    }, STATS_TX_OPTIONS);
    await this.invalidate();
  }

  /** Replaces the photo list (order = array order). */
  async setPhotos(id: string, input: ComplexPhotosInput): Promise<ComplexPhotoView[]> {
    await this.requireComplex(id);
    const mediaIds = input.items.map((i) => i.mediaId);
    const before = await this.prisma.$transaction(async (tx) => {
      // Locks the uploads FOR SHARE so the orphan cleanup cannot delete them under us.
      await this.media.assertUsable(mediaIds, tx);
      const prev = await tx.complexPhoto.findMany({
        where: { complexId: id },
        orderBy: { sortOrder: 'asc' },
        select: { mediaId: true, caption: true, sortOrder: true },
      });
      await tx.complexPhoto.deleteMany({ where: { complexId: id } });
      if (input.items.length > 0) {
        await tx.complexPhoto.createMany({
          data: input.items.map((item, i) => ({
            complexId: id,
            mediaId: item.mediaId,
            caption: item.caption ?? null,
            sortOrder: i,
          })),
        });
      }
      const kept = new Set(mediaIds);
      await this.media.released(
        prev.map((p) => p.mediaId).filter((m) => !kept.has(m)),
        tx,
      );
      return prev;
    });
    RequestContext.setAuditBefore(before);
    return (await this.get(id)).photos;
  }

  // ---------- internals ----------

  private async requireComplex(id: string): Promise<void> {
    const n = await this.prisma.complex.count({ where: { id, deletedAt: null } });
    if (n === 0) throw AppException.notFound(ErrorCode.COMPLEX_NOT_FOUND);
  }

  /**
   * Re-assigns every trade of the 단지 to its nearest 평형 within the tolerance (ties → lowest id,
   * as ComplexMatcher.areaTypeFor) and rebuilds the 단지's stats, which are grouped by the 평형's
   * 전용면적. Call inside the transaction that changed the 평형 (stats lock already held).
   */
  private async reassignAreaTypes(tx: PrismaTx, complexId: string): Promise<void> {
    await tx.$executeRaw`
      UPDATE trade_records tr SET area_type_id = best.id
      FROM (
        SELECT tr2.id AS tid,
               (SELECT at.id FROM complex_area_types at
                WHERE at.complex_id = tr2.complex_id
                  AND abs(at.exclusive_area - tr2.exclusive_area) <= ${AREA_TYPE_MATCH_TOLERANCE_SQM}
                ORDER BY abs(at.exclusive_area - tr2.exclusive_area), at.id
                LIMIT 1) AS id
        FROM trade_records tr2
        WHERE tr2.complex_id = ${complexId}::uuid
      ) best
      WHERE tr.id = best.tid AND tr.area_type_id IS DISTINCT FROM best.id`;
    await this.stats.recomputeIn(tx, [complexId]);
  }

  private async invalidate(): Promise<void> {
    await Promise.all([
      this.cache.bump(COMPLEXES_CACHE.SEARCH),
      this.cache.bump(COMPLEXES_CACHE.POPULAR),
    ]);
  }

  /**
   * emdCode → validated 읍면동; emdName / jibun default to what the 지번주소 says (that is how
   * 국토교통부 reports them), else the 읍면동 name.
   */
  private async resolveLocation(
    input: ComplexUpdateInput,
    current: {
      emdCode: string | null;
      emdName: string | null;
      jibun: string | null;
      jibunAddress: string | null;
    } | null,
  ): Promise<Partial<{ emdCode: string | null; emdName: string | null; jibun: string | null }>> {
    const out: Partial<{ emdCode: string | null; emdName: string | null; jibun: string | null }> =
      {};
    let regionName: string | null | undefined;
    if (input.emdCode !== undefined) {
      out.emdCode = input.emdCode;
      regionName = input.emdCode
        ? (await this.regions.requireServiceEmd(input.emdCode)).name
        : null;
    }
    const parsed = parseJibunAddress(input.jibunAddress ?? current?.jibunAddress ?? null);
    if (input.jibun !== undefined) out.jibun = input.jibun;
    else if (input.jibunAddress !== undefined || !current)
      out.jibun = parsed.jibun ?? current?.jibun ?? null;

    if (input.emdName !== undefined) out.emdName = input.emdName;
    else if (input.jibunAddress !== undefined || input.emdCode !== undefined || !current) {
      out.emdName = parsed.emdName ?? regionName ?? current?.emdName ?? null;
    }
    return out;
  }

  private scalarData(input: ComplexUpdateInput) {
    const approvalDate =
      input.approvalDate === undefined
        ? undefined
        : input.approvalDate === null
          ? null
          : new Date(`${input.approvalDate}T00:00:00Z`);
    const builtYear =
      input.builtYear !== undefined
        ? input.builtYear
        : approvalDate
          ? approvalDate.getUTCFullYear()
          : undefined;
    const parkingPerHousehold =
      input.parkingPerHousehold !== undefined
        ? input.parkingPerHousehold
        : input.parkingTotal && input.households
          ? Math.round((input.parkingTotal / input.households) * 100) / 100
          : undefined;
    const d = input;
    return {
      ...(d.roadAddress !== undefined ? { roadAddress: d.roadAddress } : {}),
      ...(d.jibunAddress !== undefined ? { jibunAddress: d.jibunAddress } : {}),
      ...(d.households !== undefined ? { households: d.households } : {}),
      ...(d.buildings !== undefined ? { buildings: d.buildings } : {}),
      ...(d.floorsMin !== undefined ? { floorsMin: d.floorsMin } : {}),
      ...(d.floorsMax !== undefined ? { floorsMax: d.floorsMax } : {}),
      ...(d.parkingTotal !== undefined ? { parkingTotal: d.parkingTotal } : {}),
      ...(d.floorAreaRatio !== undefined ? { floorAreaRatio: d.floorAreaRatio } : {}),
      ...(d.buildingCoverageRatio !== undefined
        ? { buildingCoverageRatio: d.buildingCoverageRatio }
        : {}),
      ...(d.heatingType !== undefined ? { heatingType: d.heatingType } : {}),
      ...(d.builder !== undefined ? { builder: d.builder } : {}),
      ...(d.externalCode !== undefined ? { externalCode: d.externalCode } : {}),
      ...(approvalDate !== undefined ? { approvalDate } : {}),
      ...(builtYear !== undefined ? { builtYear } : {}),
      ...(parkingPerHousehold !== undefined ? { parkingPerHousehold } : {}),
    };
  }
}
