import { type AdminTermsView, type Paginated, type TermsAdminListQuery, type TermsDocumentInput, type TermsDocumentUpdateInput, type TermsPublishInput } from '@house/shared';
import { AuditService } from '../../../common/audit/audit.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { TermsService } from '../../auth';
/**
 * Terms authoring. Documents are immutable once published: a change is a new version. Publishing a
 * required version makes every user who agreed only to older versions show up in
 * `/auth/me.pendingRequiredTerms` from its effectiveAt on (the auth module computes that from the
 * current documents, so there is no flag to flip per user).
 */
export declare class AdminTermsService {
    private readonly prisma;
    private readonly terms;
    private readonly audit;
    constructor(prisma: PrismaService, terms: TermsService, audit: AuditService);
    list(q: TermsAdminListQuery): Promise<Paginated<AdminTermsView>>;
    detail(id: string): Promise<AdminTermsView>;
    create(dto: TermsDocumentInput): Promise<AdminTermsView>;
    update(id: string, dto: TermsDocumentUpdateInput): Promise<AdminTermsView>;
    /**
     * Publishes a draft. effectiveAt must be
     *  - not in the past (a version never becomes current retroactively),
     *  - later than every published version of the same type (versions stay ordered, "current" is
     *    unambiguous), and
     *  - for a revision of an already published type, at least TERMS_NOTICE_DAYS away so users get
     *    advance notice (scheduled versions are readable before they take effect) — unless
     *    `urgent` with a reason, which the audit row records.
     */
    publish(id: string, dto: TermsPublishInput, now?: Date): Promise<AdminTermsView>;
    remove(id: string): Promise<void>;
    private view;
    private context;
    private mapDuplicate;
    /** MARKETING / LOCATION consent is optional by law/design (see OPTIONAL_ONLY_TERMS_TYPES). */
    private assertRequirable;
    private load;
    private loadDraft;
}
