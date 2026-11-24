import type { NextRequest } from 'next/server';
import type { RegistryCheck } from '@/features/m-moderation/api/schemas';
import { isBlocked, modGate, nowIso } from '@/features/m-moderation/mock/handler';
import { mockDelay, mockJson, mockNotFound } from '@/lib/mock';
import { agenciesDb, toRegistryCheckView } from '../../_fixtures';

/**
 * GET /api/v1/admin/agencies/:id/registry-check(?refresh=1) → shared `AgencyRegistryCheck`.
 * Like the API: the cached result unless `refresh`, a fresh lookup otherwise (the mock turns an
 * UNAVAILABLE result into MATCH and only refreshes `checkedAt` of the others). Without any
 * previous result it looks up right away.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await modGate(req);
  if (isBlocked(gate)) return gate;
  const { id } = await ctx.params;
  const agency = agenciesDb().find((a) => a.id === id);
  if (!agency) return mockNotFound('AGENCY_NOT_FOUND', '중개사무소를 찾을 수 없습니다.');
  const refresh = ['1', 'true'].includes(req.nextUrl.searchParams.get('refresh') ?? '');
  const prev = agency.registryCheck;
  if (prev && !refresh) return mockJson(toRegistryCheckView(prev));
  await mockDelay(req, 900);

  const next: RegistryCheck =
    !prev || prev.status === 'UNAVAILABLE'
      ? {
          status: 'MATCHED',
          checkedAt: nowIso(),
          source: '국가공간정보 중개업소 조회',
          registry: {
            name: agency.name,
            representativeName: agency.representativeName,
            registrationNumber: agency.registrationNumber,
            roadAddress: null,
            businessStatus: '영업중',
            registeredAt: '2026-11-18',
          },
          mismatches: [],
          message: null,
        }
      : { ...prev, checkedAt: nowIso() };
  agency.registryCheck = next;
  agency.registryStatus = next.status;
  return mockJson(toRegistryCheckView(next));
}
