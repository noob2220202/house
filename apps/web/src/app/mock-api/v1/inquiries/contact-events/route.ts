import { INQUIRY_LIMITS, inquiryContactEventSchema } from '@house/shared';
import { NextResponse, type NextRequest } from 'next/server';
import { mockDelay, mockError } from '@/lib/mock';
import { findAgencySummary } from '../../agencies/_fixtures';
import { inquiryStore, listingRef, publicGuard, validationFailed } from '../_store';

const WINDOW_MS = INQUIRY_LIMITS.CONTACT_EVENT_DEDUPE_HOURS * 60 * 60_000;

/**
 * POST /api/v1/inquiries/contact-events — 전화 / 문자 / 번호 복사 pressed. Logged as a CALL / SMS /
 * COPY row of the office's 문의함 (no PII, status DONE, already read), at most once per
 * visitor + office + listing + channel in 6 hours. No notification. → 204.
 */
export async function POST(req: NextRequest) {
  const g = publicGuard(req);
  if (g.fail) return g.fail;
  await mockDelay(req, 80);
  const parsed = inquiryContactEventSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return validationFailed(parsed.error.issues);
  const body = parsed.data;
  if (!findAgencySummary(body.agencyId)) {
    return mockError(
      404,
      'INQUIRY_AGENCY_NOT_FOUND',
      '문의를 받을 수 있는 중개사무소를 찾을 수 없습니다.',
    );
  }
  const store = inquiryStore();
  const key = [g.role ?? 'guest', body.agencyId, body.listingId ?? '-', body.channel].join(':');
  const now = Date.now();
  const last = store.contactSeen[key];
  if (last === undefined || now - last >= WINDOW_MS) {
    store.contactSeen[key] = now;
    const at = new Date(now).toISOString();
    store.items.push({
      id: `inq-c${now.toString(36)}`,
      agencyId: body.agencyId,
      listing: body.listingId ? listingRef(body.listingId) : null,
      owner: null,
      member: g.role !== null,
      channel: body.channel,
      // A log line, like the API: DONE, so it never fills the 새 문의 tab.
      status: 'DONE',
      source: body.source,
      // No name at all: the visitor gave no consent (the API stores null for members too).
      customerName: null,
      customerPhone: null,
      message: null,
      memo: null,
      handledByName: null,
      // Logged as read (the API stores readAt = createdAt): never counts toward 안 읽은 문의.
      readAt: at,
      customerReadAt: null,
      lastMessageAt: at,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
      deleteReason: null,
      messages: [],
    });
  }
  return new NextResponse(null, { status: 204 });
}
