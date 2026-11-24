import { ListingStatus } from '@house/shared';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { AgencyListingsService } from './agency-listings.service';
import { ListingCountersService } from './listing-counters.service';
/**
 * Admin-side moderation hooks (exported for the admin / reports modules, which own the routes
 * and the audit log). With `tx` the change joins the caller's transaction and the caller must call
 * ListingCountersService.invalidateSearch() after it commits.
 */
export declare class ListingsModerationService {
    private readonly prisma;
    private readonly listings;
    private readonly counters;
    constructor(prisma: PrismaService, listings: AgencyListingsService, counters: ListingCountersService);
    /** Hides a listing from the public site (e.g. 허위매물 신고 처리). Returns the previous status. */
    hide(listingId: string, reason: string, tx?: PrismaTx): Promise<ListingStatus>;
    /** Operator force-close (거래완료 처리). Returns the previous status. */
    close(listingId: string, reason: string, tx?: PrismaTx): Promise<ListingStatus>;
    /** Un-hides to DRAFT: the agency must publish again, which re-runs the 명시사항 check. */
    unhide(listingId: string, tx?: PrismaTx): Promise<void>;
    /**
     * Call when an agency stops being disclosable (suspended, rejected, soft-deleted) or becomes
     * approved again. Public queries already filter on the primary agency's status; this recomputes
     * the denormalized counters of everything the agency touches. Returns the affected listing count.
     */
    onAgencyStatusChanged(agencyId: string, tx?: PrismaTx): Promise<number>;
    /**
     * A broker left / was removed from an agency: their name and phone must stop being advertised.
     * Their listing contacts move to the agency's 대표 (active OWNER member) or are cleared if there
     * is none. Call inside the caller's transaction; returns the number of listing links changed.
     */
    memberDeparted(tx: PrismaTx, agencyId: string, memberId: string): Promise<number>;
    /**
     * Reads the listing's status under a row lock. Under READ COMMITTED a FOR UPDATE that had to
     * wait returns the row as the other transaction committed it, so the status that decides
     * whether counters need a refresh is the one this transaction actually replaces.
     */
    private lockCurrent;
    /** Map-tile / search cache invalidation; call after a transaction that passed `tx` commits. */
    invalidateSearch(): Promise<void>;
}
