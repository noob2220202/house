import {
  ADMIN_ROLE_RANK,
  AdminRole,
  ERROR_MESSAGES,
  AgencySiteDecisionAction,
  AgencySiteStatus,
  adminAgencySiteDecisionSchema,
} from '@house/shared';
import type { NextRequest } from 'next/server';
import { MOCK_ACTORS, isResponse, mockBody } from '@/features/m-content/mock/http';
import { audit } from '@/features/m-content/mock/store';
import { isBlocked, modGate, nowIso } from '@/features/m-moderation/mock/handler';
import { mockError, mockJson, mockNotFound } from '@/lib/mock';
import { sitesDb, toSiteView } from '../../../../agency-sites/_fixtures';
import { agenciesDb } from '../../../_fixtures';

const FROM: Record<AgencySiteDecisionAction, AgencySiteStatus> = {
  APPROVE: AgencySiteStatus.REQUESTED,
  REJECT: AgencySiteStatus.REQUESTED,
  SUSPEND: AgencySiteStatus.ACTIVE,
  RESUME: AgencySiteStatus.SUSPENDED,
};
const TO: Record<AgencySiteDecisionAction, AgencySiteStatus> = {
  APPROVE: AgencySiteStatus.ACTIVE,
  REJECT: AgencySiteStatus.REJECTED,
  SUSPEND: AgencySiteStatus.SUSPENDED,
  RESUME: AgencySiteStatus.ACTIVE,
};
/**
 * Approving / rejecting a request is OPERATOR work; taking a live site down and bringing it back
 * needs ADMIN (the API's minRoleForSiteDecision).
 */
const MIN_ROLE: Record<AgencySiteDecisionAction, AdminRole> = {
  APPROVE: AdminRole.OPERATOR,
  REJECT: AdminRole.OPERATOR,
  SUSPEND: AdminRole.ADMIN,
  RESUME: AdminRole.ADMIN,
};

// POST /api/v1/admin/agencies/:id/site/decision — body = adminAgencySiteDecisionSchema:
// APPROVE (REQUESTED → ACTIVE, slug = body.slug ?? requestedSlug, 409 when taken), REJECT
// (REQUESTED → REJECTED, reason), SUSPEND (ACTIVE → SUSPENDED, reason), RESUME (SUSPENDED →
// ACTIVE; SUSPEND / RESUME need ADMIN+, 403 AGENCY_DECISION_FORBIDDEN below). Answers `{ site }`
// like the GET and writes an audit row (`agency_site.<action>`).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await modGate(req, { mutation: true });
  if (isBlocked(gate)) return gate;
  const { id } = await ctx.params;
  // Like the API: body validation, then the role (before any lookup), then 404s.
  const body = await mockBody(req, adminAgencySiteDecisionSchema);
  if (isResponse(body)) return body;
  if (ADMIN_ROLE_RANK[gate.role] < ADMIN_ROLE_RANK[MIN_ROLE[body.action]])
    return mockError(403, 'AGENCY_DECISION_FORBIDDEN', ERROR_MESSAGES.AGENCY_DECISION_FORBIDDEN);
  const agency = agenciesDb().find((a) => a.id === id);
  if (!agency) return mockNotFound('AGENCY_NOT_FOUND', '중개사무소를 찾을 수 없습니다.');
  const row = sitesDb().find((s) => s.agencyId === id);
  if (!row) return mockNotFound('AGENCY_SITE_NOT_FOUND', ERROR_MESSAGES.AGENCY_SITE_NOT_FOUND);

  if (row.status !== FROM[body.action])
    return mockError(
      409,
      'AGENCY_SITE_INVALID_TRANSITION',
      ERROR_MESSAGES.AGENCY_SITE_INVALID_TRANSITION,
    );

  const before = { status: row.status, slug: row.slug, decisionReason: row.decisionReason };
  if (body.action === AgencySiteDecisionAction.APPROVE) {
    const slug = body.slug ?? row.requestedSlug;
    if (!slug)
      return mockError(400, 'AGENCY_SITE_SLUG_INVALID', ERROR_MESSAGES.AGENCY_SITE_SLUG_INVALID);
    // The API's siteSlugTaken: another office holds it as its slug or as an open request.
    const taken = sitesDb().some(
      (s) =>
        s.agencyId !== id &&
        (s.slug === slug || (s.status === AgencySiteStatus.REQUESTED && s.requestedSlug === slug)),
    );
    if (taken)
      return mockError(
        409,
        'AGENCY_SITE_SLUG_DUPLICATE',
        ERROR_MESSAGES.AGENCY_SITE_SLUG_DUPLICATE,
      );
    // A new address needs a new certificate (deploy/sites.sh issues it — simulated: 1 minute).
    if (slug !== row.slug) row.httpsReadyAt = new Date(Date.now() + 60_000).toISOString();
    row.slug = slug; // requestedSlug keeps what the office asked for, as in the API
  }
  const now = nowIso();
  row.status = TO[body.action];
  row.decisionReason = body.reason ?? null;
  row.decidedAt = now;
  row.updatedAt = now;

  audit({ role: gate.role, actor: MOCK_ACTORS[gate.role], sp: req.nextUrl.searchParams }, req, {
    action: `agency_site.${body.action.toLowerCase()}`,
    resourceType: 'AgencySite',
    resourceId: row.id,
    resourceLabel: agency.name,
    before,
    after: { status: row.status, slug: row.slug, decisionReason: row.decisionReason },
  });
  return mockJson({ site: toSiteView(row) });
}
