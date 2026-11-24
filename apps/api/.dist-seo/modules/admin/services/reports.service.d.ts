import { type AdminReportView, type Paginated, type ReportCreatedResponse, type ReportCreateInput, type ReportListQuery, type ReportResolveInput, type ReportReviewInput } from '@house/shared';
import { AuditService } from '../../../common/audit/audit.service';
import type { AdminPrincipal, UserPrincipal } from '../../../common/auth/principal';
import { DailyCapService } from '../../../common/throttle/daily-cap.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AgenciesService } from '../../agencies/services/agencies.service';
import { NotificationsService } from '../../deal-requests/notifications/notifications.service';
import { type ListingModerationPort } from '../ports/listing-moderation.port';
/**
 * 허위매물 신고: creation by logged-in users (rate limit + daily cap + one open report per
 * user and target) and the back-office workflow RECEIVED → IN_REVIEW → RESOLVED | REJECTED.
 * Resolution can hide the listing (listings module) and/or warn the agency (agencies module).
 */
export declare class ReportsService {
    private readonly prisma;
    private readonly audit;
    private readonly dailyCaps;
    private readonly agencies;
    private readonly notifications;
    private readonly moderation;
    constructor(prisma: PrismaService, audit: AuditService, dailyCaps: DailyCapService, agencies: AgenciesService, notifications: NotificationsService, moderation: ListingModerationPort);
    create(user: UserPrincipal, dto: ReportCreateInput): Promise<ReportCreatedResponse>;
    /** Users can report what they can see: public listings and approved agencies. */
    private resolveTarget;
    list(q: ReportListQuery): Promise<Paginated<AdminReportView>>;
    /**
     * Full view including the reporter's callback number. Viewing it is a 개인정보 접속기록
     * (안전성 확보조치 기준 제8조), so it writes a `report.pii-view` audit row (no PII in the row).
     */
    detail(id: string): Promise<AdminReportView>;
    /** Masked view returned by mutations (and therefore stored in their audit rows). */
    private view;
    /**
     * Retention of the reporter's contact data: once a report has been closed for
     * REPORT_CONTACT_RETENTION_DAYS, its callback number and source ip have served their purpose
     * and are erased (withdrawn reporters are scrubbed earlier by the auth module's PiiScrubService).
     * Idempotent; returns the number of reports scrubbed.
     */
    scrubExpiredContacts(now?: Date): Promise<number>;
    /** Takes the report into review and/or records an internal note. */
    review(id: string, dto: ReportReviewInput, admin: AdminPrincipal): Promise<AdminReportView>;
    resolve(id: string, dto: ReportResolveInput, admin: AdminPrincipal): Promise<AdminReportView>;
    private notify;
    private load;
}
