import type { PrismaTx } from '../../../prisma/prisma.service';
import { ListingsModerationService } from '../../listings/services/listings-moderation.service';
/**
 * Listing side effects of agency changes. The listings module owns those tables and exports
 * ListingsModerationService for exactly this; the port keeps the agencies services testable.
 */
export interface AgencyListingsSync {
    /**
     * The agency's public visibility flipped (suspended / rejected / reinstated): recompute the
     * denormalized listing counters of everything its listings count towards. Call inside the
     * transaction.
     */
    agencyVisibilityChanged(tx: PrismaTx, agencyId: string): Promise<void>;
    /**
     * A member left / was removed: their name and phone must stop being advertised. Their listing
     * contacts move to the agency's 대표 (OWNER member), or are cleared if there is none.
     * Returns the number of listing links changed. Call inside the transaction.
     */
    memberDeparted(tx: PrismaTx, agencyId: string, memberId: string): Promise<number>;
    /** Drops cached listing search results / map tiles. Call after the transaction commits. */
    invalidateSearch(): Promise<void>;
}
export declare const AGENCY_LISTINGS_SYNC: unique symbol;
export declare class ModerationAgencyListingsSync implements AgencyListingsSync {
    private readonly moderation;
    constructor(moderation: ListingsModerationService);
    agencyVisibilityChanged(tx: PrismaTx, agencyId: string): Promise<void>;
    memberDeparted(tx: PrismaTx, agencyId: string, memberId: string): Promise<number>;
    invalidateSearch(): Promise<void>;
}
