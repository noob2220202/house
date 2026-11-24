import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import type { MemberRecipient } from '../notifications/notifications.service';
/**
 * Agency reads the deal-requests module needs beyond AgenciesService (membership + disclosure):
 * an agency's 시군구, approval of target ids, names and notification recipients. The agencies
 * module exposes no service for these yet, so this binding reads its tables read-only; swap it for
 * AgenciesService methods once they exist.
 */
export interface DealRequestAgencyDirectory {
    /** 시군구 of an APPROVED, non-deleted agency (null otherwise). */
    approvedSggCode(agencyId: string): Promise<string | null>;
    /** The subset of `ids` that are APPROVED and not deleted. */
    approvedIds(ids: readonly string[], db?: PrismaTx): Promise<Set<string>>;
    names(ids: readonly string[]): Promise<Map<string, string>>;
    /** Active users of ACTIVE memberships of the given agencies, with the agency they belong to. */
    memberRecipients(agencyIds: readonly string[], db?: PrismaTx): Promise<MemberRecipient[]>;
    /**
     * Active users of ACTIVE memberships of APPROVED agencies in `sggCode` (with their agency),
     * keyset-paginated by membership id (pass the last id back as `after`).
     */
    regionMemberBatch(sggCode: string, after: string | null, db?: PrismaTx): Promise<{
        recipients: MemberRecipient[];
        last: string | null;
    }>;
}
export declare const DEAL_REQUEST_AGENCIES: unique symbol;
export declare class PrismaDealRequestAgencyDirectory implements DealRequestAgencyDirectory {
    private readonly prisma;
    constructor(prisma: PrismaService);
    approvedSggCode(agencyId: string): Promise<string | null>;
    approvedIds(ids: readonly string[], db?: PrismaTx): Promise<Set<string>>;
    names(ids: readonly string[]): Promise<Map<string, string>>;
    memberRecipients(agencyIds: readonly string[], db?: PrismaTx): Promise<MemberRecipient[]>;
    regionMemberBatch(sggCode: string, after: string | null, db?: PrismaTx): Promise<{
        recipients: MemberRecipient[];
        last: string | null;
    }>;
}
