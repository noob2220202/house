import type { AdminTermsView, Paginated } from '@house/shared';
import { IdParamDto, TermsAdminListQueryDto, TermsInputDto, TermsPublishDto, TermsUpdateDto } from '../dto';
import { AdminTermsService } from '../services/admin-terms.service';
/** 약관 versions: drafts are editable, published versions are immutable. */
export declare class AdminTermsController {
    private readonly terms;
    constructor(terms: AdminTermsService);
    list(q: TermsAdminListQueryDto): Promise<Paginated<AdminTermsView>>;
    detail(p: IdParamDto): Promise<AdminTermsView>;
    create(dto: TermsInputDto): Promise<AdminTermsView>;
    update(p: IdParamDto, dto: TermsUpdateDto): Promise<AdminTermsView>;
    /** Audited inside the publish transaction (records an `urgent` override and its reason). */
    publish(p: IdParamDto, dto: TermsPublishDto): Promise<AdminTermsView>;
    remove(p: IdParamDto): Promise<void>;
}
