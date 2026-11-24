import { NextResponse, type NextRequest } from 'next/server';
import { mockDelay } from '@/lib/mock';
import { ownerGuard, requestNotFound } from '../../../../../deal-requests/_guard';
import { dealStore } from '../../../../../deal-requests/_store';

// DELETE /api/v1/me/deal-requests/:id/contact-grants/:agencyId — revoke the contact grant.
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; agencyId: string }> },
) {
  const blocked = ownerGuard(req, { mutation: true });
  if (blocked) return blocked;
  await mockDelay(req, 300);
  const { id, agencyId } = await ctx.params;
  const found = dealStore().requests.find((r) => r.id === id);
  if (!found || !(agencyId in found.grants)) return requestNotFound();
  delete found.grants[agencyId];
  found.updatedAt = new Date().toISOString();
  return new NextResponse(null, { status: 204 });
}
