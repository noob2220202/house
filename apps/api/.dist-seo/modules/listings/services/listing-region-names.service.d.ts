import { PrismaService } from '../../../prisma/prisma.service';
/** 법정동 names of listings (ListingSummary.emdName) from the regions table, one query per page. */
export declare class ListingRegionNamesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    /** emdCode → display name for every code that resolves (codes without a region are left out). */
    namesOf(emdCodes: readonly (string | null)[]): Promise<Map<string, string>>;
    nameOf(emdCode: string | null): Promise<string | null>;
}
