import type { AssetType } from '@house/shared';
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
export declare const DEAL_REQUEST_COMPLEXES: unique symbol;
export declare class PrismaDealRequestComplexes implements DealRequestComplexesPort {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findActive(ids: readonly string[]): Promise<DealRequestComplexRow[]>;
}
