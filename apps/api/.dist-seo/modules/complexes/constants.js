"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRADE_UPSERT_BATCH = exports.AREA_TYPE_MATCH_TOLERANCE_SQM = exports.TRADE_API = exports.STATS_RECOMPUTE_CHUNK = exports.REMATCH_PAGE_SIZE = exports.TRADE_SYNC_LOCK_HEARTBEAT_MS = exports.TRADE_SYNC_LOCK_TTL_SECONDS = exports.FLUSH_VIEWS_EVERY_MS = exports.TRADE_SYNC_TZ = exports.TRADE_SYNC_CRON = exports.TRADE_SYNC_LOOKBACK_MONTHS = exports.TRADE_SYNC_JOBS = exports.VIEW_DEDUPE_TTL_SECONDS = exports.ANON_VIEW_DAILY_CAP_PER_NETWORK = exports.VIEWS_DAILY_TTL_SECONDS = exports.POPULARITY_HALF_LIFE_DAYS = exports.POPULARITY_WINDOW_DAYS = exports.CACHE_TTL_SECONDS = exports.COMPLEXES_CACHE = exports.COMPLEXES_REDIS_KEYS = void 0;
/** Redis keys of the complexes module (auto-prefixed with REDIS_KEY_PREFIX). */
exports.COMPLEXES_REDIS_KEYS = {
    /** Per-viewer dedupe marker for a complex view. */
    viewSeen: (complexId, viewer, day) => `complexes:views:seen:${day}:${complexId}:${viewer}`,
    /** Anonymous network's counted views on that KST day (cap counter). */
    viewNetworkCap: (viewer, day) => `complexes:views:netcap:${day}:${viewer}`,
    /** ZSET complexId → views on that KST day (popularity window). */
    viewsDaily: (day) => `complexes:views:daily:${day}`,
    /** HASH complexId → absolute view total (seeded from the DB), flushed to complexes.view_count. */
    viewTotals: 'complexes:views:totals',
    /** Scratch key for the decayed ZUNIONSTORE. */
    popularUnion: (stamp) => `complexes:views:union:${stamp}`,
    tradeSyncLock: (kind, sggCode, yearMonth) => `complexes:trade-sync:lock:${kind}:${sggCode}:${yearMonth}`,
    rematchLock: (sggCode) => `complexes:trade-sync:lock:rematch:${sggCode}`,
};
/** Cache namespaces bumped by admin writes (CacheService.version / bump). */
exports.COMPLEXES_CACHE = {
    SEARCH: 'complexes:search',
    POPULAR: 'complexes:popular',
    REGIONS: 'complexes:regions',
};
exports.CACHE_TTL_SECONDS = {
    POPULAR: 120,
    AUTOCOMPLETE: 60,
    CHOSUNG_INDEX: 300,
    REGIONS: 3600,
};
/** Popularity: views of the last N KST days, each day weighted 0.5^(age / half-life). */
exports.POPULARITY_WINDOW_DAYS = 30;
exports.POPULARITY_HALF_LIFE_DAYS = 7;
/** Daily view ZSETs live a little longer than the window. */
exports.VIEWS_DAILY_TTL_SECONDS = (exports.POPULARITY_WINDOW_DAYS + 2) * 24 * 60 * 60;
/**
 * Distinct 단지 one anonymous network (/24, /64) may add views to per KST day. Generous because
 * Korean mobile carriers put many real users behind shared (CGNAT) addresses; per-단지 dedupe by
 * network already limits inflation of a single 단지 to one view a day per network.
 */
exports.ANON_VIEW_DAILY_CAP_PER_NETWORK = 100;
/** One counted view per viewer per complex per KST day. */
exports.VIEW_DEDUPE_TTL_SECONDS = 24 * 60 * 60;
/** Jobs on the trade-sync queue (owned by this module). */
exports.TRADE_SYNC_JOBS = {
    /** Repeatable: sync the last TRADE_SYNC_LOOKBACK_MONTHS months (late reports + 해제). */
    MONTHLY: 'trade-sync:monthly',
    /** One-off month sync ({ yearMonth, kinds }), enqueued by the admin endpoint. */
    MONTH: 'trade-sync:month',
    /** Re-match trades to 단지 ({ fromYm? }), enqueued by the admin endpoint and 단지 edits. */
    REMATCH: 'trade-sync:rematch',
    /** Repeatable: Redis view totals → complexes.view_count. */
    FLUSH_VIEWS: 'complexes:flush-views',
};
/** 실거래 신고 기한 is 30 days and 해제 can be filed later, so re-sync recent months. */
exports.TRADE_SYNC_LOOKBACK_MONTHS = 3;
/** 04:13 KST on the 2nd and 16th: twice a month keeps late reports/해제 within ~2 weeks. */
exports.TRADE_SYNC_CRON = '13 4 2,16 * *';
exports.TRADE_SYNC_TZ = 'Asia/Seoul';
exports.FLUSH_VIEWS_EVERY_MS = 5 * 60_000;
/**
 * Lock TTL of a sync/rematch run. The holder extends it every TRADE_SYNC_LOCK_HEARTBEAT_MS, so it
 * only bounds how long a crashed worker blocks the next run.
 */
exports.TRADE_SYNC_LOCK_TTL_SECONDS = 5 * 60;
exports.TRADE_SYNC_LOCK_HEARTBEAT_MS = 60_000;
/** Trade rows per page when rematching, and 단지 per stats rebuild transaction. */
exports.REMATCH_PAGE_SIZE = 1000;
exports.STATS_RECOMPUTE_CHUNK = 50;
exports.TRADE_API = {
    PAGE_SIZE: 1000,
    /** Safety cap: 순천 has well under 5,000 trades a month per kind. */
    MAX_PAGES: 20,
    TIMEOUT_MS: 20_000,
    /** 국토교통부 아파트 매매 실거래가 상세 / 전월세 실거래가 (apis.data.go.kr). */
    ENDPOINTS: {
        APT_TRADE: 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev',
        APT_RENT: 'https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent',
    },
};
/** 전용면적 tolerance (㎡) when assigning a trade to a 평형. */
exports.AREA_TYPE_MATCH_TOLERANCE_SQM = 0.5;
/** Upsert batch size for trade rows. */
exports.TRADE_UPSERT_BATCH = 200;
//# sourceMappingURL=constants.js.map