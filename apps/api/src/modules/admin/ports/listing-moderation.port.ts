import { ListingStatus } from '@house/shared';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ListingsModerationService } from '../../listings/services/listings-moderation.service';

/** What the admin module needs from the listings module to moderate a listing. */
export interface ListingModerationPort {
  /** Hide from the public site; maintains counters and map caches. */
  hide(listingId: string, reason: string): Promise<void>;
  /** HIDDEN → DRAFT (the agency must publish again, re-running the 명시사항 check). */
  unhide(listingId: string): Promise<void>;
  /** Force-close (거래완료 처리) by the operator. */
  forceClose(listingId: string, reason: string): Promise<void>;
}

export const LISTING_MODERATION = Symbol('ADMIN_LISTING_MODERATION');

/**
 * Adapter over ListingsModerationService (exported by ListingsModule).
 * forceClose: the listings module has no close hook yet, so it hides first (which recomputes the
 * public counters and bumps the map cache) and then moves HIDDEN → CLOSED; both are non-public
 * states, so no counter changes in the second step. If the second step fails the listing stays
 * hidden — the safe side. Replace with a dedicated ListingsModerationService.close() when it exists.
 */
@Injectable()
export class ListingModerationAdapter implements ListingModerationPort {
  constructor(
    private readonly moderation: ListingsModerationService,
    private readonly prisma: PrismaService,
  ) {}

  async hide(listingId: string, reason: string): Promise<void> {
    await this.moderation.hide(listingId, reason);
  }

  unhide(listingId: string): Promise<void> {
    return this.moderation.unhide(listingId);
  }

  async forceClose(listingId: string, reason: string): Promise<void> {
    await this.moderation.hide(listingId, reason);
    await this.prisma.listing.updateMany({
      where: { id: listingId, deletedAt: null, status: ListingStatus.HIDDEN },
      data: { status: ListingStatus.CLOSED, closedAt: new Date() },
    });
  }
}
