/** Redis keys of the complexes module (auto-prefixed with REDIS_KEY_PREFIX). */
export const COMPLEXES_REDIS_KEYS = {
  /** Per-viewer dedupe marker for a complex view. */
  viewSeen: (complexId: string, viewer: string, day: string): string =>
    `complexes:views:seen:${day}:${complexId}:${viewer}`,
  /** Anonymous network's counted views on that KST day (cap counter). */
  viewNetworkCap: (viewer: string, day: string): string =>
    `complexes:views:netcap:${day}:${viewer}`,
  /** ZSET complexId → views on that KST day (popularity window). */
  viewsDaily: (day: string): string => `complexes:views:daily:${day}`,
  /** HASH complexId → absolute view total (seeded from the DB), flushed to complexes.view_count. */
  viewTotals: 'complexes:views:totals',
  /** Scratch key for the decayed ZUNIONSTORE. */
  popularUnion: (stamp: string): string => `complexes:views:union:${stamp}`,
  tradeSyncLock: (kind: string, sggCode: string, yearMonth: number): string =>
    `complexes:trade-sync:lock:${kind}:${sggCode}:${yearMonth}`,
  rematchLock: (sggCode: string): string => `complexes:trade-sync:lock:rematch:${sggCode}`,
} as const;

/** Cache namespaces bumped by admin writes (CacheService.version / bump). */
export const COMPLEXES_CACHE = {
  SEARCH: 'complexes:search',
  POPULAR: 'complexes:popular',
  REGIONS: 'complexes:regions',
} as const;

export const CACHE_TTL_SECONDS = {
  POPULAR: 120,
  AUTOCOMPLETE: 60,
  CHOSUNG_INDEX: 300,
  REGIONS: 3600,
} as const;

/** Popularity: views of the last N KST days, each day weighted 0.5^(age / half-life). */
export const POPULARITY_WINDOW_DAYS = 30;
export const POPULARITY_HALF_LIFE_DAYS = 7;
/** Daily view ZSETs live a little longer than the window. */
export const VIEWS_DAILY_TTL_SECONDS = (POPULARITY_WINDOW_DAYS + 2) * 24 * 60 * 60;
/**
 * Distinct 단지 one anonymous network (/24, /64) may add views to per KST day. Generous because
 * Korean mobile carriers put many real users behind shared (CGNAT) addresses; per-단지 dedupe by
 * network already limits inflation of a single 단지 to one view a day per network.
 */
export const ANON_VIEW_DAILY_CAP_PER_NETWORK = 100;
/** One counted view per viewer per complex per KST day. */
export const VIEW_DEDUPE_TTL_SECONDS = 24 * 60 * 60;

/** Jobs on the trade-sync queue (owned by this module). */
export const TRADE_SYNC_JOBS = {
  /** Repeatable: sync the last TRADE_SYNC_LOOKBACK_MONTHS months (late reports + 해제). */
  MONTHLY: 'trade-sync:monthly',
  /** One-off month sync ({ yearMonth, kinds }), enqueued by the admin endpoint. */
  MONTH: 'trade-sync:month',
  /** Re-match trades to 단지 ({ fromYm? }), enqueued by the admin endpoint and 단지 edits. */
  REMATCH: 'trade-sync:rematch',
  /** Repeatable: Redis view totals → complexes.view_count. */
  FLUSH_VIEWS: 'complexes:flush-views',
} as const;

/** 실거래 신고 기한 is 30 days and 해제 can be filed later, so re-sync recent months. */
export const TRADE_SYNC_LOOKBACK_MONTHS = 3;
/** 04:13 KST on the 2nd and 16th: twice a month keeps late reports/해제 within ~2 weeks. */
export const TRADE_SYNC_CRON = '13 4 2,16 * *';
export const TRADE_SYNC_TZ = 'Asia/Seoul';
export const FLUSH_VIEWS_EVERY_MS = 5 * 60_000;
/**
 * Lock TTL of a sync/rematch run. The holder extends it every TRADE_SYNC_LOCK_HEARTBEAT_MS, so it
 * only bounds how long a crashed worker blocks the next run.
 */
export const TRADE_SYNC_LOCK_TTL_SECONDS = 5 * 60;
export const TRADE_SYNC_LOCK_HEARTBEAT_MS = 60_000;
/** Trade rows per page when rematching, and 단지 per stats rebuild transaction. */
export const REMATCH_PAGE_SIZE = 1000;
export const STATS_RECOMPUTE_CHUNK = 50;

export const TRADE_API = {
  PAGE_SIZE: 1000,
  /** Safety cap: 순천 has well under 5,000 trades a month per kind. */
  MAX_PAGES: 20,
  TIMEOUT_MS: 20_000,
  /** 국토교통부 아파트 매매 실거래가 상세 / 전월세 실거래가 (apis.data.go.kr). */
  ENDPOINTS: {
    APT_TRADE: 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev',
    APT_RENT: 'https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent',
  },
} as const;

/** 전용면적 tolerance (㎡) when assigning a trade to a 평형. */
export const AREA_TYPE_MATCH_TOLERANCE_SQM = 0.5;
/** Upsert batch size for trade rows. */
export const TRADE_UPSERT_BATCH = 200;
