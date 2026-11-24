import type { NextRequest } from 'next/server';
import {
  MOCK_ADMIN_NAME,
  isBlocked,
  modGate,
  nowIso,
  readBody,
  readText,
  validationError,
} from '@/features/m-moderation/mock/handler';
import { mockError, mockJson, mockNotFound } from '@/lib/mock';
import { addDealRequestHistory, dealRequestsDb } from '../../_fixtures';

// POST /api/v1/admin/deal-requests/:id/close (ASSUMED endpoint) — body { reason }. OPEN | MATCHED → CLOSED.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await modGate(req, { mutation: true });
  if (isBlocked(gate)) return gate;
  const { id } = await ctx.params;
  const row = dealRequestsDb().find((r) => r.id === id);
  if (!row) return mockNotFound('DEAL_REQUEST_NOT_FOUND', '요청을 찾을 수 없습니다.');
  const reason = readText(await readBody(req), 'reason');
  if (reason.length < 5) return validationError('reason', '종료 사유를 5자 이상 입력해 주세요.');
  if (row.status !== 'OPEN' && row.status !== 'MATCHED')
    return mockError(409, 'DEAL_REQUEST_NOT_OPEN', '이미 종료된 요청입니다.');

  row.status = 'CLOSED';
  row.closedAt = nowIso();
  row.closeReason = reason;
  addDealRequestHistory(row, 'DEAL_REQUEST_CLOSED', MOCK_ADMIN_NAME[gate.role], reason);
  return mockJson(row);
}
