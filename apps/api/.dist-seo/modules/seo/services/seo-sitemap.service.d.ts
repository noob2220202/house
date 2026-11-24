import { CacheService } from '../../../common/cache/cache.service';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import type { SeoListingStatusView, SeoSitemapKind, SeoSitemapView } from '../seo.types';
/**
 * URL inventories for the web sitemaps (every public 단지 / 매물 / 중개사무소 with its last change)
 * and the "gone" status of a listing URL that is no longer public.
 */
export declare class SeoSitemapService {
    private readonly prisma;
    private readonly cache;
    private readonly config;
    constructor(prisma: PrismaService, cache: CacheService, config: AppConfig);
    private get sggCode();
    sitemap(kind: SeoSitemapKind): Promise<SeoSitemapView>;
    private rows;
    /**
     * Whether a listing that was published is still public. Never-published drafts are unknown
     * (404). Exposes no private field: only status, asset type, 단지 and 지역 (for a redirect target).
     */
    listingStatus(id: string, now?: Date): Promise<SeoListingStatusView>;
}
