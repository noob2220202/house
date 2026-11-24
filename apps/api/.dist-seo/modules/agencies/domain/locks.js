"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockUserMembership = lockUserMembership;
exports.lockAgency = lockAgency;
exports.lockRegistrationKey = lockRegistrationKey;
/**
 * Transaction-scoped advisory lock serializing agency membership changes of one user (register,
 * join, leave), so "one live agency per user" holds under concurrent requests.
 */
async function lockUserMembership(tx, userId) {
    const key = `agency-membership:${userId}`;
    await tx.$queryRaw `SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${key}))`;
}
/** Serializes status decisions / owner edits of one agency. */
async function lockAgency(tx, agencyId) {
    const key = `agency:${agencyId}`;
    await tx.$queryRaw `SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${key}))`;
}
/**
 * Serializes approvals of agencies sharing one 등록번호 key, so two pending applications for the
 * same number cannot both go live. Taken after lockAgency; never wait on an agency lock while
 * holding it.
 */
async function lockRegistrationKey(tx, registrationKey) {
    const key = `agency-registration:${registrationKey}`;
    await tx.$queryRaw `SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${key}))`;
}
//# sourceMappingURL=locks.js.map