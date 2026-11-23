import { Injectable } from '@nestjs/common';
import { CacheService } from '../../../common/cache/cache.service';
import type { PrismaTx } from '../../../prisma/prisma.service';
import { LISTINGS_SEARCH_CACHE_NS } from '../../listings/constants';
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
  constructor(
    private readonly moderation: ListingsModerationService,
    private readonly cache: CacheService,
  ) {}

  async hide(listingId: string, reason: string, tx?: PrismaTx): Promise<void> {
    await this.moderation.hide(listingId, reason, tx);
  }

  unhide(listingId: string): Promise<void> {
    return this.moderation.unhide(listingId);
  }

  async forceClose(listingId: string, reason: string): Promise<void> {
    await this.moderation.close(listingId, reason);
  }

  /**
   * Same bump as ListingCountersService.invalidateSearch(), which ListingsModule does not export.
   * Map tiles also expire on their own after MAP_TILE_CACHE_TTL_SECONDS.
   */
  async invalidateSearch(): Promise<void> {
    await this.cache.bump(LISTINGS_SEARCH_CACHE_NS);
  }
}
