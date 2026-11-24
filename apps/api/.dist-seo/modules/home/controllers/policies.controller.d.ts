import { type Paginated } from '@house/shared';
import { IdParamDto, PolicyAdminListQueryDto, PolicyCreateDto, PolicySlugParamDto, PolicyUpdateDto } from '../dto';
import { PoliciesService, type AdminPolicyView, type PolicyDocumentView } from '../services/policies.service';
export declare class PoliciesController {
    private readonly policies;
    constructor(policies: PoliciesService);
    /** The version in force of an operating policy page; 404 until one is published. */
    get(p: PolicySlugParamDto): Promise<PolicyDocumentView>;
}
/** 운영 정책 문서 versions (same permission as 약관): drafts editable, published immutable. */
export declare class AdminPoliciesController {
    private readonly policies;
    constructor(policies: PoliciesService);
    list(q: PolicyAdminListQueryDto): Promise<Paginated<AdminPolicyView>>;
    detail(p: IdParamDto): Promise<AdminPolicyView>;
    create(dto: PolicyCreateDto): Promise<AdminPolicyView>;
    update(p: IdParamDto, dto: PolicyUpdateDto): Promise<AdminPolicyView>;
    publish(p: IdParamDto): Promise<AdminPolicyView>;
    remove(p: IdParamDto): Promise<void>;
}
