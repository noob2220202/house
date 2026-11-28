import {
  type AgencyDocumentType,
  type AgencyStatus,
  type AssetType,
  type AuthProvider,
  type BannerSlot,
  cursorQuerySchema,
  type DealRequestType,
  type DealType,
  type ListingStatus,
  queryBoolean,
  type ReportReason,
  type ReportTargetType,
  type UserRole,
  type UserStatus,
} from '@house/shared';
import { z } from 'zod';

/**
 * Module-local contracts of the back-office endpoints added for the admin app (WI-10):
 * dashboard queues, global search, the notification bell, statistics and social-login status.
 * They mirror the admin app's zod schemas (`apps/admin/src/features/{m-core,m-content}/api/
 * schemas.ts`) field by field. TODO(shared): promote to `packages/shared/src/schemas/admin.ts`.
 */

// ---------- notifications ----------

export const ADMIN_NOTIFICATION_KINDS = [
  'AGENCY_APPLIED',
  'AGENCY_SITE_REQUEST',
  'LISTING_REVIEW',
  'REPORT_RECEIVED',
  'DEAL_REQUEST_UNASSIGNED',
  'AD_EXPIRING',
  'SECURITY',
  'SYSTEM',
] as const;
export type AdminNotificationKind = (typeof ADMIN_NOTIFICATION_KINDS)[number];

/** GET /admin/notifications?cursor&limit&unreadOnly */
export const adminNotificationListQuerySchema = cursorQuerySchema.extend({
  unreadOnly: queryBoolean,
});
export type AdminNotificationListQuery = z.infer<typeof adminNotificationListQuerySchema>;

export interface AdminNotificationView {
  id: string;
  kind: AdminNotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface AdminNotificationPage {
  items: AdminNotificationView[];
  nextCursor: string | null;
  unreadCount: number;
}

// ---------- search ----------

export const ADMIN_SEARCH_MIN_LENGTH = 2;
export const ADMIN_SEARCH_DEFAULT_LIMIT = 8;
export const ADMIN_SEARCH_MAX_LIMIT = 20;

const SEARCH_TOO_SHORT = '검색어를 2자 이상 입력해 주세요.';

/** Case, spaces and hyphens do not matter (same normalisation as the admin list pages). */
export function normalizeSearch(q: string): string {
  return q.toLowerCase().replace(/[\s-]/g, '');
}

/** GET /admin/search?q=&limit= — `q` must have ≥ 2 characters besides spaces and hyphens. */
export const adminSearchQuerySchema = z.object({
  q: z
    .string({ error: SEARCH_TOO_SHORT })
    .trim()
    .max(100, '검색어는 100자 이하로 입력해 주세요.')
    .refine((q) => normalizeSearch(q).length >= ADMIN_SEARCH_MIN_LENGTH, SEARCH_TOO_SHORT),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(ADMIN_SEARCH_MAX_LIMIT)
    .default(ADMIN_SEARCH_DEFAULT_LIMIT),
});
export type AdminSearchQuery = z.infer<typeof adminSearchQuerySchema>;

export interface AdminSearchGroup<T> {
  total: number;
  items: T[];
}

export interface AdminSearchListing {
  id: string;
  listingNo: string | null;
  title: string;
  dealType: DealType;
  price: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  status: ListingStatus;
  agencyName: string | null;
  areaName: string | null;
}

export interface AdminSearchAgency {
  id: string;
  name: string;
  representativeName: string;
  registrationNumber: string | null;
  status: AgencyStatus;
  areaName: string | null;
  listingCount: number;
}

export interface AdminSearchUser {
  id: string;
  nickname: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  provider: AuthProvider | null;
  joinedAt: string | null;
}

export interface AdminSearchResult {
  query: string;
  listings: AdminSearchGroup<AdminSearchListing>;
  agencies: AdminSearchGroup<AdminSearchAgency>;
  users: AdminSearchGroup<AdminSearchUser>;
}

// ---------- dashboard queues ----------

export interface DashboardPendingAgency {
  id: string;
  name: string;
  areaName: string | null;
  representativeName: string;
  registrationNumber: string;
  status: AgencyStatus;
  appliedAt: string;
  documents: {
    submitted: number;
    required: number;
    missing: AgencyDocumentType[];
    missingLabel: string | null;
  };
  /** Registry lookups are run from the agency detail page; not known to the queue. */
  registryStatus: null;
}

export interface DashboardDealRequest {
  id: string;
  type: DealRequestType;
  title: string;
  dealType: DealType;
  price: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  note: string | null;
  createdAt: string;
  deliveredAgencyCount: number;
  activeProposalCount: number;
}

export interface DashboardReport {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  title: string;
  agencyName: string | null;
  reportCount: number;
  lastReportedAt: string;
}

export interface DashboardExpiringAd {
  id: string;
  kind: 'BANNER' | 'POPUP';
  advertiserName: string;
  slot: BannerSlot | null;
  placementLabel: string | null;
  endAt: string;
  ctr: number | null;
  imageUrl: string | null;
}

/** A 사무소 홈페이지 request waiting for approval (oldest first). */
export interface DashboardPendingAgencySite {
  agencyId: string;
  agencyName: string;
  requestedSlug: string;
  requestedAt: string;
}

export interface DashboardQueues {
  pendingAgencies: AdminSearchGroup<DashboardPendingAgency>;
  pendingAgencySites: AdminSearchGroup<DashboardPendingAgencySite>;
  dealRequests: AdminSearchGroup<DashboardDealRequest>;
  reports: AdminSearchGroup<DashboardReport> & {
    handledThisWeek: number;
    avgHandleHours: number | null;
  };
  expiringAds: AdminSearchGroup<DashboardExpiringAd>;
}

// ---------- stats ----------

export const STATS_DAYS = [7, 30, 90] as const;
export type StatsDays = (typeof STATS_DAYS)[number];

/** GET /admin/stats/:section?days=7|30|90 (default 30). */
export const statsQuerySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .refine(
      (d): d is StatsDays => (STATS_DAYS as readonly number[]).includes(d),
      '조회 기간은 7, 30, 90일 중에서 고를 수 있습니다.',
    )
    .default(30),
});
export type StatsQuery = { days: StatsDays };

