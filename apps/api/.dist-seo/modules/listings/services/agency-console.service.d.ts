import { ListingStatus, type AssetType, type DealType, type Direction, type FloorClass, type Paginated } from '@house/shared';
import type { UserPrincipal } from '../../../common/auth/principal';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CoBrokerCandidatesQuery } from '../dto';
import { type AgencyMembershipPort } from '../ports/agency-membership.port';
import { type ListingMediaPort } from '../ports/listing-media.port';
/** GET /agency/listings/summary (web `agencyListingSummarySchema`). */
export interface AgencyListingSummaryView {
    total: number;
    byStatus: Record<ListingStatus, number>;
    /** 광고중/계약중 listings never verified or whose 실매물 확인 runs out within the reminder window. */
    verificationDue: number;
    /** 광고중 listings whose 광고 기간 (expiresAt) ends within the reminder window. */
    expiringSoon: number;
    /** Listings the agency advertises as a co-broker (not the primary). */
    coBrokered: number;
}
/** Row of GET /agency/listings/co-broker-candidates (web `coBrokerCandidateSchema`). */
export interface CoBrokerCandidateView {
    id: string;
    /** 매물번호 (public). */
    listingNo: string | null;
    status: ListingStatus;
    dealType: DealType;
    assetType: AssetType;
    name: string;
    dong: string | null;
    salePrice: number | null;
    deposit: number | null;
    monthlyRent: number | null;
    presalePrice: number | null;
    premium: number | null;
    exclusiveArea: number | null;
    supplyArea: number | null;
    /** null when the primary office shows 저/중/고 only (floorClass stays). */
    floor: number | null;
    totalFloors: number | null;
    floorClass: FloorClass | null;
    direction: Direction | null;
    coverPhotoUrl: string | null;
    verifiedAt: string | null;
    publishedAt: string | null;
    agencyCount: number;
    primaryAgencyName: string;
    /** The caller's agency already co-brokers it (ACTIVE). */
    joined: boolean;
}
/** Reminder window of the console chips (frontend VERIFICATION_SOON_DAYS). */
export declare const CONSOLE_REMINDER_DAYS = 7;
/**
 * A 실매물 확인 keeps an ad up for LISTING_AD_TTL_DAYS; it is "due" when that ends within
 * CONSOLE_REMINDER_DAYS (counted in KST days, like the console's D-day badge): verified before
 * the returned instant.
 */
export declare function verificationDueBefore(now: Date): Date;
/** Broker console reads that are not one listing: status counters and co-brokerage candidates. */
export declare class AgencyConsoleService {
    private readonly prisma;
    private readonly membership;
    private readonly media;
    constructor(prisma: PrismaService, membership: AgencyMembershipPort, media: ListingMediaPort);
    summary(principal: UserPrincipal, now?: Date): Promise<AgencyListingSummaryView>;
    /**
     * Public listings of OTHER offices in a 단지 that the caller's agency may ask to co-broker
     * (공동중개 신청). Public fields only: never 호, and no exact floor when the primary office
     * advertises 저/중/고.
     */
    coBrokerCandidates(principal: UserPrincipal, q: CoBrokerCandidatesQuery): Promise<Paginated<CoBrokerCandidateView>>;
    private candidate;
}
