import { REPORT_REASON_LABEL, reportResolveSchema } from '@house/shared';
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
import { warnAgency } from '../../../agencies/_fixtures';
import { hideListing, listingsDb } from '../../../listings/_fixtures';
import { reportsDb, syncListingReports, toReportDetail } from '../../_fixtures';

// POST /api/v1/admin/reports/:id/resolve — body = reportResolveSchema { status, action, note? }.
// RECEIVED / IN_REVIEW → RESOLVED (with an action) / REJECTED; the shared schema no longer takes
// IN_REVIEW as a target status. Side effects mirror the backend:
// LISTING_HIDDEN hides the listing, AGENCY_WARNED adds an AgencyWarning.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await modGate(req, { mutation: true });
  if (isBlocked(gate)) return gate;
  const { id } = await ctx.params;
  const report = reportsDb().find((r) => r.id === id);
  if (!report) return mockNotFound('REPORT_NOT_FOUND', '신고를 찾을 수 없습니다.');

  const parsed = reportResolveSchema.safeParse(await readBody(req));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return validationError(
      String(issue?.path[0] ?? 'status'),
      issue?.message ?? '입력값을 확인해 주세요.',
    );
  }
  const { status, action, note } = parsed.data;
  if (report.status === 'RESOLVED' || report.status === 'REJECTED')
    return mockError(409, 'REPORT_ALREADY_HANDLED', '이미 처리된 신고입니다.');
  const hides = action === 'LISTING_HIDDEN' || action === 'LISTING_HIDDEN_AGENCY_WARNED';
  const warns = action === 'AGENCY_WARNED' || action === 'LISTING_HIDDEN_AGENCY_WARNED';
  if (status === 'RESOLVED' && hides && !report.listingId)
    return validationError('action', '중개사무소 신고에는 매물 숨김을 선택할 수 없습니다.');

  const admin = MOCK_ADMIN_NAME[gate.role];
  const now = nowIso();
  report.status = status;
  report.handledByName = admin;
  if (note) report.resolutionNote = note;
  report.timeline.unshift({
    id: newId('e4'),
    status,
    note: note ?? null,
    adminName: admin,
    createdAt: now,
  });

  report.handledAt = now;
  report.action = status === 'RESOLVED' ? action : 'NONE';
  const reasonText = `허위매물 신고 확인: ${REPORT_REASON_LABEL[report.reason]}${note ? ` — ${note}` : ''}`;
  const listing = report.listingId
    ? listingsDb().find((l) => l.id === report.listingId)
    : undefined;
  if (
    status === 'RESOLVED' &&
    hides &&
    listing &&
    listing.status !== 'HIDDEN' &&
    listing.status !== 'CLOSED'
  )
    hideListing(listing, reasonText, admin);
  if (status === 'RESOLVED' && warns) {
    const agencyId = report.agencyId ?? listing?.primaryAgency.id;
    if (agencyId) warnAgency(agencyId, reasonText, report.id, admin);
  }
  if (report.listingId) syncListingReports(report.listingId);
  return mockJson(toReportDetail(report));
}
