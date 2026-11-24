import { NextResponse, type NextRequest } from 'next/server';
import { SVG_HEADERS, mockScreenshotSvg } from '@/features/m-moderation/mock/art';
import { isBlocked, modGate } from '@/features/m-moderation/mock/handler';
import { mockNotFound } from '@/lib/mock';
import { reportsDb } from '../../../_fixtures';

// Mock-only stand-in for report evidence images (ASSUMED: attachments are not in reportCreateSchema yet).
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; attId: string }> },
) {
  const gate = await modGate(req);
  if (isBlocked(gate)) return gate;
  const { id, attId } = await ctx.params;
  const att = reportsDb()
    .find((r) => r.id === id)
    ?.attachments.find((a) => a.id === attId);
  if (!att) return mockNotFound();
  return new NextResponse(mockScreenshotSvg(att.lines), { headers: SVG_HEADERS });
}
