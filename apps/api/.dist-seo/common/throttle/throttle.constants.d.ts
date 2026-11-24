/**
 * Per-route overrides for @Throttle(). The global default (THROTTLE_LIMIT per THROTTLE_TTL_MS)
 * applies elsewhere. Buckets are per route and keyed by the logged-in account, else by client IP
 * (see HouseThrottlerGuard). Usage: @Throttle(THROTTLE.AUTH)
 */
export declare const THROTTLE: {
    /** login / oauth start+callback / admin login */
    readonly AUTH: {
        readonly default: {
            readonly limit: 20;
            readonly ttl: 60000;
            readonly blockDuration: number;
        };
    };
    /** admin email+password login (per IP; account lockout is separate) */
    readonly ADMIN_LOGIN: {
        readonly default: {
            readonly limit: 10;
            readonly ttl: number;
            readonly blockDuration: number;
        };
    };
    /** 허위매물 신고 */
    readonly REPORT: {
        readonly default: {
            readonly limit: 10;
            readonly ttl: number;
        };
    };
    /** 내놓기/구하기 creation (per-user daily caps are enforced separately, see DAILY_CAPS) */
    readonly DEAL_REQUEST: {
        readonly default: {
            readonly limit: 5;
            readonly ttl: number;
        };
    };
    /** other public write endpoints (proposals, favorites, uploads) */
    readonly WRITE: {
        readonly default: {
            readonly limit: 30;
            readonly ttl: 60000;
        };
    };
};
/**
 * Per-user daily caps (abuse control without SMS: login + rate limits + caps + moderation).
 * Enforce with DailyCapService (Redis counter keyed by user + KST date).
 */
export declare const DAILY_CAPS: {
    readonly DEAL_REQUEST_CREATE: 5;
    readonly PROPOSAL_CREATE: 50;
    readonly REPORT_CREATE: 10;
    readonly MEDIA_UPLOAD: 300;
};
export type DailyCapKey = keyof typeof DAILY_CAPS;
