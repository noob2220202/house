import { PrismaService } from '../../../prisma/prisma.service';
import { type ListingNotifierPort } from '../ports/listing-notifier.port';
import { ListingCountersService } from './listing-counters.service';
/**
 * 광고기간 만료: ACTIVE/RESERVED listings whose expiresAt has passed go back to DRAFT, so the
 * agency must re-check the property and publish again (which re-runs the 명시사항 check). Batched,
 * SKIP LOCKED and idempotent: a second run over the same state changes nothing.
 */
export declare class ListingExpiryService {
    private readonly prisma;
    private readonly counters;
    private readonly notifier;
    private readonly logger;
    constructor(prisma: PrismaService, counters: ListingCountersService, notifier: ListingNotifierPort);
    expireDue(now?: Date, batch?: number): Promise<number>;
}
