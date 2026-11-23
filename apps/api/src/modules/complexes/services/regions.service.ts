import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  REGION_CODE_LENGTH,
  RegionLevel,
  type RegionListQuery,
  type RegionUpsertInput,
  type RegionView,
} from '@house/shared';
import type { Region } from '@prisma/client';
import { AuditService } from '../../../common/audit/audit.service';
import { CacheService } from '../../../common/cache/cache.service';
import { RequestContext } from '../../../common/context/request-context';
import { AppException } from '../../../common/errors/app.exception';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CACHE_TTL_SECONDS, COMPLEXES_CACHE } from '../constants';
import {
  SUNCHEON_REGIONS,
  SUNCHEON_SGG,
  SUNCHEON_SGG_CODE,
  SUNCHEON_SIDO,
} from '../regions/suncheon-regions.data';

const CODE_LENGTH_BY_LEVEL: Record<RegionLevel, number> = {
  SIDO: REGION_CODE_LENGTH.SIDO,
  SGG: REGION_CODE_LENGTH.SGG,
  EMD: REGION_CODE_LENGTH.EMD,
  RI: REGION_CODE_LENGTH.FULL,
};

export function toRegionView(r: Region): RegionView {
  return {
    code: r.code,
    name: r.name,
    fullName: r.fullName,
    level: r.level,
    parentCode: r.parentCode,
    lat: r.lat,
    lng: r.lng,
    isActive: r.isActive,
  };
}

/**
 * 법정동 reference table (시도 → 시군구 → 읍면동 → 리) for the service region. Codes follow
 * 법정동코드 truncated per level (2/5/8/10 digits), so a child always starts with its parent.
 */
