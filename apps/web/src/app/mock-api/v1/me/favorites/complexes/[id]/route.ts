import { NextResponse, type NextRequest } from 'next/server';
import { mockDelay, mockNotFound } from '@/lib/mock';
import { findMeComplex } from '../../../_lookup';
import { meGuard } from '../../../_store';

type Ctx = { params: Promise<{ id: string }> };

// PUT /api/v1/me/favorites/complexes/:id — add (idempotent).
export async function PUT(req: NextRequest, ctx: Ctx) {
  const g = meGuard(req, { mutation: true });
  if (g.fail) return g.fail;
  await mockDelay(req);
  const { id } = await ctx.params;
  if (!findMeComplex(id)) return mockNotFound('COMPLEX_NOT_FOUND', '단지를 찾을 수 없습니다.');
  if (!g.state.favoriteComplexes.some((f) => f.id === id))
    g.state.favoriteComplexes.unshift({ id, at: new Date().toISOString() });
  return new NextResponse(null, { status: 204 });
}

// DELETE /api/v1/me/favorites/complexes/:id — remove (idempotent).
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const g = meGuard(req, { mutation: true });
  if (g.fail) return g.fail;
  await mockDelay(req);
  const { id } = await ctx.params;
  g.state.favoriteComplexes = g.state.favoriteComplexes.filter((f) => f.id !== id);
  return new NextResponse(null, { status: 204 });
}
