import type { ListingSummary } from '@house/shared';
import { Injectable } from '@nestjs/common';
import { ListingSearchRepository } from '../listing-search.repository';
import { ListingMapper } from '../listing.mapper';
import type { ListingSummaryRow } from '../listing.selects';

/** Maps LISTING_SUMMARY_SELECT rows to API summaries, adding the page-scoped co-broker counts. */
@Injectable()
export class ListingSummariesService {
  constructor(
    private readonly search: ListingSearchRepository,
    private readonly mapper: ListingMapper,
  ) {}

  async map(rows: ListingSummaryRow[]): Promise<ListingSummary[]> {
    const counts = await this.search.agencyCounts(rows.map((r) => r.id));
    return rows.map((r) => this.mapper.summary(r, counts.get(r.id) ?? 0));
  }
}
