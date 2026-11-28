/** Redis key namespaces (REDIS_KEY_PREFIX is added by the client). */
export const AGENCY_REDIS = {
  /** invite record by id → JSON */
  invite: (inviteId: string) => `agencies:invite:${inviteId}`,
  /** sha256(code) → invite id (GETDEL makes redemption single-use) */
  inviteCode: (codeHash: string) => `agencies:invite-code:${codeHash}`,
  /** ZSET of an agency's invite ids scored by expiry (ms) */
  agencyInvites: (agencyId: string) => `agencies:invites:${agencyId}`,
  registryCheck: (agencyId: string) => `cache:agencies:registry:${agencyId}`,
} as const;

/** CacheService version namespaces. */
export const AGENCY_CACHE = {
  /** public profile + map tiles */
  PUBLIC: 'agencies:public',
} as const;

export const MAX_ACTIVE_INVITES = 20;
export const MAX_AGENCY_DOCUMENTS = 20;
export const PROFILE_CACHE_TTL_SECONDS = 60;
export const MAP_CACHE_TTL_SECONDS = 30;
/** 읍면동 facet of the office search (changes only with approvals / 소재지 changes). */
export const REGIONS_CACHE_TTL_SECONDS = 300;
export const REGISTRY_CACHE_TTL_SECONDS = 60 * 60 * 24;
export const REPRESENTATIVE_LISTINGS_LIMIT = 6;
export const PROFILE_MEMBERS_LIMIT = 50;
export const STATUS_HISTORY_LIMIT = 50;
/** FEATURES flags read by the 사무소 홈페이지 subscription gate (bumped on FEATURES writes). */
export const FEATURES_CACHE_TTL_SECONDS = 60;
/** Public office site (GET /sites/:slug), same lifetime as the profile it embeds. */
export const SITE_CACHE_TTL_SECONDS = 60;

/** Console dashboard (GET /agencies/mine/dashboard). */
export const DASHBOARD_LIST_LIMIT = 20;
/** "광고 만료 임박": ads lapsing within this many days. */
export const DASHBOARD_EXPIRING_WITHIN_DAYS = 7;
/** 실매물 확인 is due when it runs out within this many days. */
export const DASHBOARD_VERIFICATION_SOON_DAYS = 7;
/**
 * A 실매물 확인 keeps the ad live for this many days (listings `LISTING_AD_TTL_DAYS`: the ad reverts
 * to DRAFT 30 days after publication or the latest 확인).
 */
export const LISTING_VERIFICATION_VALID_DAYS = 30;

/** Own BullMQ queue (no other module's worker competes for these jobs). */
export const AGENCIES_QUEUE = 'agencies';
export const AGENCY_JOBS = {
  /** Upsert today's cumulative listing views of every approved agency. */
  DAILY_STATS: 'agencies.daily-stats',
  /** 개인정보 파기 of rejected applications past their retention period (AgencyRetentionService). */
  PURGE_REJECTED: 'agencies.purge-rejected',
} as const;
/** Hourly at :53 KST (off the hour; the day's last run closes the day). */
export const DAILY_STATS_PATTERN = '53 * * * *';
/** Daily at 03:47 KST. */
export const PURGE_REJECTED_PATTERN = '47 3 * * *';
/**
 * Retention of a rejected (not resubmitted) 등록 신청, counted from the rejection. Must match the
 * PRIVACY_AGENCY_APPLICATION notice ("반려된 신청은 반려 후 1년": prisma/seed/base.ts and the web
 * fallback text in features/a-agency).
 */
export const REJECTED_APPLICATION_RETENTION_YEARS = 1;
/** Applications purged per query round (each in its own transaction). */
export const RETENTION_PURGE_BATCH_SIZE = 100;
