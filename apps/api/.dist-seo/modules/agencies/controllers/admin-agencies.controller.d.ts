import type { AdminAgencyDetail, AdminAgencyListItem, AgencyRegistryCheck, Paginated } from '@house/shared';
import { StreamableFile } from '@nestjs/common';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { AdminAgencyDetailQueryDto, AdminAgencyListQueryDto, AgencyAdminDeleteDto, AgencyAdminDocumentParamDto, AgencyDecisionDto, AgencyLocationUpdateDto, AgencyRegistryCheckQueryDto, IdParamDto } from '../dto';
import { AgencyReviewService } from '../services/agency-review.service';
/**
 * Back-office agency review (/api/v1/admin/agencies). The admin module links here from its
 * dashboard; approval logic lives in AgencyReviewService. Decisions are audited in-transaction.
 */
export declare class AdminAgenciesController {
    private readonly review;
    constructor(review: AgencyReviewService);
    list(q: AdminAgencyListQueryDto): Promise<Paginated<AdminAgencyListItem>>;
    /** Full contacts of owner and staff; every view is recorded (`agency.pii-view`). */
    detail(p: IdParamDto, q: AdminAgencyDetailQueryDto): Promise<AdminAgencyDetail>;
    /**
     * Soft-deletes a PENDING / REJECTED application (e.g. a fake one), freeing its 등록번호 entry
     * from the queue. Audited in-transaction (`agency.delete`) with the reason.
     */
    remove(p: IdParamDto, dto: AgencyAdminDeleteDto, admin: AdminPrincipal): Promise<void>;
    decide(p: IdParamDto, dto: AgencyDecisionDto, admin: AdminPrincipal): Promise<AdminAgencyDetail>;
    /** 소재지 변경 (이전신고 확인 후). Owners of approved offices cannot edit these fields. */
    updateLocation(p: IdParamDto, dto: AgencyLocationUpdateDto): Promise<AdminAgencyDetail>;
    registryCheck(p: IdParamDto, q: AgencyRegistryCheckQueryDto): Promise<AgencyRegistryCheck>;
    /** Streams a private document (등록증 등). Never cached; every view is audited. */
    documentFile(p: AgencyAdminDocumentParamDto): Promise<StreamableFile>;
}
