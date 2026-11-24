import { type AdminDealRequestView, type AgencyDealRequestView, type AgencyDisclosure, type AgencyProposalView, type DealRequestBaseView, type MyDealRequestView, type NotificationView, type ProposalView } from '@house/shared';
import type { DealRequestAdminRow, DealRequestAgencyRow, DealRequestBaseRow, DealRequestContactRow, DealRequestOwnerRow, NotificationRow, ProposalAgencyRow, ProposalOwnerRow } from './deal-request.selects';
import { type DealRequestMediaPort } from './ports/media.port';
/**
 * The admin moderation view: shared `AdminDealRequestView` + the spam flag (admin m-moderation
 * `adminDealRequestDetailSchema`). No automatic abuse signals exist yet, so `spamSignalCount` is 0
 * and `spamSignals` is empty. Local until shared has it.
 */
export interface AdminDealRequestModerationView extends AdminDealRequestView {
    spamFlaggedAt: string | null;
    spamReason: string | null;
    spamSignalCount: number;
    spamSignals: string[];
}
/** "홍길동" → "홍*동", "홍길" → "홍*"; empty (scrubbed) stays empty. */
export declare function maskName(name: string): string;
/**
 * Row → response mapping with explicit field picking per audience. Contact and 동·호 appear only
 * in the owner view, and in the agency view when `contact` was loaded for an active grant.
 */
export declare class DealRequestMapper {
    private readonly media;
    constructor(media: DealRequestMediaPort);
    base(r: DealRequestBaseRow): DealRequestBaseView;
    owner(r: DealRequestOwnerRow): MyDealRequestView;
    /** `contact` must only be passed when the agency holds an active grant (see canSeeContact). */
    agency(r: DealRequestAgencyRow, contact: DealRequestContactRow | null): AgencyDealRequestView;
    admin(r: DealRequestAdminRow): AdminDealRequestModerationView;
    proposalForOwner(p: ProposalOwnerRow, agency: AgencyDisclosure | null, contactShared: boolean): ProposalView;
    proposalForAgency(p: ProposalAgencyRow): AgencyProposalView;
    notification(n: NotificationRow): NotificationView;
}
/** Contact is visible to an agency with an active grant while the request is live or completed. */
export declare function canSeeContact(r: Pick<DealRequestAgencyRow, 'status' | 'contactScrubbedAt' | 'contactGrants'>): boolean;
