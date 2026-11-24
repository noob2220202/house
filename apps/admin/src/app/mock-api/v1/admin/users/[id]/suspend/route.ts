import type { NextRequest } from 'next/server';
import {
  MOCK_ADMIN_NAME,
  isBlocked,
  modGate,
  newId,
  nowIso,
  readBody,
  readText,
  validationError,
} from '@/features/m-moderation/mock/handler';
import { mockError, mockJson, mockNotFound } from '@/lib/mock';
import { usersDb } from '../../_fixtures';

// POST /api/v1/admin/users/:id/suspend — body { reason }. Destroys the member's sessions.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await modGate(req, { mutation: true });
  if (isBlocked(gate)) return gate;
  const { id } = await ctx.params;
  const user = usersDb().find((u) => u.id === id);
  if (!user) return mockNotFound('USER_NOT_FOUND', '회원을 찾을 수 없습니다.');
  const reason = readText(await readBody(req), 'reason');
  if (reason.length < 5) return validationError('reason', '정지 사유를 5자 이상 입력해 주세요.');
  if (reason.length > 500)
    return validationError('reason', '정지 사유는 500자 이내로 입력해 주세요.');
  if (user.status !== 'ACTIVE')
    return mockError(409, 'USER_STATUS_CONFLICT', '이미 정지되었거나 탈퇴한 회원입니다.');

  const now = nowIso();
  user.status = 'SUSPENDED';
  user.suspendedAt = now;
  user.suspendedReason = reason;
  if (user.activity) user.activity.activeSessionCount = 0;
  user.sanctions.unshift({
    id: newId('c4'),
    action: 'SUSPENDED',
    reason,
    adminName: MOCK_ADMIN_NAME[gate.role],
    createdAt: now,
  });
  return mockJson(user);
}
