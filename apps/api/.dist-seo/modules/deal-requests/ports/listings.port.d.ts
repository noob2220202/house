import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
/**
 * Listing reads for proposals. ListingsModule exposes no reader for "listings this agency may
 * advertise", so this binding reads the listing tables read-only; swap it once one exists.
 */
export interface DealRequestListingsPort {
    /** The subset of `ids` that are ACTIVE listings the agency actively (co-)brokers. */
    proposableIds(agencyId: string, ids: readonly string[], db?: PrismaTx): Promise<Set<string>>;
}
export declare const DEAL_REQUEST_LISTINGS: unique symbol;
export declare class PrismaDealRequestListings implements DealRequestListingsPort {
    private readonly prisma;
    constructor(prisma: PrismaService);
    proposableIds(agencyId: string, ids: readonly string[], db?: PrismaTx): Promise<Set<string>>;
}
