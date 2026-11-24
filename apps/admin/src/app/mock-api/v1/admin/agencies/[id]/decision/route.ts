import { AgencyStatus, agencyDecisionSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import {
  MOCK_ADMIN_NAME,
  isBlocked,
  modGate,
  newId,
  nowIso,
  readBody,
  validationError,
} from '@/features/m-moderation/mock/handler';
import { mockError, mockJson, mockNotFound } from '@/lib/mock';
import { agenciesDb, toAgencyDetailView } from '../../_fixtures';

const ALLOWED: Record<AgencyStatus, readonly AgencyStatus[]> = {
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: ['SUSPENDED'],
  REJECTED: ['APPROVED'],
  SUSPENDED: ['APPROVED'],
};

// POST /api/v1/admin/agencies/:id/decision — body = agencyDecisionSchema { status, reason? }.
// Rejection and suspension need a reason (shown to the applicant).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await modGate(req, { mutation: true });
  if (isBlocked(gate)) return gate;
  const { id } = await ctx.params;
  const agency = agenciesDb().find((a) => a.id === id);
  if (!agency) return mockNotFound('AGENCY_NOT_FOUND', '중개사무소를 찾을 수 없습니다.');

  const parsed = agencyDecisionSchema.safeParse(await readBody(req));
  if (!parsed.success) return validationError('status', '처리 상태가 올바르지 않습니다.');
  const { status, reason } = parsed.data;
  if (status !== AgencyStatus.APPROVED && !reason)
    return validationError('reason', '사유를 입력해 주세요.');
  if (!ALLOWED[agency.status].includes(status))
    return mockError(
      409,
      'AGENCY_STATUS_CONFLICT',
      '이미 처리된 신청이거나 변경할 수 없는 상태입니다.',
    );

  const now = nowIso();
  agency.statusHistory.unshift({
    id: newId('a8'),
    fromStatus: agency.status,
    toStatus: status,
    reason: reason ?? null,
    decidedByName: MOCK_ADMIN_NAME[gate.role],
    createdAt: now,
  });
  agency.status = status;
  agency.statusReason = status === AgencyStatus.APPROVED ? null : (reason ?? null);
  agency.updatedAt = now;
  if (status === AgencyStatus.APPROVED) {
    agency.approvedAt ??= now;
    agency.suspendedAt = null;
  }
  if (status === AgencyStatus.SUSPENDED) agency.suspendedAt = now;
  return mockJson(toAgencyDetailView(agency));
}
