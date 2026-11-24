import type { ListingSummary } from '@house/shared';
import { Injectable } from '@nestjs/common';
import { ListingSearchRepository } from '../listing-search.repository';
import { ListingMapper } from '../listing.mapper';
import type { ListingSummaryRow } from '../listing.selects';
import { ListingRegionNamesService } from './listing-region-names.service';

/**
 * Maps LISTING_SUMMARY_SELECT rows to API summaries, adding the page-scoped co-broker counts and
 * 법정동 names.
 */
@Injectable()
export class ListingSummariesService {
  constructor(
    private readonly search: ListingSearchRepository,
    private readonly mapper: ListingMapper,
    private readonly regionNames: ListingRegionNamesService,
  ) {}

  async map(rows: ListingSummaryRow[]): Promise<ListingSummary[]> {
    const [counts, names] = await Promise.all([
      this.search.agencyCounts(rows.map((r) => r.id)),
      this.regionNames.namesOf(rows.map((r) => r.emdCode)),
    ]);
    return rows.map((r) =>
      this.mapper.summary(r, counts.get(r.id) ?? 0, (r.emdCode && names.get(r.emdCode)) ?? null),
    );
  }
}
