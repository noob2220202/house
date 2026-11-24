import { type AgencyListingDetail, type AgencyListingListQuery, type AgencyListingRow, type ListingContactInput, type ListingDraftInput, type ListingPhotosInput, type ListingStatusChangeInput, type ListingUpdateInput, type ListingVerificationInput, type Paginated, type PhotoUrls } from '@house/shared';
import { type Listing, type Property } from '@prisma/client';
import type { UserPrincipal } from '../../../common/auth/principal';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { ListingSearchRepository } from '../listing-search.repository';
import { ListingMapper } from '../listing.mapper';
import { type AgencyMembershipPort, type ListingActor } from '../ports/agency-membership.port';
import { type ListingMediaPort } from '../ports/listing-media.port';
import { ListingCountersService } from './listing-counters.service';
import { ListingRegionNamesService } from './listing-region-names.service';
import { ListingSummariesService } from './listing-summaries.service';
type ListingWithProperty = Listing & {
    property: Property;
};
export interface ResolvedContact {
    contactMemberId: string | null;
    contactName: string | null;
    contactPhone: string | null;
}
export declare const adExpiryFrom: (from: Date) => Date;
/**
 * Agency (중개사무소) side of listings. The primary agency owns the ad: content, photos, 실매물
 * 확인, status, publish and delete. Co-brokers (ACTIVE ListingAgency rows the primary accepted) may
 * read it and change only their own contact. Listings the caller's agency doesn't participate in
 * answer 404. Every content/status write is guarded by `listings.version` (409 on a lost race).
 */
export declare class AgencyListingsService {
    private readonly prisma;
    private readonly config;
    private readonly mapper;
    private readonly summaries;
    private readonly search;
    private readonly regionNames;
    private readonly counters;
    private readonly membership;
    private readonly media;
    constructor(prisma: PrismaService, config: AppConfig, mapper: ListingMapper, summaries: ListingSummariesService, search: ListingSearchRepository, regionNames: ListingRegionNamesService, counters: ListingCountersService, membership: AgencyMembershipPort, media: ListingMediaPort);
    /**
     * The console list: listings the acting agency participates in (ACTIVE membership; own and
     * co-brokered). Filters: statuses, deal / asset types, text (`q`, see
     * ListingSearchRepository.agencyTextMatchIds), 실매물 확인 due (same rule as the summary chip),
     * co-brokered only / primary only.
     */
    list(principal: UserPrincipal, q: AgencyListingListQuery, now?: Date): Promise<Paginated<AgencyListingRow>>;
    /** Number of missing 명시사항 per draft (shared checkPublishRequirements, as publish checks). */
    private missingCounts;
    get(principal: UserPrincipal, id: string): Promise<AgencyListingDetail>;
    create(principal: UserPrincipal, dto: ListingDraftInput): Promise<AgencyListingDetail>;
    /**
     * PATCH. Content changes are primary-only; a co-broker may send only `contact` (its own row).
     * Edits of a public listing re-run the 명시사항 check.
     */
    update(principal: UserPrincipal, id: string, dto: ListingUpdateInput): Promise<AgencyListingDetail>;
    /**
     * Soft delete (primary agency only). Hidden listings and listings with open reports are kept:
     * they are evidence for the 허위매물 신고 workflow.
     */
    remove(principal: UserPrincipal, id: string): Promise<void>;
    /**
     * DRAFT → ACTIVE after the 표시·광고 명시사항 check (primary agency only). The first publication
     * time is kept, so taking an ad down and republishing it does not bump it to the top of 최신순.
     * Every publication starts a new ad period (expiresAt).
     */
    publish(principal: UserPrincipal, id: string): Promise<AgencyListingDetail>;
    changeStatus(principal: UserPrincipal, id: string, dto: ListingStatusChangeInput): Promise<AgencyListingDetail>;
    /** 실매물 확인 (primary only). A public ad's period is extended from the 확인일. */
    addVerification(principal: UserPrincipal, id: string, dto: ListingVerificationInput): Promise<AgencyListingDetail>;
    /** Replaces the photo set in the given order (primary only); the cover defaults to the first. */
    replacePhotos(principal: UserPrincipal, id: string, dto: ListingPhotosInput): Promise<PhotoUrls[]>;
    /** The listing if the actor's agency participates (ACTIVE) in it, else 404. */
    loadForActor(id: string, actor: ListingActor, opts?: {
        primaryOnly?: boolean;
    }): Promise<ListingWithProperty>;
    detail(id: string, actor: ListingActor): Promise<AgencyListingDetail>;
    /**
     * Public contact person for the acting agency's ListingAgency row. 공인중개사법 제18조의2①: an ad
     * must not show a 중개보조원, so the contact is always the 개업공인중개사 (OWNER) or a
     * 소속공인중개사. Defaults to the acting member when licensed, else the agency's representative
     * (or no personal contact, so only the agency phone shows). An explicit member must be licensed;
     * a phone override is accepted only from a licensed acting member.
     */
    resolveContact(actor: ListingActor, input: ListingContactInput | undefined): Promise<ResolvedContact>;
    /** Recomputes counters for the listing's complex and all of its participating agencies. */
    refreshFor(tx: PrismaTx, listingId: string, complexId: string | null): Promise<void>;
    private assertEditable;
    private assertPublishable;
    /** The service region is one 시군구 (REGION_SGG_CODE); 법정동 codes elsewhere are rejected. */
    private sggCodeFor;
    /**
     * The map position must lie in the service region: within SERVICE_REGION_RADIUS_M of the
     * 시군구 centroid (regions row; the built-in 순천시 centre when that row is missing) and, when the
     * 법정동 has a centroid, within EMD_MAX_DISTANCE_M of it. Unknown centroids skip that check.
     */
    private assertInServiceRegion;
    /** Validates complex/평형 references; returns the complex's 준공년도 (search fallback). */
    private resolveComplex;
}
export {};
