import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { bundledRegionLabel } from '../../complexes/regions/bundled-region';
import { regionNameCandidates, regionNameOf, type RegionNameRow } from '../domain/region-name';

/** 법정동 display names from the `regions` table (one query per call). */
@Injectable()
export class RegionNamesService {
  private readonly logger = new Logger(RegionNamesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * code → name for every code that resolves: the regions table, else the bundled verified 순천시
   * list. Unknown codes are left out (never shown as the raw code) and logged.
   */
  async namesOf(codes: readonly (string | null | undefined)[]): Promise<Map<string, string>> {
    const wanted = [...new Set(codes.filter((c): c is string => !!c && c.length >= 8))];
    if (wanted.length === 0) return new Map();
    const rows: RegionNameRow[] = await this.prisma.region.findMany({
      where: { code: { in: [...new Set(wanted.flatMap(regionNameCandidates))] } },
      select: { code: true, name: true, level: true, parent: { select: { name: true } } },
    });
    const byCode = new Map(rows.map((r) => [r.code, r]));
    const out = new Map<string, string>();
    const unknown: string[] = [];
    for (const code of wanted) {
      const name = regionNameOf(code, byCode) ?? bundledRegionLabel(code)?.emdName ?? null;
      if (name) out.set(code, name);
      else unknown.push(code);
    }
    if (unknown.length > 0) {
      this.logger.warn({ codes: unknown }, '법정동 codes without a regions row');
    }
    return out;
  }
}
