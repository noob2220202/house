import {
  AgencyDocumentType,
  AgencyStatus,
  AuthProvider,
  BannerSlot,
  DealRequestType,
  DealType,
  ListingStatus,
  ReportReason,
  ReportTargetType,
  UserRole,
  UserStatus,
} from '@house/shared';
import { z } from 'zod';
import { RegistryCheckStatus } from '@/features/m-moderation/api/schemas';
import { adminUserSchema } from '@/lib/auth/types';

/**
 * Response schemas of the m-core page group (login · dashboard · search · notifications · account).
 * The auth/admin controllers do not exist yet, so every shape here is an ASSUMPTION documented in
 * docs/frontend-integration/m-core.md — fix the schema and the mock fixture together.
 */

const count = z.number().int().min(0);

// ---------- auth ----------

/** POST /admin/auth/login → password accepted; the session stays unverified until the TOTP step. */
export const adminLoginResultSchema = z.object({
  /** True only when the backend skips the TOTP step (never expected in production). */
  mfaVerified: z.boolean().default(false),
  /** False → the admin must enrol an authenticator app first (POST /admin/auth/totp/setup). */
  totpEnrolled: z.boolean().default(true),
});
export type AdminLoginResult = z.infer<typeof adminLoginResultSchema>;

/** POST /admin/auth/totp/setup → a fresh secret to enrol. */
export const totpSetupSchema = z.object({
  /** Base32 secret for manual entry. */
  secret: z.string().min(16),
  /** otpauth://totp/… URI — rendered as a QR code in the browser. */
  otpauthUrl: z.string().startsWith('otpauth://'),
});
export type TotpSetup = z.infer<typeof totpSetupSchema>;

/** POST /admin/auth/totp/verify → session upgraded; recovery codes are returned once after enrolment. */
export const totpVerifyResultSchema = z
  .object({
    recoveryCodes: z.array(z.string()).optional(),
  })
  .loose();
export type TotpVerifyResult = z.infer<typeof totpVerifyResultSchema>;

/** GET /admin/auth/me with the optional security fields used by the account page. */
export const adminAccountSchema = adminUserSchema.extend({
  totpEnabled: z.boolean().default(true),
  totpEnrolledAt: z.string().nullable().optional(),
  passwordChangedAt: z.string().nullable().optional(),
  lastLoginIp: z.string().nullable().optional(),
});
export type AdminAccount = z.infer<typeof adminAccountSchema>;

// ---------- dashboard ----------

