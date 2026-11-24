"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.statsSectionParamSchema = exports.STATS_SECTIONS = exports.statsQuerySchema = exports.STATS_DAYS = exports.adminSearchQuerySchema = exports.ADMIN_SEARCH_MAX_LIMIT = exports.ADMIN_SEARCH_DEFAULT_LIMIT = exports.ADMIN_SEARCH_MIN_LENGTH = exports.adminNotificationListQuerySchema = exports.ADMIN_NOTIFICATION_KINDS = void 0;
exports.normalizeSearch = normalizeSearch;
const shared_1 = require("@house/shared");
const zod_1 = require("zod");
/**
 * Module-local contracts of the back-office endpoints added for the admin app (WI-10):
 * dashboard queues, global search, the notification bell, statistics and social-login status.
 * They mirror the admin app's zod schemas (`apps/admin/src/features/{m-core,m-content}/api/
 * schemas.ts`) field by field. TODO(shared): promote to `packages/shared/src/schemas/admin.ts`.
 */
// ---------- notifications ----------
exports.ADMIN_NOTIFICATION_KINDS = [
    'AGENCY_APPLIED',
    'LISTING_REVIEW',
    'REPORT_RECEIVED',
    'DEAL_REQUEST_UNASSIGNED',
    'AD_EXPIRING',
    'SECURITY',
    'SYSTEM',
];
/** GET /admin/notifications?cursor&limit&unreadOnly */
exports.adminNotificationListQuerySchema = shared_1.cursorQuerySchema.extend({
    unreadOnly: shared_1.queryBoolean,
});
// ---------- search ----------
exports.ADMIN_SEARCH_MIN_LENGTH = 2;
exports.ADMIN_SEARCH_DEFAULT_LIMIT = 8;
exports.ADMIN_SEARCH_MAX_LIMIT = 20;
const SEARCH_TOO_SHORT = '검색어를 2자 이상 입력해 주세요.';
/** Case, spaces and hyphens do not matter (same normalisation as the admin list pages). */
function normalizeSearch(q) {
    return q.toLowerCase().replace(/[\s-]/g, '');
}
/** GET /admin/search?q=&limit= — `q` must have ≥ 2 characters besides spaces and hyphens. */
exports.adminSearchQuerySchema = zod_1.z.object({
    q: zod_1.z
        .string({ error: SEARCH_TOO_SHORT })
        .trim()
        .max(100, '검색어는 100자 이하로 입력해 주세요.')
        .refine((q) => normalizeSearch(q).length >= exports.ADMIN_SEARCH_MIN_LENGTH, SEARCH_TOO_SHORT),
    limit: zod_1.z.coerce
        .number()
        .int()
        .min(1)
        .max(exports.ADMIN_SEARCH_MAX_LIMIT)
        .default(exports.ADMIN_SEARCH_DEFAULT_LIMIT),
});
// ---------- stats ----------
exports.STATS_DAYS = [7, 30, 90];
/** GET /admin/stats/:section?days=7|30|90 (default 30). */
exports.statsQuerySchema = zod_1.z.object({
    days: zod_1.z.coerce
        .number()
        .int()
        .refine((d) => exports.STATS_DAYS.includes(d), '조회 기간은 7, 30, 90일 중에서 고를 수 있습니다.')
        .default(30),
});
exports.STATS_SECTIONS = ['traffic', 'listings', 'deal-requests', 'ads'];
exports.statsSectionParamSchema = zod_1.z.object({
    section: zod_1.z.enum(exports.STATS_SECTIONS, { error: '알 수 없는 통계 항목입니다.' }),
});
//# sourceMappingURL=schemas.js.map