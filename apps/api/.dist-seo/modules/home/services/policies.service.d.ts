import { type Paginated } from '@house/shared';
import { CacheService } from '../../../common/cache/cache.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { type PolicyAdminListQuery, type PolicyCreateInput, type PolicyUpdateInput } from '../dto';
/** GET /policies/:slug (web w-content `policyDocumentSchema`). */
export interface PolicyDocumentView {
    slug: string;
    title: string;
    version: string;
    effectiveAt: string;
    /** Plain text with light markup (the site renders it with <RichText>, never as HTML). */
    content: string;
}
/** Admin view of one policy version. */
export interface AdminPolicyView extends PolicyDocumentView {
    id: string;
    publishedAt: string | null;
    /** Published, effective and the latest of its slug: what the site shows now. */
    isCurrent: boolean;
    createdAt: string;
    updatedAt: string;
}
/**
 * Operating policy pages (허위매물 신고 정책 …), versioned like terms: the operator writes a draft,
 * publishes it (immutable from then on) and the site shows the latest published version whose
 * effectiveAt has passed; 404 until one exists ("준비 중" on the site).
 */
export declare class PoliciesService {
    private readonly prisma;
    private readonly cache;
    constructor(prisma: PrismaService, cache: CacheService);
    current(slug: string, now?: Date): Promise<PolicyDocumentView>;
    list(q: PolicyAdminListQuery): Promise<Paginated<AdminPolicyView>>;
    detail(id: string): Promise<AdminPolicyView>;
    create(dto: PolicyCreateInput): Promise<AdminPolicyView>;
    update(id: string, dto: PolicyUpdateInput): Promise<AdminPolicyView>;
    publish(id: string, now?: Date): Promise<AdminPolicyView>;
    /** Drafts only; published versions stay as the record of what was shown. */
    remove(id: string): Promise<void>;
    private currentRow;
    private currentIds;
    private toAdmin;
}
