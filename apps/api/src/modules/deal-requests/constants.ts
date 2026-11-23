/**
 * Own BullMQ queue (like the auth module's) so no other module's worker competes for these jobs on
 * the shared `notifications` / `cleanup` queues.
 */
export const DEAL_REQUESTS_QUEUE = 'deal-requests';

export const DEAL_REQUEST_JOBS = {
  /** In-app notification fan-out of a new request to the agencies that can see it. */
  FANOUT: 'deal-request.fanout',
  /** OPEN/MATCHED → EXPIRED once expiresAt has passed. */
  EXPIRE: 'deal-request.expire',
  /** Erase contact + 동·호 of ended requests and of withdrawn members' requests. */
  SCRUB: 'deal-request.scrub',
} as const;

/** Every hour at :07 (off the hour). */
export const EXPIRE_PATTERN = '7 * * * *';
/** Daily 04:41 KST (off-peak, after the auth PII scrub). */
export const SCRUB_PATTERN = '41 4 * * *';

/** Rows per batch for jobs and fan-out. */
export const JOB_BATCH_SIZE = 500;
