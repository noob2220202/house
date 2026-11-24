"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAILY_STATS_PATTERN = exports.AGENCY_JOBS = exports.AGENCIES_QUEUE = exports.LISTING_VERIFICATION_VALID_DAYS = exports.DASHBOARD_VERIFICATION_SOON_DAYS = exports.DASHBOARD_EXPIRING_WITHIN_DAYS = exports.DASHBOARD_LIST_LIMIT = exports.STATUS_HISTORY_LIMIT = exports.PROFILE_MEMBERS_LIMIT = exports.REPRESENTATIVE_LISTINGS_LIMIT = exports.REGISTRY_CACHE_TTL_SECONDS = exports.REGIONS_CACHE_TTL_SECONDS = exports.MAP_CACHE_TTL_SECONDS = exports.PROFILE_CACHE_TTL_SECONDS = exports.MAX_AGENCY_DOCUMENTS = exports.MAX_ACTIVE_INVITES = exports.AGENCY_CACHE = exports.AGENCY_REDIS = void 0;
/** Redis key namespaces (REDIS_KEY_PREFIX is added by the client). */
exports.AGENCY_REDIS = {
    /** invite record by id → JSON */
    invite: (inviteId) => `agencies:invite:${inviteId}`,
    /** sha256(code) → invite id (GETDEL makes redemption single-use) */
    inviteCode: (codeHash) => `agencies:invite-code:${codeHash}`,
    /** ZSET of an agency's invite ids scored by expiry (ms) */
    agencyInvites: (agencyId) => `agencies:invites:${agencyId}`,
    registryCheck: (agencyId) => `cache:agencies:registry:${agencyId}`,
};
/** CacheService version namespaces. */
exports.AGENCY_CACHE = {
    /** public profile + map tiles */
    PUBLIC: 'agencies:public',
};
exports.MAX_ACTIVE_INVITES = 20;
exports.MAX_AGENCY_DOCUMENTS = 20;
exports.PROFILE_CACHE_TTL_SECONDS = 60;
exports.MAP_CACHE_TTL_SECONDS = 30;
/** 읍면동 facet of the office search (changes only with approvals / 소재지 changes). */
exports.REGIONS_CACHE_TTL_SECONDS = 300;
exports.REGISTRY_CACHE_TTL_SECONDS = 60 * 60 * 24;
exports.REPRESENTATIVE_LISTINGS_LIMIT = 6;
exports.PROFILE_MEMBERS_LIMIT = 50;
exports.STATUS_HISTORY_LIMIT = 50;
/** Console dashboard (GET /agencies/mine/dashboard). */
exports.DASHBOARD_LIST_LIMIT = 20;
/** "광고 만료 임박": ads lapsing within this many days. */
exports.DASHBOARD_EXPIRING_WITHIN_DAYS = 7;
/** 실매물 확인 is due when it runs out within this many days. */
exports.DASHBOARD_VERIFICATION_SOON_DAYS = 7;
/**
 * A 실매물 확인 keeps the ad live for this many days (listings `LISTING_AD_TTL_DAYS`: the ad reverts
 * to DRAFT 30 days after publication or the latest 확인).
 */
exports.LISTING_VERIFICATION_VALID_DAYS = 30;
/** Own BullMQ queue (no other module's worker competes for these jobs). */
exports.AGENCIES_QUEUE = 'agencies';
exports.AGENCY_JOBS = {
    /** Upsert today's cumulative listing views of every approved agency. */
    DAILY_STATS: 'agencies.daily-stats',
};
/** Hourly at :53 KST (off the hour; the day's last run closes the day). */
exports.DAILY_STATS_PATTERN = '53 * * * *';
//# sourceMappingURL=constants.js.map