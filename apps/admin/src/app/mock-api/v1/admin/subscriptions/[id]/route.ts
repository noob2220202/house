import {
  ADMIN_ROLE_RANK,
  ERROR_MESSAGES,
  AdminRole,
  adminSubscriptionUpdateSchema,
} from '@house/shared';
import type { NextRequest } from 'next/server';
import { MOCK_ACTORS, isResponse, mockBody } from '@/features/m-content/mock/http';
import { audit } from '@/features/m-content/mock/store';
import { isBlocked, modGate, nowIso } from '@/features/m-moderation/mock/handler';
import { mockError, mockForbidden, mockJson, mockNotFound } from '@/lib/mock';
import { subscriptionsDb, toSubscriptionView } from '../../agency-sites/_fixtures';
import { agenciesDb } from '../../agencies/_fixtures';

// PATCH /api/v1/admin/subscriptions/:id (ADMIN+) — body = adminSubscriptionUpdateSchema: a new
// last day (`endsOn`, ≥ startsOn), the memo, or `{ cancel: true }` → `AgencySubscriptionView`;
// audit `subscription.update` / `subscription.cancel`.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await modGate(req, { mutation: true });
  if (isBlocked(gate)) return gate;
  if (ADMIN_ROLE_RANK[gate.role] < ADMIN_ROLE_RANK[AdminRole.ADMIN]) return mockForbidden();
  const { id } = await ctx.params;
  const row = subscriptionsDb().find((s) => s.id === id);
  if (!row)
    return mockNotFound(
      'AGENCY_SUBSCRIPTION_NOT_FOUND',
      ERROR_MESSAGES.AGENCY_SUBSCRIPTION_NOT_FOUND,
    );
  const body = await mockBody(req, adminSubscriptionUpdateSchema);
  if (isResponse(body)) return body;
  if (body.endsOn && body.endsOn < row.startsOn)
    return mockError(
      400,
      'AGENCY_SUBSCRIPTION_INVALID_PERIOD',
      ERROR_MESSAGES.AGENCY_SUBSCRIPTION_INVALID_PERIOD,
    );

  const before = { endsOn: row.endsOn, memo: row.memo, canceledAt: row.canceledAt };
  if (body.endsOn !== undefined) row.endsOn = body.endsOn;
  if (body.memo !== undefined) row.memo = body.memo;
  if (body.cancel) row.canceledAt ??= nowIso();
  audit({ role: gate.role, actor: MOCK_ACTORS[gate.role], sp: req.nextUrl.searchParams }, req, {
    action: body.cancel ? 'subscription.cancel' : 'subscription.update',
    resourceType: 'AgencySubscription',
    resourceId: row.id,
    resourceLabel: agenciesDb().find((a) => a.id === row.agencyId)?.name ?? null,
    before,
    after: { endsOn: row.endsOn, memo: row.memo, canceledAt: row.canceledAt },
  });
  return mockJson(toSubscriptionView(row));
}
