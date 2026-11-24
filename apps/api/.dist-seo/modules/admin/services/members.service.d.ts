import { type MemberDetail, type MemberListItem, type MemberListQuery, type MemberSuspendInput, type Paginated } from '@house/shared';
import { AuditService } from '../../../common/audit/audit.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SessionService } from '../../auth';
/** Member (site user) search, detail and suspension. */
export declare class MembersService {
    private readonly prisma;
    private readonly sessions;
    private readonly audit;
    constructor(prisma: PrismaService, sessions: SessionService, audit: AuditService);
    list(q: MemberListQuery): Promise<Paginated<MemberListItem>>;
    /**
     * Full member record, contacts unmasked. Viewing it is a 개인정보 접속기록 (안전성 확보조치 기준
     * 제8조: who, when, whose data, what), so it writes a `member.pii-view` audit row. The row names
     * the fields shown, never their values.
     */
    detail(id: string): Promise<MemberDetail>;
    private build;
    /** ACTIVE → SUSPENDED and logout everywhere (OAuth login is refused while suspended). */
    suspend(id: string, dto: MemberSuspendInput): Promise<MemberDetail>;
    unsuspend(id: string): Promise<MemberDetail>;
    /** Mutation responses mask contacts like the list does (the full record is GET /:id). */
    private maskedDetail;
    /**
     * Status change + audit row in one transaction. The audit snapshots are a minimal projection
     * (no name, email, phone or withdrawal reason): audit_logs is append-only and never scrubbed.
     */
    private transition;
}
