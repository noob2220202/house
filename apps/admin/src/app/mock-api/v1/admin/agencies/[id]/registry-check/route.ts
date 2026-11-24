import type { NextRequest } from 'next/server';
import type { RegistryCheck } from '@/features/m-moderation/api/schemas';
import { isBlocked, modGate, nowIso } from '@/features/m-moderation/mock/handler';
import { mockDelay, mockJson, mockNotFound } from '@/lib/mock';
import { agenciesDb } from '../../_fixtures';

// POST /api/v1/admin/agencies/:id/registry-check — re-run the 국가공간정보 lookup (ASSUMED endpoint).
// The mock turns an UNAVAILABLE result into MATCHED and otherwise only refreshes `checkedAt`.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await modGate(req, { mutation: true });
  if (isBlocked(gate)) return gate;
  const { id } = await ctx.params;
  const agency = agenciesDb().find((a) => a.id === id);
  if (!agency) return mockNotFound('AGENCY_NOT_FOUND', '중개사무소를 찾을 수 없습니다.');
  await mockDelay(req, 900);

  const prev = agency.registryCheck;
  const full = `${agency.roadAddress}${agency.addressDetail ? `, ${agency.addressDetail}` : ''}`;
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
            roadAddress: full,
            businessStatus: '영업중',
            registeredAt: '2026-11-18',
          },
          mismatches: [],
          message: null,
        }
      : { ...prev, checkedAt: nowIso() };
  agency.registryCheck = next;
  agency.registryStatus = next.status;
  return mockJson(next);
}
