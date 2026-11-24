import { contactGrantSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import { ownerGuard, requestClosed, requestNotFound } from '../../../../deal-requests/_guard';
import { dealStore, findAgency } from '../../../../deal-requests/_store';

// POST /api/v1/me/deal-requests/:id/contact-grants { agencyId } — reveal the contact to one agency.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const blocked = ownerGuard(req, { mutation: true });
  if (blocked) return blocked;
  await mockDelay(req, 300);
  const { id } = await ctx.params;
  const found = dealStore().requests.find((r) => r.id === id);
  if (!found) return requestNotFound();
  if (found.status !== 'OPEN' && found.status !== 'MATCHED') return requestClosed();
  const parsed = contactGrantSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !found.proposals.some((p) => p.agencyId === parsed.data.agencyId)) {
    return mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
      { path: 'agencyId', message: '이 요청에 제안한 중개사무소가 아닙니다.' },
    ]);
  }
  const grantedAt = new Date().toISOString();
  found.grants[parsed.data.agencyId] = grantedAt;
  found.updatedAt = grantedAt;
  // ContactGrantView
  return mockJson(
    {
      agencyId: parsed.data.agencyId,
      agencyName: findAgency(parsed.data.agencyId)?.name ?? null,
      grantedAt,
    },
    { status: 201 },
  );
}
