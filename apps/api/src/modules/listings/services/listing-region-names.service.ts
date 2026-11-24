import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { emdNameCandidates, emdNameOf, type RegionNameRow } from '../domain/emd-name';

/** 법정동 names of listings (ListingSummary.emdName) from the regions table, one query per page. */
@Injectable()
export class ListingRegionNamesService {
  constructor(private readonly prisma: PrismaService) {}

  /** emdCode → display name for every code that resolves (codes without a region are left out). */
  async namesOf(emdCodes: readonly (string | null)[]): Promise<Map<string, string>> {
    const codes = [...new Set(emdCodes.filter((c): c is string => !!c && c.length >= 8))];
    if (codes.length === 0) return new Map();
    const rows: RegionNameRow[] = await this.prisma.region.findMany({
      where: { code: { in: [...new Set(codes.flatMap(emdNameCandidates))] } },
      select: { code: true, name: true, level: true, parent: { select: { name: true } } },
    });
    const byCode = new Map(rows.map((r) => [r.code, r]));
    const out = new Map<string, string>();
    for (const code of codes) {
      const name = emdNameOf(code, byCode);
      if (name) out.set(code, name);
    }
    return out;
  }

  async nameOf(emdCode: string | null): Promise<string | null> {
    if (!emdCode) return null;
    return (await this.namesOf([emdCode])).get(emdCode) ?? null;
  }
}
