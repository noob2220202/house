import { type AdminPopupListQuery, type AdminPopupView, type Paginated, type PopupCreateInput, type PopupReorderInput, type PopupUpdateInput } from '@house/shared';
import { AuditService } from '../../../common/audit/audit.service';
import { CacheService } from '../../../common/cache/cache.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdsMapper } from '../ads.mapper';
import { type AdsMediaPort } from '../ports/ads-media.port';
/** Admin CRUD + reorder of popups. Every write bumps the public popup cache. */
export declare class PopupAdminService {
    private readonly prisma;
    private readonly mapper;
    private readonly cache;
    private readonly audit;
    private readonly media;
    constructor(prisma: PrismaService, mapper: AdsMapper, cache: CacheService, audit: AuditService, media: AdsMediaPort);
    list(q: AdminPopupListQuery, now?: Date): Promise<Paginated<AdminPopupView>>;
    get(id: string): Promise<AdminPopupView>;
    create(dto: PopupCreateInput, adminId: string): Promise<AdminPopupView>;
    update(id: string, dto: PopupUpdateInput): Promise<AdminPopupView>;
    remove(id: string): Promise<void>;
    /** `ids` first in the given order; other not-ended popups keep their relative order after them. */
    reorder(dto: PopupReorderInput): Promise<{
        items: AdminPopupView[];
    }>;
    private load;
}
