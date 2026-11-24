import type { NextRequest } from 'next/server';
import { isBlocked, matches, modGate } from '@/features/m-moderation/mock/handler';
import { mockJson, mockPaginate } from '@/lib/mock';
import { toUserListItem, usersDb } from './_fixtures';

// GET /api/v1/admin/users?q&status&role&provider&page&pageSize — member search (newest first).
export async function GET(req: NextRequest) {
  const gate = await modGate(req);
  if (isBlocked(gate)) return gate;
  const sp = req.nextUrl.searchParams;
  const status = sp.get('status');
  const role = sp.get('role');
  const provider = sp.get('provider');
  const q = sp.get('q') ?? '';
  const rows = usersDb()
    .filter((u) => !status || u.status === status)
    .filter((u) => !role || u.role === role)
    .filter((u) => !provider || u.providers.some((p) => p === provider))
    .filter((u) => matches(q, u.name, u.nickname, u.email, u.phone, u.agency?.name))
    .map(toUserListItem);
  return mockJson(mockPaginate(rows, req));
}
