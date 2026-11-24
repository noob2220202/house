import type { NextRequest } from 'next/server';
import { INQUIRY_STATUSES, type InquiryStatus } from '@/features/a-inbox/api/schemas';
import { INQUIRY_MEMO_MAX } from '@/features/a-inbox/lib/inquiry';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import { agencyGuard } from '../../deal-requests/_store';
import { findInquiry, inquiryNotFound, MEMBER_NAME } from '../_store';

// GET /api/v1/agency/inquiries/:id (ASSUMED) — one inquiry (deep links from notifications).
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = agencyGuard(req);
  if (g.fail) return g.fail;
  await mockDelay(req, 200);
  const { id } = await ctx.params;
  const found = findInquiry(id);
  return found ? mockJson(found) : inquiryNotFound();
}

/**
 * PATCH /api/v1/agency/inquiries/:id (ASSUMED) — body `{ status?, memo?, read? }`.
 * `status` NEW | IN_PROGRESS | DONE, `memo` ≤ 1,000 chars (null clears it), `read: true` marks it
 * read. Changing status or memo records the member as the handler. → the updated inquiry.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = agencyGuard(req, { mutation: true });
  if (g.fail) return g.fail;
  await mockDelay(req, 300);
  const { id } = await ctx.params;
  const found = findInquiry(id);
  if (!found) return inquiryNotFound();
  const body = (await req.json().catch(() => null)) as {
    status?: unknown;
    memo?: unknown;
    read?: unknown;
  } | null;
  const invalid = (path: string, message: string) =>
    mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [{ path, message }]);
  if (!body || typeof body !== 'object') return invalid('', '변경할 내용을 보내 주세요.');

  if (body.status !== undefined) {
    if (!INQUIRY_STATUSES.includes(body.status as InquiryStatus))
      return invalid('status', '처리 상태가 올바르지 않습니다.');
    found.status = body.status as InquiryStatus;
    found.handledByName = MEMBER_NAME[g.role];
  }
  if (body.memo !== undefined) {
    if (body.memo !== null && typeof body.memo !== 'string')
      return invalid('memo', '메모 형식이 올바르지 않습니다.');
    const memo = typeof body.memo === 'string' ? body.memo.trim() : '';
    if (memo.length > INQUIRY_MEMO_MAX)
      return invalid(
        'memo',
        `메모는 ${INQUIRY_MEMO_MAX.toLocaleString('ko-KR')}자까지 쓸 수 있습니다.`,
      );
    found.memo = memo || null;
    found.handledByName = MEMBER_NAME[g.role];
  }
  if (body.read === true) found.readAt ??= new Date().toISOString();
  return mockJson(found);
}
