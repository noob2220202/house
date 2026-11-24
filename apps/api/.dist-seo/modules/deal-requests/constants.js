"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JOB_BATCH_SIZE = exports.SCRUB_PATTERN = exports.EXPIRE_PATTERN = exports.DEAL_REQUEST_JOBS = exports.DEAL_REQUESTS_QUEUE = void 0;
/**
 * Own BullMQ queue (like the auth module's) so no other module's worker competes for these jobs on
 * the shared `notifications` / `cleanup` queues.
 */
exports.DEAL_REQUESTS_QUEUE = 'deal-requests';
exports.DEAL_REQUEST_JOBS = {
    /** In-app notification fan-out of a new request to the agencies that can see it. */
    FANOUT: 'deal-request.fanout',
    /** OPEN/MATCHED → EXPIRED once expiresAt has passed. */
    EXPIRE: 'deal-request.expire',
    /** Erase contact + 동·호 of ended requests and of withdrawn members' requests. */
    SCRUB: 'deal-request.scrub',
};
/** Every hour at :07 (off the hour). */
exports.EXPIRE_PATTERN = '7 * * * *';
/** Daily 04:41 KST (off-peak, after the auth PII scrub). */
exports.SCRUB_PATTERN = '41 4 * * *';
/** Rows per batch for jobs and fan-out. */
exports.JOB_BATCH_SIZE = 500;
//# sourceMappingURL=constants.js.map