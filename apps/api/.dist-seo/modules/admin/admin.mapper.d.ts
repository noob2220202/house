import { type AdminAccountView, type AdminFaqView, type AdminLocalVideoView, type AdminNoticeView, type AdminReportView, type AuditLogView, type FaqView, type LocalVideoView, type NoticeListItem, type NoticeView } from '@house/shared';
import type { AdminUser, Faq, LocalVideo, Notice, Prisma } from '@prisma/client';
export declare function toAdminAccountView(a: AdminUser, now?: Date): AdminAccountView;
export declare const reportSelect: {
    id: true;
    targetType: true;
    reason: true;
    detail: true;
    status: true;
    action: true;
    resolutionNote: true;
    handledAt: true;
    reporterPhone: true;
    createdAt: true;
    updatedAt: true;
    listingId: true;
    agencyId: true;
    reporterUserId: true;
    listing: {
        select: {
            id: true;
            status: true;
            title: true;
            deletedAt: true;
            property: {
                select: {
                    roadAddress: true;
                };
            };
        };
    };
    agency: {
        select: {
            id: true;
            name: true;
            status: true;
            warningCount: true;
        };
    };
    reporter: {
        select: {
            id: true;
            nickname: true;
        };
    };
    handledBy: {
        select: {
            id: true;
            name: true;
        };
    };
};
export type ReportRow = Prisma.ReportGetPayload<{
    select: typeof reportSelect;
}>;
/** `revealContact`: full reporterPhone (audited read); masked otherwise. */
export declare function toAdminReportView(r: ReportRow, opts?: {
    revealContact?: boolean;
}): AdminReportView;
export declare function toNoticeListItem(n: Notice): NoticeListItem;
export declare function toNoticeView(n: Notice): NoticeView;
export declare function toAdminNoticeView(n: Notice): AdminNoticeView;
export declare function toFaqView(f: Faq): FaqView;
export declare function toAdminFaqView(f: Faq): AdminFaqView;
export declare function toLocalVideoView(v: LocalVideo): LocalVideoView;
export declare function toAdminLocalVideoView(v: LocalVideo): AdminLocalVideoView;
export declare const auditLogSelect: {
    id: true;
    actorType: true;
    userId: true;
    action: true;
    resourceType: true;
    resourceId: true;
    before: true;
    after: true;
    ip: true;
    userAgent: true;
    requestId: true;
    createdAt: true;
    adminUser: {
        select: {
            id: true;
            name: true;
            email: true;
        };
    };
};
export type AuditLogRow = Prisma.AuditLogGetPayload<{
    select: typeof auditLogSelect;
}>;
export declare function toAuditLogView(r: AuditLogRow): AuditLogView;