export const STATS_SECTIONS = ['traffic', 'listings', 'deal-requests', 'ads'] as const;
export type StatsSection = (typeof STATS_SECTIONS)[number];
export const statsSectionParamSchema = z.object({
  section: z.enum(STATS_SECTIONS, { error: '알 수 없는 통계 항목입니다.' }),
});

export interface TrafficStats {
  days: number;
  points: { date: string; visitors: number; pageViews: number; signups: number }[];
  previous: { visitors: number; pageViews: number; signups: number };
  devices: { mobile: number; desktop: number };
  signupsByProvider: { provider: AuthProvider; count: number }[];
  topPages: { path: string; label: string; pageViews: number }[];
}

export interface ListingStats {
  days: number;
  points: { date: string; created: number; closed: number }[];
  previous: { created: number; closed: number };
  activeTotal: number;
  byAssetType: { assetType: AssetType; count: number }[];
  byDealType: { dealType: DealType; count: number }[];
  topComplexes: { id: string; name: string; views: number; listings: number }[];
}

export interface DealRequestStats {
  days: number;
  points: { date: string; sell: number; find: number; proposals: number }[];
  previous: { sell: number; find: number; proposals: number };
  responseRate: number | null;
  avgFirstResponseMinutes: number | null;
  byRegion: { name: string; count: number }[];
}

export interface AdStats {
  days: number;
  points: { date: string; impressions: number; clicks: number }[];
  previous: { impressions: number; clicks: number };
  activeBanners: number;
  bySlot: { slot: string; label: string; impressions: number; clicks: number }[];
}

// ---------- social login ----------

export interface SocialLoginProviderStatus {
  provider: AuthProvider;
  enabled: boolean;
  healthy: boolean;
  clientIdMasked: string | null;
  callbackUrl: string;
  lastSuccessAt: string | null;
  last24h: { success: number; failure: number };
  userShare: number | null;
  message: string | null;
}

export interface SocialLoginStatus {
  items: SocialLoginProviderStatus[];
}
