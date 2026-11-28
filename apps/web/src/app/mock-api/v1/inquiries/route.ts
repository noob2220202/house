import { INQUIRY_LIMITS, inquiryCreateSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import { findAgencySummary } from '../agencies/_fixtures';
import {
  forcedFailure,
  inquiryStore,
  kstDay,
  listingRef,
  notifyOffice,
  publicGuard,
  validationFailed,
  type MockInquiry,
} from './_store';

/**
 * POST /api/v1/inquiries — a written inquiry to an office (`inquiryCreateSchema`), members and
 * guests. Like the API: honeypot `website` → 400 INQUIRY_REJECTED, unknown office → 404
 * INQUIRY_AGENCY_NOT_FOUND, unknown listing → 404 INQUIRY_LISTING_NOT_FOUND, guest without a phone
 * → 400 INQUIRY_PHONE_REQUIRED, more than 10 a day → 429 INQUIRY_DAILY_LIMIT. The mock only
 * requires the consent entry (it does not compare versions). → 201 `InquiryCreated`.
 * Dev: `?_fail=1`.
 */
export async function POST(req: NextRequest) {
  const g = publicGuard(req);
  if (g.fail) return g.fail;
  await mockDelay(req, 400);
  const forced = forcedFailure(req);
  if (forced) return forced;

  const parsed = inquiryCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return validationFailed(parsed.error.issues);
  const body = parsed.data;
  if (body.website) {
    return mockError(
      400,
      'INQUIRY_REJECTED',
      '문의를 보낼 수 없습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  if (!findAgencySummary(body.agencyId)) {
    return mockError(
      404,
      'INQUIRY_AGENCY_NOT_FOUND',
      '문의를 받을 수 있는 중개사무소를 찾을 수 없습니다.',
    );
  }
  const listing = body.listingId ? listingRef(body.listingId) : null;
  if (body.listingId && !listing) {
    return mockError(
      404,
      'INQUIRY_LISTING_NOT_FOUND',
      '문의할 매물을 찾을 수 없습니다. 이미 거래가 끝났을 수 있어요.',
    );
  }
  const member = g.role !== null;
  if (!member && !body.phone) {
    return mockError(400, 'INQUIRY_PHONE_REQUIRED', '답변을 받을 연락처를 입력해 주세요.');
  }

  const store = inquiryStore();
  const cap = `${g.role ?? 'guest'}:${kstDay()}`;
  if ((store.sentToday[cap] ?? 0) >= INQUIRY_LIMITS.DAILY_CAP) {
    return mockError(
      429,
      'INQUIRY_DAILY_LIMIT',
      '오늘 보낼 수 있는 문의 수를 모두 사용했습니다. 내일 다시 시도해 주세요.',
    );
  }
  store.sentToday[cap] = (store.sentToday[cap] ?? 0) + 1;

  const now = new Date().toISOString();
  const inquiry: MockInquiry = {
    id: `inq-${Date.now().toString(36)}`,
    agencyId: body.agencyId,
    listing,
    owner: g.role,
    member,
    channel: 'MESSAGE',
    status: 'NEW',
    source: body.source,
    customerName: body.name,
    customerPhone: body.phone ?? null,
    message: body.message,
    memo: null,
    handledByName: null,
    readAt: null,
    customerReadAt: null,
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deleteReason: null,
    messages: [],
  };
  store.items.push(inquiry);
  notifyOffice(inquiry);
  return mockJson({ id: inquiry.id, createdAt: now, member }, { status: 201 });
}
