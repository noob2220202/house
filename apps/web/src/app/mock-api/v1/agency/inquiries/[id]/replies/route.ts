import { inquiryReplySchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import {
  MEMBER_NAME,
  agencyInquiryView,
  findOfficeInquiry,
  inquiryNotFound,
  notifyCustomer,
  validationFailed,
} from '../../../../inquiries/_store';
import { agencyGuard } from '../../../deal-requests/_store';

/**
 * POST /api/v1/agency/inquiries/:id/replies `{ message }` — the office's answer. Only for rows
 * with `canReply` (texts of members), else 409 INQUIRY_REPLY_NOT_ALLOWED. 새 문의 → 응대 중, the
 * row is marked read and the member is notified (`INQUIRY_REPLIED`). → 201 with the thread.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = agencyGuard(req, { mutation: true });
  if (g.fail) return g.fail;
  await mockDelay(req, 350);
  const { id } = await ctx.params;
  const found = findOfficeInquiry(id);
  if (!found) return inquiryNotFound();
  if (!agencyInquiryView(found).canReply) {
    return mockError(
      409,
      'INQUIRY_REPLY_NOT_ALLOWED',
      '이 문의에는 답변을 남길 수 없습니다. 남겨 주신 연락처로 직접 연락해 주세요.',
    );
  }
  const parsed = inquiryReplySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return validationFailed(parsed.error.issues);
  const now = new Date().toISOString();
  found.messages.push({
    id: `${found.id}-m${found.messages.length + 1}`,
    author: 'AGENCY',
    body: parsed.data.message,
    authorName: MEMBER_NAME[g.role],
    createdAt: now,
  });
  if (found.status === 'NEW') found.status = 'IN_PROGRESS';
  found.readAt ??= now;
  found.handledByName = MEMBER_NAME[g.role];
  found.lastMessageAt = now;
  found.updatedAt = now;
  notifyCustomer(found);
  return mockJson(agencyInquiryView(found, true), { status: 201 });
}
