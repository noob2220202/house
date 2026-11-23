import type { AssetType } from '@house/shared';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface DealRequestComplexRow {
  id: string;
  name: string;
  assetType: AssetType;
  sggCode: string;
  emdCode: string | null;
  lat: number;
  lng: number;
}

/** Complex lookups for 내놓기/구하기 validation (read-only; ComplexesModule exposes no reader). */
export interface DealRequestComplexesPort {
  findActive(ids: readonly string[]): Promise<DealRequestComplexRow[]>;
}

export const DEAL_REQUEST_COMPLEXES = Symbol('DEAL_REQUEST_COMPLEXES');

@Injectable()
export class PrismaDealRequestComplexes implements DealRequestComplexesPort {
  constructor(private readonly prisma: PrismaService) {}

  findActive(ids: readonly string[]): Promise<DealRequestComplexRow[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.complex.findMany({
      where: { id: { in: [...new Set(ids)] }, deletedAt: null },
      select: {
        id: true,
        name: true,
        assetType: true,
        sggCode: true,
        emdCode: true,
        lat: true,
        lng: true,
      },
    });
  }
}
