import { ADMIN_ROLE_RANK, AdminRole, adminSubscriptionCreateSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { MOCK_ACTORS, isResponse, mockBody } from '@/features/m-content/mock/http';
import { audit } from '@/features/m-content/mock/store';
import {
  MOCK_ADMIN_NAME,
  isBlocked,
  modGate,
  newId,
  nowIso,
} from '@/features/m-moderation/mock/handler';
import { mockForbidden, mockJson, mockNotFound } from '@/lib/mock';
import {
  subscriptionsDb,
  subscriptionsResponse,
  toSubscriptionView,
  type MockSubscriptionRow,
} from '../../../agency-sites/_fixtures';
import { agenciesDb } from '../../_fixtures';

// GET /api/v1/admin/agencies/:id/subscriptions → shared `AgencySubscriptionsResponse`.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await modGate(req);
  if (isBlocked(gate)) return gate;
  const { id } = await ctx.params;
  if (!agenciesDb().some((a) => a.id === id))
    return mockNotFound('AGENCY_NOT_FOUND', '중개사무소를 찾을 수 없습니다.');
  return mockJson(subscriptionsResponse(id));
}

// POST /api/v1/admin/agencies/:id/subscriptions (ADMIN+) — body = adminSubscriptionCreateSchema
// → 201 `AgencySubscriptionView`; audit `subscription.create`.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await modGate(req, { mutation: true });
  if (isBlocked(gate)) return gate;
  if (ADMIN_ROLE_RANK[gate.role] < ADMIN_ROLE_RANK[AdminRole.ADMIN]) return mockForbidden();
  const { id } = await ctx.params;
  const agency = agenciesDb().find((a) => a.id === id);
  if (!agency) return mockNotFound('AGENCY_NOT_FOUND', '중개사무소를 찾을 수 없습니다.');
  const body = await mockBody(req, adminSubscriptionCreateSchema);
  if (isResponse(body)) return body;

  const row: MockSubscriptionRow = {
    id: newId('a4'),
    agencyId: id,
    product: body.product,
    startsOn: body.startsOn,
    endsOn: body.endsOn ?? null,
    amountWon: body.amountWon ?? null,
    memo: body.memo ?? null,
    canceledAt: null,
    createdByName: MOCK_ADMIN_NAME[gate.role],
    createdAt: nowIso(),
  };
  subscriptionsDb().unshift(row);
  audit({ role: gate.role, actor: MOCK_ACTORS[gate.role], sp: req.nextUrl.searchParams }, req, {
    action: 'subscription.create',
    resourceType: 'AgencySubscription',
    resourceId: row.id,
    resourceLabel: agency.name,
    after: {
      product: row.product,
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      amountWon: row.amountWon,
      memo: row.memo,
    },
  });
  return mockJson(toSubscriptionView(row), { status: 201 });
}
