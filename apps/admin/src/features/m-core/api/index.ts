import type { AdminLoginInput, AgencyStatus } from '@house/shared';
import { api, qk } from '@/lib/api';
import { splitTraffic } from '../lib/dashboard';
import {
  factorBody,
  reauthBody,
  type AdminPasswordChangeInput,
  type SecondFactor,
  type TotpReauth,
} from '../lib/otp';
import {
  adminAccountSchema,
  adminLoginResultSchema,
  adminSessionResultSchema,
  adminNotificationPageSchema,
  adminSearchSchema,
  dashboardQueuesSchema,
  dashboardSummarySchema,
  totpActivateResultSchema,
  totpSetupSchema,
  trafficStatsSchema,
} from './schemas';

export * from './schemas';

/** Query keys of the m-core group: [resource, scope, params]. */
export const coreKeys = {
  summary: () => qk('admin-dashboard', 'summary'),
  traffic: (days: number) => qk('admin-dashboard', 'traffic', { days }),
  queues: () => qk('admin-dashboard', 'queues'),
  search: (q: string) => qk('admin-search', 'all', { q }),
  searchSuggest: (q: string) => qk('admin-search', 'suggest', { q }),
  notifications: (unreadOnly: boolean) => qk('admin-notifications', 'feed', { unreadOnly }),
  account: () => qk('admin-account', 'me'),
} as const;

/** The dashboard refreshes itself every 5 minutes ("5분마다 갱신"). */
export const DASHBOARD_REFRESH_MS = 5 * 60_000;

export type TrafficRange = 7 | 30;

// ---------- auth ----------

export const loginWithPassword = (input: AdminLoginInput) =>
  api.post('/admin/auth/login', input, { schema: adminLoginResultSchema });

/**
 * POST /admin/auth/totp/setup. First enrolment (pre-MFA session): no body. Re-enrolment from a
 * verified session: the current password plus the current TOTP code or a recovery code
 * (otherwise 403 `AUTH_REAUTH_REQUIRED`).
 */
export const startTotpSetup = (reauth?: TotpReauth) =>
  api.post('/admin/auth/totp/setup', reauth ? reauthBody(reauth) : undefined, {
    schema: totpSetupSchema,
  });

/** POST /admin/auth/totp/activate { code } — confirms the pending secret of `startTotpSetup`. */
export const activateTotp = (code: string) =>
  api.post('/admin/auth/totp/activate', { code }, { schema: totpActivateResultSchema });

/** POST /admin/auth/totp/verify — second factor of an enrolled admin: a TOTP or a recovery code. */
export const verifyTotp = (factor: SecondFactor) =>
  api.post('/admin/auth/totp/verify', factorBody(factor), { schema: adminSessionResultSchema });

export const fetchAccount = (signal?: AbortSignal) =>
  api.get('/admin/auth/me', { schema: adminAccountSchema, signal });

/** POST /admin/auth/password — rotates the session (other sessions end) and returns its token. */
export const changePassword = (input: AdminPasswordChangeInput) =>
  api.post('/admin/auth/password', input, { schema: adminSessionResultSchema });

// ---------- dashboard ----------

export const fetchDashboardSummary = (signal?: AbortSignal) =>
  api.get('/admin/dashboard', { schema: dashboardSummarySchema, signal });

/** Days to request from the stats endpoint so the comparison period is included (7 → 30, 30 → 90). */
export const TRAFFIC_FETCH_DAYS: Record<TrafficRange, number> = { 7: 30, 30: 90 };

/**
 * Visitor trend for the dashboard chart, from the stats endpoint GET /admin/stats/traffic. The
 * endpoint only returns totals for the previous period, so a longer window is requested and split
 * into the selected period + the one before it (for the dashed comparison line).
 */
export const fetchTraffic = async (days: TrafficRange, signal?: AbortSignal) =>
  splitTraffic(
    await api.get('/admin/stats/traffic', {
      query: { days: TRAFFIC_FETCH_DAYS[days] },
      schema: trafficStatsSchema,
      signal,
    }),
    days,
  );

export const fetchDashboardQueues = (signal?: AbortSignal) =>
  api.get('/admin/dashboard/queues', { schema: dashboardQueuesSchema, signal });

/** POST /admin/agencies/:id/decision (agencies module, `agencyDecisionSchema`). */
export const decideAgency = (
  id: string,
  body: { status: typeof AgencyStatus.APPROVED | typeof AgencyStatus.REJECTED; reason?: string },
) => api.post(`/admin/agencies/${encodeURIComponent(id)}/decision`, body);

// ---------- search ----------

export const SEARCH_MIN_LENGTH = 2;

/** Rows per group on the results page / in the topbar suggestions. */
export const SEARCH_PAGE_LIMIT = 8;
export const SEARCH_SUGGEST_LIMIT = 3;

export const searchAdmin = (q: string, signal?: AbortSignal, limit = SEARCH_PAGE_LIMIT) =>
  api.get('/admin/search', { query: { q, limit }, schema: adminSearchSchema, signal });

// ---------- notifications ----------

export const NOTIFICATION_PAGE_SIZE = 20;

export const fetchNotifications = (
  params: { cursor?: string; unreadOnly?: boolean },
  signal?: AbortSignal,
) =>
  api.get('/admin/notifications', {
    query: {
      cursor: params.cursor,
      limit: NOTIFICATION_PAGE_SIZE,
      unreadOnly: params.unreadOnly ? 'true' : undefined,
    },
    schema: adminNotificationPageSchema,
    signal,
  });

export const markNotificationRead = (id: string) =>
  api.post(`/admin/notifications/${encodeURIComponent(id)}/read`);

export const markAllNotificationsRead = () => api.post('/admin/notifications/read-all');
