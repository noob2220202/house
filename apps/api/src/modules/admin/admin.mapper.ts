import {
  type AdminAccountView,
  type AdminFaqView,
  type AdminLocalVideoView,
  type AdminNoticeView,
  type AdminReportView,
  type AuditLogView,
  type FaqView,
  type LocalVideoView,
  maskPhone,
  type NoticeListItem,
  type NoticeView,
  youtubeEmbedUrl,
} from '@house/shared';
import type { AdminUser, Faq, LocalVideo, Notice, Prisma } from '@prisma/client';

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

// ---------- admin accounts ----------

export function toAdminAccountView(a: AdminUser, now: Date = new Date()): AdminAccountView {
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

export const reportSelect = {
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
} satisfies Prisma.ReportSelect;
export type ReportRow = Prisma.ReportGetPayload<{ select: typeof reportSelect }>;

/** `revealContact`: full reporterPhone (audited read); masked otherwise. */
export function toAdminReportView(
  r: ReportRow,
  opts: { revealContact?: boolean } = {},
): AdminReportView {
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
    reporterPhone:
      r.reporterPhone && !opts.revealContact ? maskPhone(r.reporterPhone) : r.reporterPhone,
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

export function toNoticeListItem(n: Notice): NoticeListItem {
  return {
    id: n.id,
    title: n.title,
    isPinned: n.isPinned,
    publishedAt: iso(n.publishedAt),
    viewCount: n.viewCount,
  };
}

export function toNoticeView(n: Notice): NoticeView {
  return { ...toNoticeListItem(n), content: n.content };
}

export function toAdminNoticeView(n: Notice): AdminNoticeView {
  return {
    ...toNoticeView(n),
    isPublished: n.isPublished,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}

export function toFaqView(f: Faq): FaqView {
  return {
    id: f.id,
    category: f.category,
    question: f.question,
    answer: f.answer,
    sortOrder: f.sortOrder,
  };
}

export function toAdminFaqView(f: Faq): AdminFaqView {
  return {
    ...toFaqView(f),
    isPublished: f.isPublished,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  };
}

export function toLocalVideoView(v: LocalVideo): LocalVideoView {
  return {
    id: v.id,
    title: v.title,
    youtubeUrl: v.youtubeUrl,
    youtubeVideoId: v.youtubeVideoId,
    embedUrl: youtubeEmbedUrl(v.youtubeVideoId),
    thumbnailUrl: v.thumbnailUrl,
    description: v.description,
    regionCode: v.regionCode,
    complexId: v.complexId,
    sortOrder: v.sortOrder,
    publishedAt: iso(v.publishedAt),
  };
}

export function toAdminLocalVideoView(v: LocalVideo): AdminLocalVideoView {
  return {
    ...toLocalVideoView(v),
    isPublished: v.isPublished,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}

// ---------- audit log ----------

export const auditLogSelect = {
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
} satisfies Prisma.AuditLogSelect;
export type AuditLogRow = Prisma.AuditLogGetPayload<{ select: typeof auditLogSelect }>;

export function toAuditLogView(r: AuditLogRow): AuditLogView {
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
