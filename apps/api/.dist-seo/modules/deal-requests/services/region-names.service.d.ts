import { PrismaService } from '../../../prisma/prisma.service';
/** 법정동 display names from the `regions` table (one query per call). */
export declare class RegionNamesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    /** code → name for every code that resolves (unknown codes are left out). */
    namesOf(codes: readonly (string | null | undefined)[]): Promise<Map<string, string>>;
}
