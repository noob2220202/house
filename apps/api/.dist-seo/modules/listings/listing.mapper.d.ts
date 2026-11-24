import { type AgencyListingDetail, type AgencyListingRow, type ListingAgencyDisclosure, type ListingDetail, type ListingSummary, type PhotoUrls } from '@house/shared';
import type { ListingAgencyDetailRow, ListingAgencyRow, ListingPublicDetailRow, ListingSummaryRow } from './listing.selects';
import { type ListingMediaPort, type MediaRef } from './ports/listing-media.port';
/**
 * KST date by which the 실매물 확인 must be renewed: the 확인일 (KST) + the ad period it keeps the
 * listing up for (LISTING_AD_TTL_DAYS). Null when never verified.
 */
export declare function verificationDueAt(verifiedAt: Date | null | undefined): string | null;
interface PhotoRow {
    mediaId: string;
    caption: string | null;
    isCover: boolean;
    media: MediaRef;
}
interface AgencyLinkRow {
    agencyId: string;
    isPrimary: boolean;
    contactName: string | null;
    contactPhone: string | null;
    agency: {
        name: string;
        roadAddress: string;
        addressDetail: string | null;
        phone: string;
        registrationNumber: string;
        representativeName: string;
        status: string;
        deletedAt: Date | null;
        logo: MediaRef | null;
    };
}
/** Prisma rows → API responses with explicit field picking (PRIVATE fields only in agency views). */
export declare class ListingMapper {
    private readonly media;
    constructor(media: ListingMediaPort);
    photo(p: PhotoRow): PhotoUrls;
    /**
     * `agencyCount`: disclosable ACTIVE agencies on the listing; `emdName`: 법정동 name of
     * row.emdCode (both page-scoped lookups, ListingSummariesService / ListingRegionNamesService).
     */
    summary(row: ListingSummaryRow, agencyCount: number, emdName: string | null): ListingSummary;
    /**
     * Console list row (agency-private view): 호 and the hidden reason only for the primary agency;
     * `missingCount` is computed by the caller for drafts (null otherwise).
     */
    agencyRow(row: ListingAgencyRow, actingAgencyId: string, agencyCount: number, emdName: string | null, missingCount: number | null): AgencyListingRow;
    disclosure(a: AgencyLinkRow): ListingAgencyDisclosure;
    private detailBase;
    /** Public detail: never includes 호, hidden reason or member ids. */
    publicDetail(row: ListingPublicDetailRow, isFavorite: boolean, emdName: string | null): ListingDetail;
    /**
     * Agency view. Co-brokers get the shared ad content only: no 호, no hidden reason, no other
     * agencies' pending/ended rows or member ids — those belong to the primary agency.
     */
    agencyDetail(row: ListingAgencyDetailRow, actingAgencyId: string, emdName: string | null): AgencyListingDetail;
}
export {};