@Injectable()
export class RegionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly config: AppConfig,
    private readonly audit: AuditService,
  ) {}

  get sggCode(): string {
    return this.config.get('REGION_SGG_CODE');
  }

  async list(q: RegionListQuery): Promise<RegionView[]> {
    const parentCode = q.parentCode ?? (q.level ? undefined : this.sggCode);
    const version = await this.cache.version(COMPLEXES_CACHE.REGIONS);
    const key = `cache:complexes:regions:v${version}:${parentCode ?? '-'}:${q.level ?? '-'}:${q.includeInactive ? 1 : 0}`;
    return this.cache.getOrSet(key, CACHE_TTL_SECONDS.REGIONS, async () => {
      const rows = await this.prisma.region.findMany({
        where: {
          ...(parentCode ? { parentCode } : {}),
          ...(q.level ? { level: q.level } : {}),
          // Without a parent filter stay inside the service 시군구 (and its parents).
          ...(parentCode
            ? {}
            : {
                OR: [
                  { code: { startsWith: this.sggCode } },
                  { code: this.sggCode.slice(0, REGION_CODE_LENGTH.SIDO) },
                ],
              }),
          ...(q.includeInactive ? {} : { isActive: true }),
        },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        take: 1000,
      });
      return rows.map(toRegionView);
    });
  }

  async get(code: string): Promise<RegionView> {
    const row = await this.prisma.region.findUnique({ where: { code } });
    if (!row) throw AppException.notFound(ErrorCode.REGION_NOT_FOUND);
    return toRegionView(row);
  }

  /** Active 읍면동/리 of the service 시군구 (autocomplete source; ~200 rows, cached). */
  async activeSubRegions(): Promise<RegionView[]> {
    const version = await this.cache.version(COMPLEXES_CACHE.REGIONS);
    return this.cache.getOrSet(
      `cache:complexes:regions:v${version}:sub:${this.sggCode}`,
      CACHE_TTL_SECONDS.REGIONS,
      async () =>
        (
          await this.prisma.region.findMany({
            where: {
              code: { startsWith: this.sggCode },
              level: { in: [RegionLevel.EMD, RegionLevel.RI] },
              isActive: true,
            },
            orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
          })
        ).map(toRegionView),
    );
  }

  /** The 읍면동 row for a complex's emdCode; throws COMPLEX_REGION_INVALID outside the 시군구. */
  async requireServiceEmd(emdCode: string): Promise<Region> {
    if (!emdCode.startsWith(this.sggCode)) {
      throw AppException.badRequest(ErrorCode.COMPLEX_REGION_INVALID);
    }
    const row = await this.prisma.region.findUnique({ where: { code: emdCode } });
    if (!row || row.level !== RegionLevel.EMD) {
      throw AppException.badRequest(ErrorCode.COMPLEX_REGION_INVALID);
    }
    return row;
  }

  async upsert(code: string, input: RegionUpsertInput): Promise<RegionView> {
    if (code.length !== CODE_LENGTH_BY_LEVEL[input.level]) {
      throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, [
        { path: 'level', code: 'custom', message: '지역 코드 길이와 단계가 맞지 않습니다.' },
      ]);
    }
    const parentCode = input.parentCode ?? null;
    if (input.level !== RegionLevel.SIDO) {
      if (!parentCode || !code.startsWith(parentCode) || parentCode === code) {
        throw AppException.badRequest(ErrorCode.REGION_PARENT_INVALID);
      }
      const parent = await this.prisma.region.findUnique({ where: { code: parentCode } });
      if (!parent) throw AppException.badRequest(ErrorCode.REGION_PARENT_INVALID);
    } else if (parentCode) {
      throw AppException.badRequest(ErrorCode.REGION_PARENT_INVALID);
    }
    const before = await this.prisma.region.findUnique({ where: { code } });
    RequestContext.setAuditBefore(before);
    const data = {
      name: input.name,
      fullName: input.fullName,
      level: input.level,
      parentCode,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    };
    const row = await this.prisma.region.upsert({
      where: { code },
      create: { code, ...data },
      update: data,
    });
    await this.cache.bump(COMPLEXES_CACHE.REGIONS);
    return toRegionView(row);
  }

  /**
   * Idempotent upsert of the bundled 순천시 법정동 list. Names/levels/parents are refreshed;
   * admin-maintained columns (lat/lng, isActive) are left alone on existing rows.
   */
  async seedDefault(): Promise<{ upserted: number }> {
    if (this.sggCode !== SUNCHEON_SGG_CODE) {
      throw AppException.badRequest(ErrorCode.REGION_SEED_UNAVAILABLE);
    }
    const rows: {
      code: string;
      name: string;
      fullName: string;
      level: RegionLevel;
      parentCode: string | null;
      sortOrder: number;
      lat?: number;
      lng?: number;
    }[] = [
      {
        code: SUNCHEON_SIDO.code,
        name: SUNCHEON_SIDO.name,
        fullName: SUNCHEON_SIDO.name,
        level: RegionLevel.SIDO,
        parentCode: null,
        sortOrder: 0,
      },
      {
        code: SUNCHEON_SGG_CODE,
        name: SUNCHEON_SGG.name,
        fullName: SUNCHEON_SGG.fullName,
        level: RegionLevel.SGG,
        parentCode: SUNCHEON_SIDO.code,
        sortOrder: 0,
        lat: SUNCHEON_SGG.lat,
        lng: SUNCHEON_SGG.lng,
      },
    ];
    const emdNames = new Map<string, string>();
    SUNCHEON_REGIONS.forEach(([code, name], i) => {
      const isEmd = code.length === REGION_CODE_LENGTH.EMD;
      if (isEmd) emdNames.set(code, name);
      const parentCode = isEmd ? SUNCHEON_SGG_CODE : code.slice(0, REGION_CODE_LENGTH.EMD);
      const emdName = isEmd ? '' : `${emdNames.get(parentCode) ?? ''} `;
      rows.push({
        code,
        name,
        fullName: `${SUNCHEON_SGG.fullName} ${emdName}${name}`.replace(/\s+/g, ' '),
        level: isEmd ? RegionLevel.EMD : RegionLevel.RI,
        parentCode,
        sortOrder: i + 1,
      });
    });

    // Parents first (array order), in one transaction.
    await this.prisma.$transaction(
      rows.map((r) =>
        this.prisma.region.upsert({
          where: { code: r.code },
          create: r,
          update: {
            name: r.name,
            fullName: r.fullName,
            level: r.level,
            parentCode: r.parentCode,
            sortOrder: r.sortOrder,
          },
        }),
      ),
    );
    await this.audit.record({
      action: 'region.seed',
      resourceType: 'Region',
      resourceId: SUNCHEON_SGG_CODE,
      after: { upserted: rows.length },
    });
    await this.cache.bump(COMPLEXES_CACHE.REGIONS);
    return { upserted: rows.length };
  }
}
