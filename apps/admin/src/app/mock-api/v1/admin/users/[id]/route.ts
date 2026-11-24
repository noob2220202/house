import type { NextRequest } from 'next/server';
import { isBlocked, modGate } from '@/features/m-moderation/mock/handler';
import { mockJson, mockNotFound } from '@/lib/mock';
import { usersDb } from '../_fixtures';

// GET /api/v1/admin/users/:id — member detail with identities + consents (ASSUMED endpoint).
// Personal data: the real endpoint writes an audit-log entry (USER_VIEWED) for every read.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await modGate(req);
  if (isBlocked(gate)) return gate;
  const { id } = await ctx.params;
  const user = usersDb().find((u) => u.id === id);
  if (!user) return mockNotFound('USER_NOT_FOUND', '회원을 찾을 수 없습니다.');
  return mockJson(user);
}
