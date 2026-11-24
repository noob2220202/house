import { NextResponse, type NextRequest } from 'next/server';
import { mockDelay, mockNotFound } from '@/lib/mock';
import { findAgencySummary } from '../../../../agencies/_fixtures';
import { meGuard } from '../../../_store';
import { favoriteAgencies } from '../_store';

type Ctx = { params: Promise<{ id: string }> };

// PUT /api/v1/me/favorites/agencies/:id — add (idempotent). ASSUMED (w-agencies).
export async function PUT(req: NextRequest, ctx: Ctx) {
  const g = meGuard(req, { mutation: true });
  if (g.fail) return g.fail;
  await mockDelay(req);
  const { id } = await ctx.params;
  const agency = findAgencySummary(id);
  if (!agency) return mockNotFound('AGENCY_NOT_FOUND', '중개사무소를 찾을 수 없습니다.');
  const list = favoriteAgencies(g.role);
  if (!list.some((f) => f.id === agency.id))
    list.unshift({ id: agency.id, at: new Date().toISOString() });
  return new NextResponse(null, { status: 204 });
}

// DELETE /api/v1/me/favorites/agencies/:id — remove (idempotent). ASSUMED (w-agencies).
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const g = meGuard(req, { mutation: true });
  if (g.fail) return g.fail;
  await mockDelay(req);
  const { id } = await ctx.params;
  const canonical = findAgencySummary(id)?.id ?? id;
  const list = favoriteAgencies(g.role);
  const index = list.findIndex((f) => f.id === canonical);
  if (index >= 0) list.splice(index, 1);
  return new NextResponse(null, { status: 204 });
}
