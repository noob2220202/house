/**
 * Own BullMQ queue (like the auth module's) so no other module's worker competes for these jobs on
 * the shared `notifications` / `cleanup` queues.
 */
export declare const DEAL_REQUESTS_QUEUE = "deal-requests";
export declare const DEAL_REQUEST_JOBS: {
    /** In-app notification fan-out of a new request to the agencies that can see it. */
    readonly FANOUT: "deal-request.fanout";
    /** OPEN/MATCHED → EXPIRED once expiresAt has passed. */
    readonly EXPIRE: "deal-request.expire";
    /** Erase contact + 동·호 of ended requests and of withdrawn members' requests. */
    readonly SCRUB: "deal-request.scrub";
};
/** Every hour at :07 (off the hour). */
export declare const EXPIRE_PATTERN = "7 * * * *";
/** Daily 04:41 KST (off-peak, after the auth PII scrub). */
export declare const SCRUB_PATTERN = "41 4 * * *";
/** Rows per batch for jobs and fan-out. */
export declare const JOB_BATCH_SIZE = 500;
