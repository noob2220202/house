import { NextResponse, type NextRequest } from 'next/server';
import { mockDelay, mockNotFound } from '@/lib/mock';
import { findMeListing } from '../../../_lookup';
import { meGuard } from '../../../_store';

type Ctx = { params: Promise<{ id: string }> };

// PUT /api/v1/me/favorites/listings/:id — add (idempotent).
export async function PUT(req: NextRequest, ctx: Ctx) {
  const g = meGuard(req, { mutation: true });
  if (g.fail) return g.fail;
  await mockDelay(req);
  const { id } = await ctx.params;
  if (!findMeListing(id)) return mockNotFound('LISTING_NOT_FOUND', '매물을 찾을 수 없습니다.');
  if (!g.state.favoriteListings.some((f) => f.id === id))
    g.state.favoriteListings.unshift({ id, at: new Date().toISOString() });
  return new NextResponse(null, { status: 204 });
}

// DELETE /api/v1/me/favorites/listings/:id — remove (idempotent).
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const g = meGuard(req, { mutation: true });
  if (g.fail) return g.fail;
  await mockDelay(req);
  const { id } = await ctx.params;
  g.state.favoriteListings = g.state.favoriteListings.filter((f) => f.id !== id);
  return new NextResponse(null, { status: 204 });
}
