import { type AdminLocalVideoView, type LocalVideoAdminListQuery, type LocalVideoInput, type LocalVideoListQuery, type LocalVideoUpdateInput, type LocalVideoView, type Paginated } from '@house/shared';
import { CacheService } from '../../../common/cache/cache.service';
import { PrismaService } from '../../../prisma/prisma.service';
/** 지역 영상 (YouTube): public list (published only, cached) and back-office CRUD. */
export declare class VideosService {
    private readonly prisma;
    private readonly cache;
    constructor(prisma: PrismaService, cache: CacheService);
    publicList(q: LocalVideoListQuery): Promise<Paginated<LocalVideoView>>;
    adminList(q: LocalVideoAdminListQuery): Promise<Paginated<AdminLocalVideoView>>;
    adminDetail(id: string): Promise<AdminLocalVideoView>;
    create(dto: LocalVideoInput): Promise<AdminLocalVideoView>;
    update(id: string, dto: LocalVideoUpdateInput): Promise<AdminLocalVideoView>;
    remove(id: string): Promise<void>;
    /**
     * PUT /admin/videos/order: `ids` in display order get sortOrder 1…n (as the admin app expects);
     * videos not listed keep theirs. Every id must be a live (not deleted) video.
     */
    reorder(ids: string[]): Promise<void>;
    private assertComplex;
    private load;
}
