import { AgencyStatus, ErrorCode } from '@house/shared';
import { Injectable } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';

/**
 * Read-only lookups into agencies / complexes / regions that banner validation and targeting
 * need. Kept behind a port so the module does not depend on those modules' internals.
 */
export interface AdsReferencesPort {
  /** Throws BANNER_AGENCY_INVALID unless the agency exists, is APPROVED and not deleted. */
  assertAgency(agencyId: string, db?: PrismaTx): Promise<void>;
  /** Throws BANNER_TARGET_INVALID (details.missing) unless every code is an active region. */
  assertRegions(codes: readonly string[], db?: PrismaTx): Promise<void>;
  /** Throws BANNER_TARGET_INVALID (details.missing) unless every complex exists (not deleted). */
  assertComplexes(ids: readonly string[], db?: PrismaTx): Promise<void>;
  /** Region codes of a complex (for region-targeted banners on complex pages). */
  complexRegionCodes(complexId: string): Promise<string[]>;
  /** Region codes of several complexes (unknown/deleted ids are absent from the map). */
  complexRegionCodesMany(ids: readonly string[], db?: PrismaTx): Promise<Map<string, string[]>>;
}

export const ADS_REFERENCES = Symbol('ADS_REFERENCES');

@Injectable()
export class PrismaAdsReferences implements AdsReferencesPort {
  constructor(private readonly prisma: PrismaService) {}

  async assertAgency(agencyId: string, db: PrismaTx = this.prisma): Promise<void> {
    const n = await db.agency.count({
      where: { id: agencyId, deletedAt: null, status: AgencyStatus.APPROVED },
    });
    if (n !== 1) throw AppException.badRequest(ErrorCode.BANNER_AGENCY_INVALID);
  }

  async assertRegions(codes: readonly string[], db: PrismaTx = this.prisma): Promise<void> {
    if (codes.length === 0) return;
    const rows = await db.region.findMany({
      where: { code: { in: [...codes] }, isActive: true },
      select: { code: true },
    });
    const found = new Set(rows.map((r) => r.code));
    const missing = codes.filter((c) => !found.has(c));
    if (missing.length > 0) {
      throw AppException.badRequest(ErrorCode.BANNER_TARGET_INVALID, {
        missingRegionCodes: missing,
      });
    }
  }

  async assertComplexes(ids: readonly string[], db: PrismaTx = this.prisma): Promise<void> {
    if (ids.length === 0) return;
    const rows = await db.complex.findMany({
      where: { id: { in: [...ids] }, deletedAt: null },
      select: { id: true },
    });
    const found = new Set(rows.map((r) => r.id));
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw AppException.badRequest(ErrorCode.BANNER_TARGET_INVALID, {
        missingComplexIds: missing,
      });
    }
  }

  async complexRegionCodes(complexId: string): Promise<string[]> {
    const c = await this.prisma.complex.findFirst({
      where: { id: complexId, deletedAt: null },
      select: { sggCode: true, emdCode: true },
    });
    if (!c) return [];
    return [c.sggCode, c.emdCode].filter((x): x is string => typeof x === 'string');
  }

  async complexRegionCodesMany(
    ids: readonly string[],
    db: PrismaTx = this.prisma,
  ): Promise<Map<string, string[]>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await db.complex.findMany({
      where: { id: { in: unique }, deletedAt: null },
      select: { id: true, sggCode: true, emdCode: true },
    });
    return new Map(
      rows.map((c) => [
        c.id,
        [c.sggCode, c.emdCode].filter((x): x is string => typeof x === 'string'),
      ]),
    );
  }
}
