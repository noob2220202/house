// Owned by the inquiries module team. Limits of 문의 (customer inquiries to an office).
export const INQUIRY_LIMITS = {
  NAME_MAX: 30,
  MESSAGE_MIN: 5,
  MESSAGE_MAX: 1000,
  REPLY_MAX: 1000,
  MEMO_MAX: 1000,
  SEARCH_MAX: 50,
  DELETE_REASON_MAX: 200,
  /** Console inbox page size (GET /agency/inquiries). */
  PAGE_SIZE_DEFAULT: 12,
  PAGE_SIZE_MAX: 50,
  /** Written inquiries per member (user id) or guest (IP) and KST day. */
  DAILY_CAP: 10,
  /** The same visitor + agency + listing + channel logs one contact event per window. */
  CONTACT_EVENT_DEDUPE_HOURS: 6,
  /** PII (name, phone, message bodies) is scrubbed this long after the last message. */
  RETENTION_DAYS: 365,
} as const;
