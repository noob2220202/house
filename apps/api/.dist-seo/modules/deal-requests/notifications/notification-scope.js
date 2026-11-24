"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationFeedQuerySchema = exports.notificationScopeQuerySchema = exports.LISTING_AGENCY_NOTIFICATION_TYPES = exports.AGENCY_ONLY_NOTIFICATION_TYPES = exports.NotificationScope = void 0;
exports.notificationScopeWhere = notificationScopeWhere;
const shared_1 = require("@house/shared");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
/**
 * Audience of a notification (B5). One feed per user, but brokers are ordinary users too: rows
 * addressed to them as a member of an agency carry `data.agencyId`; everything else is personal.
 */
exports.NotificationScope = { AGENCY: 'agency', PERSONAL: 'personal' };
/**
 * Types only ever sent to agency members. Rows of these types count as `agency` even without
 * `data.agencyId` (rows written before B5, and the listings module's direct writes of
 * LISTING_EXPIRED / CO_BROKER_REQUESTED, which carry only `listingId`). Mirrors the web
 * `AGENCY_ONLY_TYPES` (apps/web/src/features/w-me/lib/notifications.ts) plus LISTING_HIDDEN.
 */
exports.AGENCY_ONLY_NOTIFICATION_TYPES = [
    shared_1.NotificationType.DEAL_REQUEST_RECEIVED,
    shared_1.NotificationType.PROPOSAL_ACCEPTED,
    shared_1.NotificationType.CONTACT_GRANTED,
    shared_1.NotificationType.LISTING_EXPIRED,
    shared_1.NotificationType.CO_BROKER_REQUESTED,
    shared_1.NotificationType.LISTING_HIDDEN,
];
/** Listing notices addressed to the listing's primary agency (agencyId resolved from listingId). */
exports.LISTING_AGENCY_NOTIFICATION_TYPES = [
    shared_1.NotificationType.LISTING_HIDDEN,
    shared_1.NotificationType.LISTING_EXPIRED,
    shared_1.NotificationType.CO_BROKER_REQUESTED,
];
const scopeSchema = zod_1.z.enum([exports.NotificationScope.AGENCY, exports.NotificationScope.PERSONAL]).optional();
/** `?scope=agency|personal` (local twin of the shared list query; shared has no scope yet). */
exports.notificationScopeQuerySchema = zod_1.z.object({ scope: scopeSchema });
exports.notificationFeedQuerySchema = shared_1.notificationListQuerySchema.extend({
    scope: scopeSchema,
});
/**
 * Prisma filter of a scope. `agency` = `data.agencyId` is a string OR an agency-only type;
 * `personal` = neither. Written without NOT: `NOT (json path LIKE …)` is NULL (→ excluded) for
 * rows whose `data` is NULL or lacks the key, so `personal` uses an explicit "path is null".
 */
function notificationScopeWhere(scope) {
    if (scope === exports.NotificationScope.AGENCY) {
        return {
            OR: [
                { data: { path: ['agencyId'], string_starts_with: '' } },
                { type: { in: [...exports.AGENCY_ONLY_NOTIFICATION_TYPES] } },
            ],
        };
    }
    if (scope === exports.NotificationScope.PERSONAL) {
        return {
            type: { notIn: [...exports.AGENCY_ONLY_NOTIFICATION_TYPES] },
            data: { path: ['agencyId'], equals: client_1.Prisma.AnyNull },
        };
    }
    return {};
}
//# sourceMappingURL=notification-scope.js.map