import type { NextRequest } from 'next/server';
import { isBlocked, modGate } from '@/features/m-moderation/mock/handler';
import { mockJson, mockNotFound } from '@/lib/mock';
import { sitesDb, toSiteView } from '../../../agency-sites/_fixtures';
import { agenciesDb } from '../../_fixtures';

// GET /api/v1/admin/agencies/:id/site → shared `AdminAgencySiteResponse` ({ site: null } when the
// office never asked for a 사무소 홈페이지).
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await modGate(req);
  if (isBlocked(gate)) return gate;
  const { id } = await ctx.params;
  if (!agenciesDb().some((a) => a.id === id))
    return mockNotFound('AGENCY_NOT_FOUND', '중개사무소를 찾을 수 없습니다.');
  const row = sitesDb().find((s) => s.agencyId === id);
  return mockJson({ site: row ? toSiteView(row) : null });
}
