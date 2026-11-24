import type { AgencyListingRow, ListingSummary } from '@house/shared';
import { ListingSearchRepository } from '../listing-search.repository';
import { ListingMapper } from '../listing.mapper';
import type { ListingAgencyRow, ListingSummaryRow } from '../listing.selects';
import { ListingRegionNamesService } from './listing-region-names.service';
/**
 * Maps LISTING_SUMMARY_SELECT rows to API summaries, adding the page-scoped co-broker counts and
 * 법정동 names.
 */
export declare class ListingSummariesService {
    private readonly search;
    private readonly mapper;
    private readonly regionNames;
    constructor(search: ListingSearchRepository, mapper: ListingMapper, regionNames: ListingRegionNamesService);
    map(rows: ListingSummaryRow[]): Promise<ListingSummary[]>;
    /** Console rows of the acting agency; `missingCounts` holds the drafts' missing 명시사항. */
    mapForAgency(rows: ListingAgencyRow[], actingAgencyId: string, missingCounts: ReadonlyMap<string, number>): Promise<AgencyListingRow[]>;
    private lookups;
}
