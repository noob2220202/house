import type { NextRequest } from 'next/server';
import { mockDelay, mockJson } from '@/lib/mock';
import { adminGuard } from '../banners/_guard';
import { SLOT_ORDER } from '../banners/_store';
import { toSlotRow } from './_slots';

// GET /api/v1/admin/banner-slots — every slot with its spec, limit and live counts.
// The ads README lists this as ADMIN+; m-ads assumes OPERATOR may READ it (the list page needs the
// limits) and only PATCH is ADMIN+. The UI falls back to BANNER_SLOT_SPECS when this answers 403.
export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;
  await mockDelay(req, 120);
  return mockJson({ items: SLOT_ORDER.map(toSlotRow) });
}
