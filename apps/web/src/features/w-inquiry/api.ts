import type { InquiryContactEventInput, InquiryCreateInput } from '@house/shared';
import { api, qk } from '@/lib/api';
import { inquiryCreatedSchema, myInquiryDetailSchema, myInquiryPageSchema } from './schemas';

/** Page size of MY > 문의 내역 (part of the query key). */
export const MY_INQUIRIES_PAGE_SIZE = 10;

/** Query keys of the customer side (`[resource, scope, params]`; invalidate by resource). */
export const inquiryKeys = {
  mine: qk('me-inquiries'),
  lists: qk('me-inquiries', 'list'),
  myList: (page: number) => qk('me-inquiries', 'list', { page, pageSize: MY_INQUIRIES_PAGE_SIZE }),
  myDetail: (id: string) => qk('me-inquiries', 'detail', id),
} as const;

/**
 * POST /inquiries — a written inquiry to an office (members and guests, `inquiryCreateSchema`).
 * Guests must send a phone (400 INQUIRY_PHONE_REQUIRED); 429 INQUIRY_DAILY_LIMIT after 10 a day.
 */
export function sendInquiry(body: InquiryCreateInput) {
  return api.post('/inquiries', body, { schema: inquiryCreatedSchema });
}

/**
 * POST /inquiries/contact-events → 204. Logs that the visitor pressed 전화 / 문자 / 번호 복사 so the
 * office sees it in its 문의함 (no personal data is sent). Fire and forget: a failed log must never
 * get in the way of the call itself.
 */
export function logContactEvent(body: InquiryContactEventInput): void {
  api.post('/inquiries/contact-events', body).catch(() => undefined);
}

/** GET /me/inquiries — the member's written inquiries, newest activity first. */
export function fetchMyInquiries(page: number, signal?: AbortSignal) {
  return api.get('/me/inquiries', {
    query: { page, pageSize: MY_INQUIRIES_PAGE_SIZE },
    schema: myInquiryPageSchema,
    signal,
  });
}

/** GET /me/inquiries/:id — the thread; reading it marks the office's replies read. */
export function fetchMyInquiry(id: string, signal?: AbortSignal) {
  return api.get(`/me/inquiries/${encodeURIComponent(id)}`, {
    schema: myInquiryDetailSchema,
    signal,
  });
}

/**
 * POST /me/inquiries/:id/messages `{ message }` — a follow-up question in the same thread (the
 * office is notified and the inquiry is "새 문의" again). The page re-reads the thread afterwards,
 * so the response body is not needed.
 */
export function sendFollowUp(id: string, message: string) {
  return api.post(`/me/inquiries/${encodeURIComponent(id)}/messages`, { message });
}
