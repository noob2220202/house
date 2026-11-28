import { agencyInquiryReadAllSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockJson } from '@/lib/mock';
import { officeInquiries, unreadOfficeCount, validationFailed } from '../../../inquiries/_store';
import { agencyGuard } from '../../deal-requests/_store';

/** POST /api/v1/agency/inquiries/read `{ all: true }` → `{ updated, unreadCount }`. */
export async function POST(req: NextRequest) {
  const g = agencyGuard(req, { mutation: true });
  if (g.fail) return g.fail;
  await mockDelay(req, 250);
  const parsed = agencyInquiryReadAllSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return validationFailed(parsed.error.issues);
  const now = new Date().toISOString();
  let updated = 0;
  for (const i of officeInquiries()) {
    if (!i.readAt) {
      i.readAt = now;
      updated += 1;
    }
  }
  return mockJson({ updated, unreadCount: unreadOfficeCount() });
}
