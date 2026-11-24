import { NextResponse, type NextRequest } from 'next/server';
import { mockError, mockGuard } from '@/lib/mock';
import { REJECT_REASON, SUSPEND_REASON, ago, seedApplicant } from '../_fixtures';
import { agencyState, mockId, resetAgencyState } from '../_store';

const STATUSES = ['NONE', 'PENDING', 'PENDING_DOCS', 'REJECTED', 'APPROVED', 'SUSPENDED'] as const;
type DevStatus = (typeof STATUSES)[number];

/**
 * MOCK ONLY (no backend counterpart) — puts the mock USER's agency application into a given
 * state so every screen of /agent/apply can be opened:
 *   /mock-api/v1/agencies/mine/dev-state?status=NONE|PENDING|PENDING_DOCS|REJECTED|APPROVED|SUSPENDED
 *     [&dashboard=empty|full] [&reset=1] [&returnTo=/agent/apply]
 * `reset=1` restores every agencies fixture (office, members) first.
 */
export function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  const sp = req.nextUrl.searchParams;
  const state = sp.get('reset') === '1' ? resetAgencyState() : agencyState();

  const status = sp.get('status') as DevStatus | null;
  if (status && !STATUSES.includes(status)) {
    return mockError(400, 'VALIDATION_FAILED', `status must be one of ${STATUSES.join(', ')}`);
  }
  if (status === 'NONE') state.applicant = null;
  else if (status) {
    const app = seedApplicant();
    const hist = (toStatus: 'APPROVED' | 'REJECTED' | 'SUSPENDED', reason: string | null) => ({
      id: mockId('hist'),
      fromStatus: 'PENDING' as const,
      toStatus,
      reason,
      createdAt: ago(2 * 60 * 60 * 1000),
    });
    if (status === 'PENDING_DOCS') {
      app.documents = app.documents.filter((d) => d.type === 'REGISTRATION_CERT');
    } else if (status === 'REJECTED') {
      app.status = 'REJECTED';
      app.statusReason = REJECT_REASON;
      app.statusHistory = [hist('REJECTED', REJECT_REASON), ...app.statusHistory];
    } else if (status === 'APPROVED') {
      app.status = 'APPROVED';
      app.approvedAt = ago(2 * 60 * 60 * 1000);
      app.statusHistory = [hist('APPROVED', null), ...app.statusHistory];
    } else if (status === 'SUSPENDED') {
      app.status = 'SUSPENDED';
      app.statusReason = SUSPEND_REASON;
      app.approvedAt = ago(40 * 24 * 60 * 60 * 1000);
      app.statusHistory = [hist('SUSPENDED', SUSPEND_REASON), ...app.statusHistory];
    }
    state.applicant = app;
  }
  const dashboard = sp.get('dashboard');
  if (dashboard) state.emptyDashboard = dashboard === 'empty';

  const raw = sp.get('returnTo') ?? '/agent/apply';
  const returnTo = raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\') ? raw : '/';
  return NextResponse.redirect(new URL(returnTo, req.nextUrl.origin));
}
