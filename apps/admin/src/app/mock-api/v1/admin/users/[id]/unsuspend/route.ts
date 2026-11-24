import type { NextRequest } from 'next/server';
import {
  MOCK_ADMIN_NAME,
  isBlocked,
  modGate,
  newId,
  nowIso,
} from '@/features/m-moderation/mock/handler';
import { mockError, mockJson, mockNotFound } from '@/lib/mock';
import { usersDb } from '../../_fixtures';

// POST /api/v1/admin/users/:id/unsuspend — lift a suspension.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await modGate(req, { mutation: true });
  if (isBlocked(gate)) return gate;
  const { id } = await ctx.params;
  const user = usersDb().find((u) => u.id === id);
  if (!user) return mockNotFound('USER_NOT_FOUND', '회원을 찾을 수 없습니다.');
  if (user.status !== 'SUSPENDED')
    return mockError(409, 'USER_STATUS_CONFLICT', '정지 상태의 회원이 아닙니다.');

  user.status = 'ACTIVE';
  user.suspendedAt = null;
  user.suspendedReason = null;
  user.sanctions.unshift({
    id: newId('c4'),
    action: 'UNSUSPENDED',
    reason: null,
    adminName: MOCK_ADMIN_NAME[gate.role],
    createdAt: nowIso(),
  });
  return mockJson(user);
}
