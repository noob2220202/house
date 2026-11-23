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
export const REGISTRY_CACHE_TTL_SECONDS = 60 * 60 * 24;
export const REPRESENTATIVE_LISTINGS_LIMIT = 6;
export const PROFILE_MEMBERS_LIMIT = 50;
export const STATUS_HISTORY_LIMIT = 50;
