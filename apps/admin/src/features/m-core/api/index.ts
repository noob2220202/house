import type { AdminLoginInput, AgencyStatus } from '@house/shared';
import { api, qk } from '@/lib/api';
import { splitTraffic } from '../lib/dashboard';
import {
  adminAccountSchema,
  adminLoginResultSchema,
  adminNotificationPageSchema,
  adminSearchSchema,
  dashboardQueuesSchema,
  dashboardSummarySchema,
  totpSetupSchema,
  totpVerifyResultSchema,
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

export const startTotpSetup = () =>
  api.post('/admin/auth/totp/setup', undefined, { schema: totpSetupSchema });

export const verifyTotp = (code: string) =>
  api.post('/admin/auth/totp/verify', { code }, { schema: totpVerifyResultSchema });

export const fetchAccount = (signal?: AbortSignal) =>
  api.get('/admin/auth/me', { schema: adminAccountSchema, signal });

export const changePassword = (input: { currentPassword: string; newPassword: string }) =>
  api.post('/admin/auth/password', input);

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
