import { type ComplexListingCounts, type ComplexListingsSummary } from '@house/shared';
import { PrismaService } from '../../../prisma/prisma.service';
/** Read-only aggregates over publicly visible listings for 단지 pages (listings module owns writes). */
export declare class ComplexListingsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    /** Active (광고중/계약중) listing count, price range and 월세 range per deal type. */
    summary(complexId: string): Promise<ComplexListingsSummary>;
    /** Per-deal-type active listing counts for many complexes in one query (no N+1). */
    countsFor(complexIds: readonly string[]): Promise<Map<string, ComplexListingCounts>>;
}
