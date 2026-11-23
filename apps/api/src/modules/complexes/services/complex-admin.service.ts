import { Inject, Injectable } from '@nestjs/common';
import {
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
import { COMPLEX_DETAIL_SELECT, ComplexQueryService } from './complex-query.service';
import { RegionsService } from './regions.service';

const ADMIN_DETAIL_SELECT = {
  ...COMPLEX_DETAIL_SELECT,
  jibun: true,
  externalCode: true,
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
    @Inject(COMPLEX_MEDIA) private readonly media: ComplexMediaPort,
  ) {}

  list(q: AdminComplexListQuery): Promise<Paginated<AdminComplexListItem>> {
    const where: Prisma.ComplexWhereInput = {
      ...(q.includeDeleted ? {} : { deletedAt: null }),
      ...(q.emdCode ? { emdCode: q.emdCode } : {}),
      ...(q.missingExternalCode ? { externalCode: null } : {}),
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
            select: { ...COMPLEX_SUMMARY_SELECT, externalCode: true, deletedAt: true },
            ...args,
          })
        ).map((r) => ({
          ...toComplexSummary(r),
          externalCode: r.externalCode,
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
    const region = row.emdCode
      ? await this.prisma.region.findUnique({
          where: { code: row.emdCode },
          select: { code: true, name: true, fullName: true },
        })
      : null;
    return {
      ...this.query.base(row),
      region,
      jibun: row.jibun,
      externalCode: row.externalCode,
      tradeCount: row._count.trades,
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
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    const current = await this.prisma.complex.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw AppException.notFound(ErrorCode.COMPLEX_NOT_FOUND);
    RequestContext.setAuditBefore(current);
    // Soft delete; the 국토교통부 code is released so a replacement 단지 can take it.
    await this.prisma.complex.update({
      where: { id },
      data: { deletedAt: new Date(), externalCode: null },
    });
    await this.invalidate();
  }

  async addAreaType(id: string, input: ComplexAreaTypeInput): Promise<ComplexAreaTypeView> {
    await this.requireComplex(id);
    let row;
    try {
      row = await this.prisma.$transaction(async (tx) => {
        const created = await tx.complexAreaType.create({
          data: { complexId: id, ...areaTypeData(input), exclusiveArea: input.exclusiveArea },
          select: AREA_TYPE_SELECT,
        });
        await this.assignUnassignedTrades(tx, id, created.id, input.exclusiveArea);
        return created;
      });
    } catch (err) {
      rethrowUnique(err);
    }
    await this.afterAreaTypeChange(id);
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
      row = await this.prisma.complexAreaType.update({
        where: { id: areaTypeId },
        data: areaTypeData(input),
        select: AREA_TYPE_SELECT,
      });
    } catch (err) {
      rethrowUnique(err);
    }
    await this.afterAreaTypeChange(id);
    return toAreaTypeView(row);
  }

  async removeAreaType(id: string, areaTypeId: string): Promise<void> {
    await this.requireComplex(id);
    const current = await this.prisma.complexAreaType.findFirst({
      where: { id: areaTypeId, complexId: id },
    });
    if (!current) throw AppException.notFound(ErrorCode.COMPLEX_AREA_TYPE_NOT_FOUND);
    RequestContext.setAuditBefore(current);
    // trade_records / properties keep their rows (area_type_id → NULL).
    await this.prisma.complexAreaType.delete({ where: { id: areaTypeId } });
    await this.afterAreaTypeChange(id);
  }

  /** Replaces the photo list (order = array order). */
  async setPhotos(id: string, input: ComplexPhotosInput): Promise<ComplexPhotoView[]> {
    await this.requireComplex(id);
    const mediaIds = input.items.map((i) => i.mediaId);
    await this.media.assertUsable(mediaIds);
    const before = await this.prisma.complexPhoto.findMany({
      where: { complexId: id },
      orderBy: { sortOrder: 'asc' },
      select: { mediaId: true, caption: true, sortOrder: true },
    });
    RequestContext.setAuditBefore(before);
    await this.prisma.$transaction(async (tx) => {
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
    });
    return (await this.get(id)).photos;
  }

  // ---------- internals ----------

  private async requireComplex(id: string): Promise<void> {
    const n = await this.prisma.complex.count({ where: { id, deletedAt: null } });
    if (n === 0) throw AppException.notFound(ErrorCode.COMPLEX_NOT_FOUND);
  }

  private async afterAreaTypeChange(complexId: string): Promise<void> {
    // Stats are grouped by the 평형's 전용면적, so rebuild this 단지's history.
    await this.stats.recompute([complexId]);
    await this.invalidate();
  }

  private async assignUnassignedTrades(
    tx: PrismaTx,
    complexId: string,
    areaTypeId: string,
    exclusiveArea: number,
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE trade_records SET area_type_id = ${areaTypeId}::uuid
      WHERE complex_id = ${complexId}::uuid AND area_type_id IS NULL
        AND abs(exclusive_area - ${exclusiveArea}) <= ${AREA_TYPE_MATCH_TOLERANCE_SQM}`;
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
