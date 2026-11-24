"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agencyVisibleWhere = agencyVisibleWhere;
exports.agencyInboxWhere = agencyInboxWhere;
const shared_1 = require("@house/shared");
/**
 * Requests an agency may see:
 *  - any request it already proposed to (so it can follow up), unless the requester withdrew, and
 *  - OPEN, unexpired requests of active members that are either region-wide in its 시군구 or
 *    explicitly target it.
 * Deleted requests and requests an admin flagged as spam are never visible (not even to an agency
 * that already proposed), so they leave every inbox, scope (incl. TARGETED), detail and proposal path.
 */
function agencyVisibleWhere(scope, now) {
    return {
        deletedAt: null,
        spamFlaggedAt: null,
        OR: [
            {
                proposals: { some: { agencyId: scope.agencyId } },
                user: { status: { not: shared_1.UserStatus.WITHDRAWN } },
            },
            {
                status: shared_1.DealRequestStatus.OPEN,
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
                user: { status: shared_1.UserStatus.ACTIVE },
                AND: [
                    {
                        OR: [
                            {
                                visibility: shared_1.DealRequestVisibility.ALL_AGENCIES_IN_REGION,
                                sggCode: scope.sggCode,
                            },
                            {
                                visibility: shared_1.DealRequestVisibility.SELECTED_AGENCIES,
                                targets: { some: { agencyId: scope.agencyId } },
                            },
                        ],
                    },
                ],
            },
        ],
    };
}
/** Inbox filters on top of the visibility rule. */
function agencyInboxWhere(scope, q, now) {
    const and = [agencyVisibleWhere(scope, now)];
    switch (q.scope) {
        case shared_1.AgencyInboxScope.TARGETED:
            and.push({ targets: { some: { agencyId: scope.agencyId } } });
            break;
        case shared_1.AgencyInboxScope.PROPOSED:
            and.push({ proposals: { some: { agencyId: scope.agencyId } } });
            break;
        case shared_1.AgencyInboxScope.NEW:
            and.push({
                status: shared_1.DealRequestStatus.OPEN,
                proposals: { none: { agencyId: scope.agencyId } },
            });
            break;
        case shared_1.AgencyInboxScope.ALL:
            break;
    }
    if (q.type)
        and.push({ type: q.type });
    if (q.assetType?.length)
        and.push({ assetType: { in: q.assetType } });
    if (q.dealType?.length)
        and.push({ dealTypes: { hasSome: q.dealType } });
    return { AND: and };
}
//# sourceMappingURL=deal-request-access.js.map