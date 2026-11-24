import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
/**
 * Personal data the home module keeps per user (관심 중개사무소, 관심 지역). Exported for the
 * withdrawal PII scrub (auth PiiScrubService), which should call `purge` inside its transaction:
 * these tables have no FK to users, so nothing cascades.
 */
export declare class HomeUserDataService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    purge(userIds: readonly string[], db?: PrismaTx): Promise<void>;
}
