import { type AdminFaqView, type FaqAdminListQuery, type FaqInput, type FaqListQuery, type FaqOrderInput, type FaqUpdateInput, type FaqView, type Paginated } from '@house/shared';
import { CacheService } from '../../../common/cache/cache.service';
import { PrismaService } from '../../../prisma/prisma.service';
/** FAQ: public list (published only, cached) and back-office CRUD + ordering. */
export declare class FaqsService {
    private readonly prisma;
    private readonly cache;
    constructor(prisma: PrismaService, cache: CacheService);
    publicList(q: FaqListQuery): Promise<Paginated<FaqView>>;
    adminList(q: FaqAdminListQuery): Promise<Paginated<AdminFaqView>>;
    adminDetail(id: string): Promise<AdminFaqView>;
    create(dto: FaqInput): Promise<AdminFaqView>;
    update(id: string, dto: FaqUpdateInput): Promise<AdminFaqView>;
    remove(id: string): Promise<void>;
    /** sortOrder := position in `ids`. Every id must be a live FAQ. */
    reorder(dto: FaqOrderInput): Promise<{
        ids: string[];
    }>;
    private load;
}
