"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertOwnedBy = assertOwnedBy;
exports.assertActsForAgency = assertActsForAgency;
const shared_1 = require("@house/shared");
const app_exception_1 = require("../errors/app.exception");
/**
 * Ownership checks. Respond 404 (not 403) when the caller doesn't own the resource,
 * so ids of other users' resources can't be probed.
 */
function assertOwnedBy(principal, ownerUserId, notFoundCode = shared_1.ErrorCode.NOT_FOUND) {
    if (!ownerUserId || ownerUserId !== principal.userId)
        throw app_exception_1.AppException.notFound(notFoundCode);
}
/** The principal acts for `agencyId` (its session agency). Membership status is checked by AgenciesService. */
function assertActsForAgency(principal, agencyId, notFoundCode = shared_1.ErrorCode.NOT_FOUND) {
    if (!agencyId || principal.agencyId !== agencyId)
        throw app_exception_1.AppException.notFound(notFoundCode);
}
//# sourceMappingURL=ownership.js.map