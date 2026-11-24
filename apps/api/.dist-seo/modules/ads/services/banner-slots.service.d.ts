import { BannerSlot, type BannerSlotUpdateInput, type BannerSlotView } from '@house/shared';
import { CacheService } from '../../../common/cache/cache.service';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { type PlacedWindow } from '../domain/slot-capacity';
import { type AdsReferencesPort } from '../ports/ads-references.port';
export interface SlotSettings {
    maxActive: number;
    isEnabled: boolean;
    note: string | null;
}
/** Slot limits: BANNER_SLOT_SPECS defaults, overridable per slot in banner_slot_configs. */
export declare class BannerSlotsService {
    private readonly prisma;
    private readonly cache;
    private readonly refs;
    constructor(prisma: PrismaService, cache: CacheService, refs: AdsReferencesPort);
    settings(slot: BannerSlot, db?: PrismaTx): Promise<SlotSettings>;
    list(now?: Date): Promise<BannerSlotView[]>;
    get(slot: BannerSlot): Promise<BannerSlotView>;
    update(slot: BannerSlot, dto: BannerSlotUpdateInput): Promise<BannerSlotView>;
    /**
     * Serializes slot writes (create/schedule changes) so two concurrent requests cannot both pass
     * the capacity check. Transaction-scoped advisory lock.
     */
    lock(tx: PrismaTx, slot: BannerSlot): Promise<void>;
    /**
     * Throws 409 BANNER_SLOT_FULL when adding `banner` would exceed the slot's simultaneous limit
     * on some page at some instant from now on. The limit applies per page context, like serving:
     * COMPLEX_FEATURED_AGENCY holds `maxActive` agencies per complex page, MAP_AD per 읍면동, and
     * an ALL banner competes everywhere. Paused, ended and deleted banners do not count.
     */
    assertCapacity(tx: PrismaTx, slot: BannerSlot, banner: PlacedWindow, opts?: {
        excludeId?: string;
        now?: Date;
    }): Promise<void>;
    private view;
}
