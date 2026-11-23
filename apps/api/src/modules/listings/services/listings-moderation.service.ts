import { ErrorCode, ListingStatus, PUBLIC_LISTING_STATUSES } from '@house/shared';
import { Injectable } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { AgencyListingsService } from './agency-listings.service';
import { ListingCountersService } from './listing-counters.service';

/**
 * Admin-side moderation hooks (exported for the admin / reports modules, which own the routes
 * and the audit log). With `tx` the change joins the caller's transaction and the caller must call
 * ListingCountersService.invalidateSearch() after it commits.
 */
@Injectable()
export class ListingsModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listings: AgencyListingsService,
    private readonly counters: ListingCountersService,
  ) {}

  /** Hides a listing from the public site (e.g. 허위매물 신고 처리). Returns the previous status. */
  async hide(listingId: string, reason: string, tx?: PrismaTx): Promise<ListingStatus> {
    const run = async (db: PrismaTx): Promise<ListingStatus> => {
      const current = await db.listing.findFirst({
        where: { id: listingId, deletedAt: null },
        select: { status: true, complexId: true },
      });
      if (!current) throw AppException.notFound(ErrorCode.LISTING_NOT_FOUND);
      await db.listing.update({
        where: { id: listingId },
        data: {
          status: ListingStatus.HIDDEN,
          hiddenReason: reason.slice(0, 500),
          version: { increment: 1 },
        },
      });
      if (PUBLIC_LISTING_STATUSES.includes(current.status)) {
        await this.listings.refreshFor(db, listingId, current.complexId);
      }
      return current.status;
    };
    const previous = tx ? await run(tx) : await this.prisma.$transaction(run);
    if (!tx) await this.counters.invalidateSearch();
    return previous;
  }

  /** Operator force-close (거래완료 처리). Returns the previous status. */
  async close(listingId: string, reason: string, tx?: PrismaTx): Promise<ListingStatus> {
    const run = async (db: PrismaTx): Promise<ListingStatus> => {
      const current = await db.listing.findFirst({
        where: { id: listingId, deletedAt: null },
        select: { status: true, complexId: true },
      });
      if (!current) throw AppException.notFound(ErrorCode.LISTING_NOT_FOUND);
      await db.listing.update({
        where: { id: listingId },
        data: {
          status: ListingStatus.CLOSED,
          closedAt: new Date(),
          hiddenReason: reason.slice(0, 500),
          version: { increment: 1 },
        },
      });
      if (PUBLIC_LISTING_STATUSES.includes(current.status)) {
        await this.listings.refreshFor(db, listingId, current.complexId);
      }
      return current.status;
    };
    const previous = tx ? await run(tx) : await this.prisma.$transaction(run);
    if (!tx) await this.counters.invalidateSearch();
    return previous;
  }

  /** Un-hides to DRAFT: the agency must publish again, which re-runs the 명시사항 check. */
  async unhide(listingId: string, tx?: PrismaTx): Promise<void> {
    const run = async (db: PrismaTx): Promise<void> => {
      const { count } = await db.listing.updateMany({
        where: { id: listingId, deletedAt: null, status: ListingStatus.HIDDEN },
        data: { status: ListingStatus.DRAFT, hiddenReason: null, version: { increment: 1 } },
      });
      if (count === 0) throw AppException.notFound(ErrorCode.LISTING_NOT_FOUND);
    };
    if (tx) await run(tx);
    else await this.prisma.$transaction(run);
  }

  /**
   * Call when an agency stops being disclosable (suspended, rejected, soft-deleted) or becomes
   * approved again. Public queries already filter on the primary agency's status; this recomputes
   * the denormalized counters of everything the agency touches. Returns the affected listing count.
   */
  async onAgencyStatusChanged(agencyId: string, tx?: PrismaTx): Promise<number> {
    const run = async (db: PrismaTx): Promise<number> => {
      const listings = await db.listing.findMany({
        where: {
          deletedAt: null,
          status: { in: [...PUBLIC_LISTING_STATUSES] },
          agencies: { some: { agencyId } },
        },
        select: { id: true, complexId: true, agencies: { select: { agencyId: true } } },
      });
      await this.counters.refresh(db, {
        complexIds: listings.map((l) => l.complexId),
        agencyIds: [agencyId, ...listings.flatMap((l) => l.agencies.map((a) => a.agencyId))],
      });
      return listings.length;
    };
    const n = tx ? await run(tx) : await this.prisma.$transaction(run);
    if (!tx) await this.counters.invalidateSearch();
    return n;
  }
}
