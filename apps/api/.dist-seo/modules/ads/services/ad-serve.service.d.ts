import { PopupPage, type BannerServeQuery, type PublicBannerView, type PublicPopupView } from '@house/shared';
import { CacheService } from '../../../common/cache/cache.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdsMapper } from '../ads.mapper';
import { type AdsReferencesPort } from '../ports/ads-references.port';
import { BannerSlotsService } from './banner-slots.service';
/**
 * Public read side: only live items (not paused, startAt ≤ now < endAt, not deleted), cached in
 * Redis under a version that admin writes bump. The TTL also stops at the next start/end
 * boundary so scheduled banners appear and expired ones (ENDED) disappear on time.
 */
export declare class AdServeService {
    private readonly prisma;
    private readonly cache;
    private readonly slots;
    private readonly mapper;
    private readonly refs;
    constructor(prisma: PrismaService, cache: CacheService, slots: BannerSlotsService, mapper: AdsMapper, refs: AdsReferencesPort);
    banners(q: BannerServeQuery, now?: Date): Promise<PublicBannerView[]>;
    popups(page: PopupPage, now?: Date): Promise<PublicPopupView[]>;
    /** Ids of every live banner (any slot); impressions are only counted for these. */
    liveBannerIds(now?: Date): Promise<Set<string>>;
    private computeBanners;
    private nextStart;
}
