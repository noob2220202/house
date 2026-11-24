import type { NextRequest } from 'next/server';
import { isBlocked, modGate } from '@/features/m-moderation/mock/handler';
import { mockJson, mockNotFound } from '@/lib/mock';
import { agenciesDb, toAgencyDetailView } from '../_fixtures';

// GET /api/v1/admin/agencies/:id → shared `AdminAgencyDetail` (documents, history, members,
// warnings; the registry check is GET …/registry-check).
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await modGate(req);
  if (isBlocked(gate)) return gate;
  const { id } = await ctx.params;
  const agency = agenciesDb().find((a) => a.id === id);
  if (!agency) return mockNotFound('AGENCY_NOT_FOUND', '중개사무소를 찾을 수 없습니다.');
  return mockJson(toAgencyDetailView(agency));
}
