/**
 * Per-route overrides for @Throttle(). The global default (THROTTLE_LIMIT per THROTTLE_TTL_MS)
 * applies elsewhere. Buckets are per route and keyed by the logged-in account, else by client IP
 * (see HouseThrottlerGuard). Usage: @Throttle(THROTTLE.AUTH)
 */
export const THROTTLE = {
  /** login / oauth start+callback / admin login */
  AUTH: { default: { limit: 20, ttl: 60_000, blockDuration: 5 * 60_000 } },
  /** admin email+password login (per IP; account lockout is separate) */
  ADMIN_LOGIN: { default: { limit: 10, ttl: 10 * 60_000, blockDuration: 15 * 60_000 } },
  /** 허위매물 신고 */
  REPORT: { default: { limit: 10, ttl: 60 * 60_000 } },
  /** 내놓기/구하기 creation (per-user daily caps are enforced separately, see DAILY_CAPS) */
  DEAL_REQUEST: { default: { limit: 5, ttl: 60 * 60_000 } },
  /** other public write endpoints (proposals, favorites, uploads) */
  WRITE: { default: { limit: 30, ttl: 60_000 } },
} as const;

/**
 * Per-user daily caps (abuse control without SMS: login + rate limits + caps + moderation).
 * Enforce with DailyCapService (Redis counter keyed by user + KST date).
 */
export const DAILY_CAPS = {
  DEAL_REQUEST_CREATE: 5,
  PROPOSAL_CREATE: 50,
  REPORT_CREATE: 10,
  MEDIA_UPLOAD: 300,
} as const;
export type DailyCapKey = keyof typeof DAILY_CAPS;
