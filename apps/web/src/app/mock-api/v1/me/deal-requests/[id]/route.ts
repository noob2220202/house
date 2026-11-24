import type { NextRequest } from 'next/server';
import { mockDelay, mockJson } from '@/lib/mock';
import { ownerGuard, requestNotFound } from '../../../deal-requests/_guard';
import { dealStore, requestDetailDto } from '../../../deal-requests/_store';

// GET /api/v1/me/deal-requests/:id — request + received proposals (owner only; 404 for others).
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const blocked = ownerGuard(req);
  if (blocked) return blocked;
  await mockDelay(req);
  const { id } = await ctx.params;
  const found = dealStore().requests.find((r) => r.id === id);
  return found ? mockJson(requestDetailDto(found)) : requestNotFound();
}
