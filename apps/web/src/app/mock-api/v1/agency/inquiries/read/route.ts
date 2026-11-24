import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import { agencyGuard } from '../../deal-requests/_store';
import { inquiryStore, unreadInquiryCount } from '../_store';

// POST /api/v1/agency/inquiries/read (ASSUMED) — body `{ ids: string[] }` or `{ all: true }`.
export async function POST(req: NextRequest) {
  const g = agencyGuard(req, { mutation: true });
  if (g.fail) return g.fail;
  await mockDelay(req, 250);
  const body = (await req.json().catch(() => null)) as { ids?: unknown; all?: unknown } | null;
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((x): x is string => typeof x === 'string')
    : [];
  const all = body?.all === true;
  if (!all && ids.length === 0)
    return mockError(400, 'VALIDATION_FAILED', '읽음 처리할 문의를 선택해 주세요.', [
      { path: 'ids', message: '문의 ID가 필요합니다.' },
    ]);
  const now = new Date().toISOString();
  let updated = 0;
  for (const inquiry of inquiryStore().items) {
    if (!inquiry.readAt && (all || ids.includes(inquiry.id))) {
      inquiry.readAt = now;
      updated += 1;
    }
  }
  return mockJson({ updated, unreadCount: unreadInquiryCount() });
}
