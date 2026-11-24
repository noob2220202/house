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
import { mockJson, mockNotFound } from '@/lib/mock';
import { addDealRequestHistory, dealRequestsDb } from '../../_fixtures';

// POST /api/v1/admin/deal-requests/:id/spam-flag (ASSUMED endpoint) — body { flagged, reason? }.
// A flagged request is hidden from every agency until the flag is cleared.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await modGate(req, { mutation: true });
  if (isBlocked(gate)) return gate;
  const { id } = await ctx.params;
  const row = dealRequestsDb().find((r) => r.id === id);
  if (!row) return mockNotFound('DEAL_REQUEST_NOT_FOUND', '요청을 찾을 수 없습니다.');
  const body = await readBody(req);
  if (typeof body.flagged !== 'boolean')
    return validationError('flagged', '표시 여부가 올바르지 않습니다.');
  const reason = readText(body, 'reason');
  if (body.flagged && reason.length < 5)
    return validationError('reason', '사유를 5자 이상 입력해 주세요.');

  const admin = MOCK_ADMIN_NAME[gate.role];
  if (body.flagged) {
    row.spamFlaggedAt = nowIso();
    row.spamReason = reason;
    addDealRequestHistory(row, 'DEAL_REQUEST_SPAM_FLAGGED', admin, reason);
  } else {
    row.spamFlaggedAt = null;
    row.spamReason = null;
    addDealRequestHistory(row, 'DEAL_REQUEST_SPAM_CLEARED', admin, reason || null);
  }
  return mockJson(row);
}
