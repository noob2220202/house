/**
 * Own BullMQ queue (like deal-requests / auth): every processor on a queue receives every job
 * name, so the retention job never competes with another module's worker.
 */
export const INQUIRIES_QUEUE = 'inquiries';

export const INQUIRY_JOBS = {
  /** Erase name / phone / texts of inquiries past retention and of withdrawn members. */
  SCRUB: 'inquiry.scrub',
} as const;

/** Daily 04:29 KST: after the auth PII scrub (04:17) marks withdrawals, off the other jobs. */
export const SCRUB_PATTERN = '29 4 * * *';

/** Rows per batch of the retention job. */
export const JOB_BATCH_SIZE = 500;

/** Redis key prefix of the contact-event dedupe window (`SET NX EX`). */
export const CONTACT_EVENT_KEY = 'inquiries:contact';

/** Latest written inquiries on the console home. */
export const DASHBOARD_INQUIRY_ITEMS = 3;

/** Characters of the latest message shown in MY > 문의 내역. */
export const PREVIEW_LENGTH = 80;
