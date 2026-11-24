"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogSelect = exports.reportSelect = void 0;
exports.toAdminAccountView = toAdminAccountView;
exports.toAdminReportView = toAdminReportView;
exports.toNoticeListItem = toNoticeListItem;
exports.toNoticeView = toNoticeView;
exports.toAdminNoticeView = toAdminNoticeView;
exports.toFaqView = toFaqView;
exports.toAdminFaqView = toAdminFaqView;
exports.toLocalVideoView = toLocalVideoView;
exports.toAdminLocalVideoView = toAdminLocalVideoView;
exports.toAuditLogView = toAuditLogView;
const shared_1 = require("@house/shared");
const iso = (d) => (d ? d.toISOString() : null);
// ---------- admin accounts ----------
function toAdminAccountView(a, now = new Date()) {
    return {
        id: a.id,
        email: a.email,
        name: a.name,
        role: a.role,
        status: a.status,
        totpEnabled: a.totpEnabledAt !== null,
        ipAllowlist: a.ipAllowlist,
        locked: a.lockedUntil !== null && a.lockedUntil.getTime() > now.getTime(),
        lastLoginAt: iso(a.lastLoginAt),
        lastLoginIp: a.lastLoginIp,
        passwordChangedAt: iso(a.passwordChangedAt),
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
    };
}
// ---------- reports ----------
exports.reportSelect = {
    id: true,
    targetType: true,
    reason: true,
    detail: true,
    status: true,
    action: true,
    resolutionNote: true,
    handledAt: true,
    reporterPhone: true,
    createdAt: true,
    updatedAt: true,
    listingId: true,
    agencyId: true,
    reporterUserId: true,
    listing: {
        select: {
            id: true,
            status: true,
            title: true,
            deletedAt: true,
            property: { select: { roadAddress: true } },
        },
    },
    agency: { select: { id: true, name: true, status: true, warningCount: true } },
    reporter: { select: { id: true, nickname: true } },
    handledBy: { select: { id: true, name: true } },
};
/** `revealContact`: full reporterPhone (audited read); masked otherwise. */
function toAdminReportView(r, opts = {}) {
    return {
        id: r.id,
        targetType: r.targetType,
        listing: r.listing
            ? {
                id: r.listing.id,
                status: r.listing.status,
                title: r.listing.title,
                roadAddress: r.listing.property.roadAddress,
            }
            : null,
        agency: r.agency,
        reporter: r.reporter,
        reporterPhone: r.reporterPhone && !opts.revealContact ? (0, shared_1.maskPhone)(r.reporterPhone) : r.reporterPhone,
        reason: r.reason,
        detail: r.detail,
        status: r.status,
        action: r.action,
        resolutionNote: r.resolutionNote,
        handledBy: r.handledBy,
        handledAt: iso(r.handledAt),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
    };
}
// ---------- content ----------
function toNoticeListItem(n) {
    return {
        id: n.id,
        title: n.title,
        isPinned: n.isPinned,
        publishedAt: iso(n.publishedAt),
        viewCount: n.viewCount,
    };
}
function toNoticeView(n) {
    return { ...toNoticeListItem(n), content: n.content };
}
function toAdminNoticeView(n) {
    return {
        ...toNoticeView(n),
        isPublished: n.isPublished,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
    };
}
function toFaqView(f) {
    return {
        id: f.id,
        category: f.category,
        question: f.question,
        answer: f.answer,
        sortOrder: f.sortOrder,
    };
}
function toAdminFaqView(f) {
    return {
        ...toFaqView(f),
        isPublished: f.isPublished,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
    };
}
function toLocalVideoView(v) {
    return {
        id: v.id,
        title: v.title,
        youtubeUrl: v.youtubeUrl,
        youtubeVideoId: v.youtubeVideoId,
        embedUrl: (0, shared_1.youtubeEmbedUrl)(v.youtubeVideoId),
        thumbnailUrl: v.thumbnailUrl,
        description: v.description,
        regionCode: v.regionCode,
        complexId: v.complexId,
        sortOrder: v.sortOrder,
        publishedAt: iso(v.publishedAt),
    };
}
function toAdminLocalVideoView(v) {
    return {
        ...toLocalVideoView(v),
        isPublished: v.isPublished,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
    };
}
// ---------- audit log ----------
exports.auditLogSelect = {
    id: true,
    actorType: true,
    userId: true,
    action: true,
    resourceType: true,
    resourceId: true,
    before: true,
    after: true,
    ip: true,
    userAgent: true,
    requestId: true,
    createdAt: true,
    adminUser: { select: { id: true, name: true, email: true } },
};
function toAuditLogView(r) {
    return {
        id: r.id,
        actorType: r.actorType,
        admin: r.adminUser,
        userId: r.userId,
        action: r.action,
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        before: r.before,
        after: r.after,
        ip: r.ip,
        userAgent: r.userAgent,
        requestId: r.requestId,
        createdAt: r.createdAt.toISOString(),
    };
}
//# sourceMappingURL=admin.mapper.js.map