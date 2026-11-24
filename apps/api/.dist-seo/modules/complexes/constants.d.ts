/** Redis keys of the complexes module (auto-prefixed with REDIS_KEY_PREFIX). */
export declare const COMPLEXES_REDIS_KEYS: {
    /** Per-viewer dedupe marker for a complex view. */
    readonly viewSeen: (complexId: string, viewer: string, day: string) => string;
    /** Anonymous network's counted views on that KST day (cap counter). */
    readonly viewNetworkCap: (viewer: string, day: string) => string;
    /** ZSET complexId → views on that KST day (popularity window). */
    readonly viewsDaily: (day: string) => string;
    /** HASH complexId → absolute view total (seeded from the DB), flushed to complexes.view_count. */
    readonly viewTotals: "complexes:views:totals";
    /** Scratch key for the decayed ZUNIONSTORE. */
    readonly popularUnion: (stamp: string) => string;
    readonly tradeSyncLock: (kind: string, sggCode: string, yearMonth: number) => string;
    readonly rematchLock: (sggCode: string) => string;
};
/** Cache namespaces bumped by admin writes (CacheService.version / bump). */
export declare const COMPLEXES_CACHE: {
    readonly SEARCH: "complexes:search";
    readonly POPULAR: "complexes:popular";
    readonly REGIONS: "complexes:regions";
};
export declare const CACHE_TTL_SECONDS: {
    readonly POPULAR: 120;
    readonly AUTOCOMPLETE: 60;
    readonly CHOSUNG_INDEX: 300;
    readonly REGIONS: 3600;
};
/** Popularity: views of the last N KST days, each day weighted 0.5^(age / half-life). */
export declare const POPULARITY_WINDOW_DAYS = 30;
export declare const POPULARITY_HALF_LIFE_DAYS = 7;
/** Daily view ZSETs live a little longer than the window. */
export declare const VIEWS_DAILY_TTL_SECONDS: number;
/**
 * Distinct 단지 one anonymous network (/24, /64) may add views to per KST day. Generous because
 * Korean mobile carriers put many real users behind shared (CGNAT) addresses; per-단지 dedupe by
 * network already limits inflation of a single 단지 to one view a day per network.
 */
export declare const ANON_VIEW_DAILY_CAP_PER_NETWORK = 100;
/** One counted view per viewer per complex per KST day. */
export declare const VIEW_DEDUPE_TTL_SECONDS: number;
/** Jobs on the trade-sync queue (owned by this module). */
export declare const TRADE_SYNC_JOBS: {
    /** Repeatable: sync the last TRADE_SYNC_LOOKBACK_MONTHS months (late reports + 해제). */
    readonly MONTHLY: "trade-sync:monthly";
    /** One-off month sync ({ yearMonth, kinds }), enqueued by the admin endpoint. */
    readonly MONTH: "trade-sync:month";
    /** Re-match trades to 단지 ({ fromYm? }), enqueued by the admin endpoint and 단지 edits. */
    readonly REMATCH: "trade-sync:rematch";
    /** Repeatable: Redis view totals → complexes.view_count. */
    readonly FLUSH_VIEWS: "complexes:flush-views";
};
/** 실거래 신고 기한 is 30 days and 해제 can be filed later, so re-sync recent months. */
export declare const TRADE_SYNC_LOOKBACK_MONTHS = 3;
/** 04:13 KST on the 2nd and 16th: twice a month keeps late reports/해제 within ~2 weeks. */
export declare const TRADE_SYNC_CRON = "13 4 2,16 * *";
export declare const TRADE_SYNC_TZ = "Asia/Seoul";
export declare const FLUSH_VIEWS_EVERY_MS: number;
/**
 * Lock TTL of a sync/rematch run. The holder extends it every TRADE_SYNC_LOCK_HEARTBEAT_MS, so it
 * only bounds how long a crashed worker blocks the next run.
 */
export declare const TRADE_SYNC_LOCK_TTL_SECONDS: number;
export declare const TRADE_SYNC_LOCK_HEARTBEAT_MS = 60000;
/** Trade rows per page when rematching, and 단지 per stats rebuild transaction. */
export declare const REMATCH_PAGE_SIZE = 1000;
export declare const STATS_RECOMPUTE_CHUNK = 50;
export declare const TRADE_API: {
    readonly PAGE_SIZE: 1000;
    /** Safety cap: 순천 has well under 5,000 trades a month per kind. */
    readonly MAX_PAGES: 20;
    readonly TIMEOUT_MS: 20000;
    /** 국토교통부 아파트 매매 실거래가 상세 / 전월세 실거래가 (apis.data.go.kr). */
    readonly ENDPOINTS: {
        readonly APT_TRADE: "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";
        readonly APT_RENT: "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent";
    };
};
/** 전용면적 tolerance (㎡) when assigning a trade to a 평형. */
export declare const AREA_TYPE_MATCH_TOLERANCE_SQM = 0.5;
/** Upsert batch size for trade rows. */
export declare const TRADE_UPSERT_BATCH = 200;
