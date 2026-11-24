/** Redis key namespaces (REDIS_KEY_PREFIX is added by the client). */
export declare const AGENCY_REDIS: {
    /** invite record by id → JSON */
    readonly invite: (inviteId: string) => string;
    /** sha256(code) → invite id (GETDEL makes redemption single-use) */
    readonly inviteCode: (codeHash: string) => string;
    /** ZSET of an agency's invite ids scored by expiry (ms) */
    readonly agencyInvites: (agencyId: string) => string;
    readonly registryCheck: (agencyId: string) => string;
};
/** CacheService version namespaces. */
export declare const AGENCY_CACHE: {
    /** public profile + map tiles */
    readonly PUBLIC: "agencies:public";
};
export declare const MAX_ACTIVE_INVITES = 20;
export declare const MAX_AGENCY_DOCUMENTS = 20;
export declare const PROFILE_CACHE_TTL_SECONDS = 60;
export declare const MAP_CACHE_TTL_SECONDS = 30;
/** 읍면동 facet of the office search (changes only with approvals / 소재지 changes). */
export declare const REGIONS_CACHE_TTL_SECONDS = 300;
export declare const REGISTRY_CACHE_TTL_SECONDS: number;
export declare const REPRESENTATIVE_LISTINGS_LIMIT = 6;
export declare const PROFILE_MEMBERS_LIMIT = 50;
export declare const STATUS_HISTORY_LIMIT = 50;
/** Console dashboard (GET /agencies/mine/dashboard). */
export declare const DASHBOARD_LIST_LIMIT = 20;
/** "광고 만료 임박": ads lapsing within this many days. */
export declare const DASHBOARD_EXPIRING_WITHIN_DAYS = 7;
/** 실매물 확인 is due when it runs out within this many days. */
export declare const DASHBOARD_VERIFICATION_SOON_DAYS = 7;
/**
 * A 실매물 확인 keeps the ad live for this many days (listings `LISTING_AD_TTL_DAYS`: the ad reverts
 * to DRAFT 30 days after publication or the latest 확인).
 */
export declare const LISTING_VERIFICATION_VALID_DAYS = 30;
/** Own BullMQ queue (no other module's worker competes for these jobs). */
export declare const AGENCIES_QUEUE = "agencies";
export declare const AGENCY_JOBS: {
    /** Upsert today's cumulative listing views of every approved agency. */
    readonly DAILY_STATS: "agencies.daily-stats";
};
/** Hourly at :53 KST (off the hour; the day's last run closes the day). */
export declare const DAILY_STATS_PATTERN = "53 * * * *";
