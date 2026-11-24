import { type AdminNoticeView, type NoticeAdminListQuery, type NoticeInput, type NoticeListItem, type NoticeUpdateInput, type NoticeView, type Paginated, type PaginationQuery } from '@house/shared';
import { CacheService } from '../../../common/cache/cache.service';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { PrismaService } from '../../../prisma/prisma.service';
/** 공지사항: public list/detail (published only) and back-office CRUD (soft delete). */
export declare class NoticesService {
    private readonly prisma;
    private readonly cache;
    constructor(prisma: PrismaService, cache: CacheService);
    publicList(q: PaginationQuery): Promise<Paginated<NoticeListItem>>;
    /** Published notice; `countView` is false for bots so crawlers don't inflate the counter. */
    publicDetail(id: string, countView: boolean): Promise<NoticeView>;
    adminList(q: NoticeAdminListQuery): Promise<Paginated<AdminNoticeView>>;
    adminDetail(id: string): Promise<AdminNoticeView>;
    create(dto: NoticeInput, admin: AdminPrincipal): Promise<AdminNoticeView>;
    update(id: string, dto: NoticeUpdateInput): Promise<AdminNoticeView>;
    remove(id: string): Promise<void>;
    private load;
}
