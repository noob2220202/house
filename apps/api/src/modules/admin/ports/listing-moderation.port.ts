import { Injectable } from '@nestjs/common';
import type { PrismaTx } from '../../../prisma/prisma.service';
import { ListingsModerationService } from '../../listings/services/listings-moderation.service';

/** What the admin module needs from the listings module to moderate a listing. */
export interface ListingModerationPort {
  /**
   * Hide from the public site; recomputes the public counters. Without `tx` it runs in its own
   * transaction and invalidates the map cache; with `tx` the caller must call invalidateSearch()
   * after its transaction commits.
   */
  hide(listingId: string, reason: string, tx?: PrismaTx): Promise<void>;
  /** HIDDEN → DRAFT (the agency must publish again, re-running the 명시사항 check). */
  unhide(listingId: string): Promise<void>;
  /** Force-close (거래완료 처리) by the operator, atomically, map cache included. */
  forceClose(listingId: string, reason: string): Promise<void>;
  /** Map-tile cache invalidation, after a transaction that passed `tx` to hide() committed. */
  invalidateSearch(): Promise<void>;
}

export const LISTING_MODERATION = Symbol('ADMIN_LISTING_MODERATION');

/** Adapter over ListingsModerationService (exported by ListingsModule). */
@Injectable()
export class ListingModerationAdapter implements ListingModerationPort {
  constructor(private readonly moderation: ListingsModerationService) {}

  async hide(listingId: string, reason: string, tx?: PrismaTx): Promise<void> {
    await this.moderation.hide(listingId, reason, tx);
  }

  unhide(listingId: string): Promise<void> {
    return this.moderation.unhide(listingId);
  }

  async forceClose(listingId: string, reason: string): Promise<void> {
    await this.moderation.close(listingId, reason);
  }

  invalidateSearch(): Promise<void> {
    return this.moderation.invalidateSearch();
  }
}
