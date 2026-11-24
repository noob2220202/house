import type { NextRequest } from 'next/server';
import { mockDelay, mockJson } from '@/lib/mock';
import { ownerGuard, requestClosed, requestNotFound } from '../../../../deal-requests/_guard';
import { dealStore, requestDetailDto } from '../../../../deal-requests/_store';

// POST /api/v1/me/deal-requests/:id/cancel — OPEN/MATCHED → CANCELLED (409 when already ended).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const blocked = ownerGuard(req, { mutation: true });
  if (blocked) return blocked;
  await mockDelay(req, 300);
  const { id } = await ctx.params;
  const found = dealStore().requests.find((r) => r.id === id);
  if (!found) return requestNotFound();
  if (found.status !== 'OPEN' && found.status !== 'MATCHED') return requestClosed();
  const now = new Date().toISOString();
  found.status = 'CANCELLED';
  found.closedAt = now;
  found.updatedAt = now;
  return mockJson(requestDetailDto(found));
}
