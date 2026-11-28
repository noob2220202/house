import { inquiryReplySchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockJson } from '@/lib/mock';
import {
  MEMBER_NAME,
  inquiryNotFound,
  memberGuard,
  myInquiries,
  myInquiryDetail,
  notifyOffice,
  validationFailed,
} from '../../../../inquiries/_store';

/**
 * POST /api/v1/me/inquiries/:id/messages `{ message }` — a follow-up in the same thread: the
 * inquiry becomes 새 문의 again (unread for the office) and the office is notified
 * (`INQUIRY_RECEIVED`, `followUp: true`). → 201 with the updated thread.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = memberGuard(req, { mutation: true });
  if (g.fail) return g.fail;
  await mockDelay(req, 300);
  const { id } = await ctx.params;
  const found = myInquiries(g.role).find((i) => i.id === id);
  if (!found) return inquiryNotFound();
  const parsed = inquiryReplySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return validationFailed(parsed.error.issues);
  const now = new Date().toISOString();
  found.messages.push({
    id: `${found.id}-m${found.messages.length + 1}`,
    author: 'CUSTOMER',
    body: parsed.data.message,
    authorName: found.customerName ?? MEMBER_NAME[g.role],
    createdAt: now,
  });
  found.status = 'NEW';
  found.readAt = null;
  found.customerReadAt = now;
  found.lastMessageAt = now;
  found.updatedAt = now;
  notifyOffice(found, true);
  return mockJson(myInquiryDetail(found), { status: 201 });
}
