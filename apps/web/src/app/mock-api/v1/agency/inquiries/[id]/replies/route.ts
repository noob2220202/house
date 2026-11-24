import type { NextRequest } from 'next/server';
import { INQUIRY_REPLY_MAX } from '@/features/a-inbox/lib/inquiry';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import { agencyGuard } from '../../../deal-requests/_store';
import { findInquiry, inquiryNotFound, MEMBER_NAME } from '../../_store';

/**
 * POST /api/v1/agency/inquiries/:id/replies (ASSUMED) — body `{ message }` (1…1,000 chars).
 * Only for inquiries with `canReply` (messages left on the site). A new inquiry moves to
 * IN_PROGRESS and is marked read. → the updated inquiry.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = agencyGuard(req, { mutation: true });
  if (g.fail) return g.fail;
  await mockDelay(req, 400);
  const { id } = await ctx.params;
  const found = findInquiry(id);
  if (!found) return inquiryNotFound();
  if (!found.canReply) return mockError(409, 'CONFLICT', '답변을 보낼 수 없는 문의입니다.');
  const body = (await req.json().catch(() => null)) as { message?: unknown } | null;
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (message.length === 0 || message.length > INQUIRY_REPLY_MAX)
    return mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
      {
        path: 'message',
        message:
          message.length === 0
            ? '답변 내용을 입력해 주세요.'
            : `답변은 ${INQUIRY_REPLY_MAX.toLocaleString('ko-KR')}자까지 쓸 수 있습니다.`,
      },
    ]);
  const now = new Date().toISOString();
  found.replies.push({
    id: `${found.id}-reply-${found.replies.length + 1}`,
    message,
    memberName: MEMBER_NAME[g.role],
    createdAt: now,
  });
  found.readAt ??= now;
  found.handledByName = MEMBER_NAME[g.role];
  if (found.status === 'NEW') found.status = 'IN_PROGRESS';
  return mockJson(found, { status: 201 });
}
