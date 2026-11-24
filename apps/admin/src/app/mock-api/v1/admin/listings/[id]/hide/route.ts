import type { NextRequest } from 'next/server';
import { moderateListingMock } from '../../_moderate';

// POST /api/v1/admin/listings/:id/hide (ASSUMED endpoint) — see ../../_moderate.ts.
export function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return moderateListingMock(req, ctx, 'hide');
}