/** GET /admin/dashboard — counters for the shell (badges, bell) and the KPI row. */
export const dashboardSummarySchema = z.object({
  generatedAt: z.string(),
  badges: z
    .object({
      listingsPending: count.default(0),
      agenciesPending: count.default(0),
      dealRequestsOpen: count.default(0),
      reportsOpen: count.default(0),
    })
    .default({ listingsPending: 0, agenciesPending: 0, dealRequestsOpen: 0, reportsOpen: 0 }),
  notificationsUnread: count.default(0),
  kpis: z.object({
    visitors: z.object({ today: count, yesterday: count }),
    newListings: z.object({ today: count, yesterday: count, pendingReview: count }),
    dealRequests: z.object({ today: count, sell: count, find: count, unassigned: count }),
    pendingAgencies: z.object({
      count,
      /** Days the oldest pending application has been waiting (null when the queue is empty). */
      oldestWaitingDays: count.nullable(),
      needsDocuments: count,
    }),
  }),
  /** Social-login provider health for the sidebar status card (카카오 · 네이버 · Google only). */
  socialLogin: z
    .array(
      z.object({
        provider: z.enum(AuthProvider),
        enabled: z.boolean(),
        healthy: z.boolean(),
      }),
    )
    .default([]),
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

const trafficPointSchema = z.object({
  /** Calendar date in KST, YYYY-MM-DD. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  visitors: count,
  pageViews: count,
  signups: count.default(0),
});
export type TrafficPoint = z.infer<typeof trafficPointSchema>;

/**
 * GET /admin/stats/traffic?days=7|30|90 (통계 endpoint, shared with the stats page): daily series,
 * oldest → newest, last point = today (KST). Only the fields the dashboard needs are parsed.
 */
export const trafficStatsSchema = z.object({
  days: z.number().int(),
  points: z.array(trafficPointSchema),
  signupsByProvider: z.array(z.object({ provider: z.enum(AuthProvider), count })).default([]),
});
export type TrafficStats = z.infer<typeof trafficStatsSchema>;

/** View model of the dashboard chart: the selected period and the one right before it. */
export interface Traffic {
  points: TrafficPoint[];
  previous: TrafficPoint[];
  signups: { total: number; byProvider: { provider: AuthProvider; count: number }[] };
}

export const pendingAgencySchema = z.object({
  id: z.string(),
  name: z.string(),
  /** 읍면동 / 리 shown under the office name. */
  areaName: z.string().nullable().default(null),
  representativeName: z.string(),
  registrationNumber: z.string(),
  status: z.enum(AgencyStatus).default(AgencyStatus.PENDING),
  appliedAt: z.string(),
  documents: z.object({
    /** Required document types that were submitted. */
    submitted: count,
    required: count,
    missing: z.array(z.enum(AgencyDocumentType)).default([]),
    /** Free-text label of a missing non-enum document (e.g. 공제증서). */
    missingLabel: z.string().nullable().default(null),
  }),
  /**
   * 국가공간정보 중개업 lookup result, as on GET /admin/agencies (`registryStatus`); null = not run
   * yet. Only MATCHED (with complete documents) allows approving straight from the dashboard.
   */
  registryStatus: z.enum(RegistryCheckStatus).nullable().default(null),
});
export type PendingAgency = z.infer<typeof pendingAgencySchema>;

export const dashboardDealRequestSchema = z.object({
  id: z.string(),
  type: z.enum(DealRequestType),
  /** "신대 레이크파크 1단지 · 34평" — target complex/area + size. */
  title: z.string(),
  dealType: z.enum(DealType),
  /** 매매가 / 전세 보증금 (만원). */
  price: z.number().int().nullable().default(null),
  deposit: z.number().int().nullable().default(null),
  monthlyRent: z.number().int().nullable().default(null),
  /** Extra condition shown after the price: "103동 고층", "2027년 봄 입주". */
  note: z.string().nullable().default(null),
  createdAt: z.string(),
  /** Offices the request was delivered to (0 = waiting for assignment). */
  deliveredAgencyCount: count.default(0),
  /** Offices currently talking to the requester. */
  activeProposalCount: count.default(0),
});
export type DashboardDealRequest = z.infer<typeof dashboardDealRequestSchema>;

export const dashboardReportSchema = z.object({
  /** Id of the newest report of the target. */
  id: z.string(),
  targetType: z.enum(ReportTargetType),
  targetId: z.string(),
  reason: z.enum(ReportReason),
  /** Listing headline: "연향 센트럴 32평 매매 3억 1,000". */
  title: z.string(),
  agencyName: z.string().nullable().default(null),
  /** Open reports against the same target. */
  reportCount: count.default(1),
  lastReportedAt: z.string(),
});
export type DashboardReport = z.infer<typeof dashboardReportSchema>;

export const expiringAdSchema = z.object({
  id: z.string(),
  kind: z.enum(['BANNER', 'POPUP']).default('BANNER'),
  advertiserName: z.string(),
  slot: z.enum(BannerSlot).nullable().default(null),
  /** Position text when it differs from the slot label, e.g. "메인 와이드 배너 1/3". */
  placementLabel: z.string().nullable().default(null),
  endAt: z.string(),
  /** Click-through rate 0–1 (null when there are no impressions yet). */
  ctr: z.number().min(0).max(1).nullable().default(null),
  imageUrl: z.string().nullable().default(null),
});
export type ExpiringAd = z.infer<typeof expiringAdSchema>;

const queue = <T extends z.ZodType>(item: T) =>
  z.object({ total: count, items: z.array(item) }).default({ total: 0, items: [] });

/** GET /admin/dashboard/queues — the work queues previewed on the dashboard. */
export const dashboardQueuesSchema = z.object({
  pendingAgencies: queue(pendingAgencySchema),
  dealRequests: queue(dashboardDealRequestSchema),
  reports: z
    .object({
      total: count,
      items: z.array(dashboardReportSchema),
      handledThisWeek: count.default(0),
      /** Average hours from report to resolution this week (null = nothing handled). */
      avgHandleHours: z.number().min(0).nullable().default(null),
    })
    .default({ total: 0, items: [], handledThisWeek: 0, avgHandleHours: null }),
  expiringAds: queue(expiringAdSchema),
});
export type DashboardQueues = z.infer<typeof dashboardQueuesSchema>;

// ---------- global search ----------

export const searchListingSchema = z.object({
  id: z.string(),
  /** Human-facing listing number (매물번호) — ASSUMED field, optional until the backend has one. */
  listingNo: z.string().nullable().default(null),
  title: z.string(),
  dealType: z.enum(DealType),
  price: z.number().int().nullable().default(null),
  deposit: z.number().int().nullable().default(null),
  monthlyRent: z.number().int().nullable().default(null),
  status: z.enum(ListingStatus),
  agencyName: z.string().nullable().default(null),
  areaName: z.string().nullable().default(null),
});
export const searchAgencySchema = z.object({
  id: z.string(),
  name: z.string(),
  representativeName: z.string(),
  registrationNumber: z.string().nullable().default(null),
  status: z.enum(AgencyStatus),
  areaName: z.string().nullable().default(null),
  listingCount: count.default(0),
});
export const searchUserSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  name: z.string().nullable().default(null),
  /** Masked by the API ("ki***@kakao.com"). */
  email: z.string().nullable().default(null),
  /** Masked by the API ("010-****-5678"). */
  phone: z.string().nullable().default(null),
  role: z.enum(UserRole),
  status: z.enum(UserStatus),
  provider: z.enum(AuthProvider).nullable().default(null),
  joinedAt: z.string().nullable().default(null),
});

/** GET /admin/search?q=&limit= — grouped matches for the topbar search. */
export const adminSearchSchema = z.object({
  query: z.string(),
  listings: queue(searchListingSchema),
  agencies: queue(searchAgencySchema),
  users: queue(searchUserSchema),
});
export type AdminSearch = z.infer<typeof adminSearchSchema>;
export type SearchListing = z.infer<typeof searchListingSchema>;
export type SearchAgency = z.infer<typeof searchAgencySchema>;
export type SearchUser = z.infer<typeof searchUserSchema>;

// ---------- notifications ----------

export const ADMIN_NOTIFICATION_KINDS = [
  'AGENCY_APPLIED',
  'LISTING_REVIEW',
  'REPORT_RECEIVED',
  'DEAL_REQUEST_UNASSIGNED',
  'AD_EXPIRING',
  'SECURITY',
  'SYSTEM',
] as const;
export type AdminNotificationKind = (typeof ADMIN_NOTIFICATION_KINDS)[number];

export const adminNotificationSchema = z.object({
  id: z.string(),
  /** Unknown kinds fall back to SYSTEM so new backend kinds never break the list. */
  kind: z.enum(ADMIN_NOTIFICATION_KINDS).catch('SYSTEM'),
  title: z.string(),
  body: z.string().nullable().default(null),
  /** Back-office path to open (site-relative). */
  link: z.string().nullable().default(null),
  createdAt: z.string(),
  readAt: z.string().nullable().default(null),
});
export type AdminNotification = z.infer<typeof adminNotificationSchema>;

/** GET /admin/notifications?cursor&limit&unreadOnly — cursor feed (shared `CursorPage`). */
export const adminNotificationPageSchema = z.object({
  items: z.array(adminNotificationSchema),
  nextCursor: z.string().nullable().default(null),
  unreadCount: count.default(0),
});
export type AdminNotificationPage = z.infer<typeof adminNotificationPageSchema>;
