import { type AgencyListingDetail, type CoBrokerJoinInput, type CoBrokerRequestResult } from '@house/shared';
import type { UserPrincipal } from '../../../common/auth/principal';
import { PrismaService } from '../../../prisma/prisma.service';
import { type AgencyMembershipPort } from '../ports/agency-membership.port';
import { type ListingNotifierPort } from '../ports/listing-notifier.port';
import { AgencyListingsService } from './agency-listings.service';
import { ListingCountersService } from './listing-counters.service';
/**
 * 공동중개 needs both sides' consent: another agency *requests* to co-broker a publicly advertised
 * listing (PENDING, no rights, not public) and the primary agency accepts or rejects it. Co-brokers
 * may leave (WITHDRAWN, may request again); the primary may remove them (REMOVED: they cannot
 * request again, but the primary can still accept them back). The primary row never changes here.
 */
export declare class CoBrokerageService {
    private readonly prisma;
    private readonly listings;
    private readonly counters;
    private readonly membership;
    private readonly notifier;
    constructor(prisma: PrismaService, listings: AgencyListingsService, counters: ListingCountersService, membership: AgencyMembershipPort, notifier: ListingNotifierPort);
    join(principal: UserPrincipal, listingId: string, dto: CoBrokerJoinInput): Promise<CoBrokerRequestResult>;
    /** The primary accepts a request (PENDING) or takes back an agency it removed (REMOVED). */
    accept(principal: UserPrincipal, listingId: string, agencyId: string): Promise<AgencyListingDetail>;
    /** The primary rejects a pending request; the requester cannot ask again on its own. */
    reject(principal: UserPrincipal, listingId: string, agencyId: string): Promise<void>;
    /** The acting agency leaves a listing it co-brokers, or cancels its pending request. */
    leave(principal: UserPrincipal, listingId: string): Promise<void>;
    /** The primary agency removes a co-broker (or drops a pending request). */
    removeAgency(principal: UserPrincipal, listingId: string, agencyId: string): Promise<void>;
    private end;
}
