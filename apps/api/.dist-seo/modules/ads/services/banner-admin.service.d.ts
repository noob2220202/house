import { type AdminBannerListQuery, type AdminBannerView, type BannerCreateInput, type BannerReorderInput, type BannerUpdateInput, type Paginated } from '@house/shared';
import { AuditService } from '../../../common/audit/audit.service';
import { CacheService } from '../../../common/cache/cache.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdsMapper, type AdminBannerRow } from '../ads.mapper';
import { type AdsMediaPort } from '../ports/ads-media.port';
import { type AdsReferencesPort } from '../ports/ads-references.port';
import { BannerSlotsService } from './banner-slots.service';
/** Admin CRUD, reorder and validation of banners. Every write bumps the public serve cache. */
export declare class BannerAdminService {
    private readonly prisma;
    private readonly slots;
    private readonly mapper;
    private readonly cache;
    private readonly audit;
    private readonly media;
    private readonly refs;
    constructor(prisma: PrismaService, slots: BannerSlotsService, mapper: AdsMapper, cache: CacheService, audit: AuditService, media: AdsMediaPort, refs: AdsReferencesPort);
    list(q: AdminBannerListQuery, now?: Date): Promise<Paginated<AdminBannerView>>;
    get(id: string): Promise<AdminBannerView>;
    create(dto: BannerCreateInput, adminId: string): Promise<AdminBannerView>;
    update(id: string, dto: BannerUpdateInput): Promise<AdminBannerView>;
    /**
     * Soft delete; stats rows stay for reporting. The row keeps its media FKs, so the images stay
     * "attached" for the media library; released() only restarts their grace period.
     */
    remove(id: string): Promise<void>;
    /**
     * Sets the display order of a slot: `ids` (any subset of the slot's banners) come first in the
     * given order, the slot's other not-ended banners keep their relative order after them.
     */
    reorder(dto: BannerReorderInput): Promise<{
        items: AdminBannerView[];
    }>;
    /** Existing, not-deleted banner or 404. */
    load(id: string): Promise<AdminBannerRow>;
    private applyOrder;
    /** Inside the write transaction: media rows stay locked (FOR SHARE) until commit. */
    private assertReferences;
}
