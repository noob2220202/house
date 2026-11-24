import type { NextRequest } from 'next/server';
import { isBlocked, modGate } from '@/features/m-moderation/mock/handler';
import { mockJson, mockNotFound } from '@/lib/mock';
import { dealRequestsDb } from '../_fixtures';

// GET /api/v1/admin/deal-requests/:id (ASSUMED endpoint) — request with the requester's contact
// (personal data: the real endpoint audit-logs the read), targets, proposals and contact grants.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await modGate(req);
  if (isBlocked(gate)) return gate;
  const { id } = await ctx.params;
  const row = dealRequestsDb().find((r) => r.id === id);
  if (!row) return mockNotFound('DEAL_REQUEST_NOT_FOUND', '요청을 찾을 수 없습니다.');
  return mockJson(row);
}
