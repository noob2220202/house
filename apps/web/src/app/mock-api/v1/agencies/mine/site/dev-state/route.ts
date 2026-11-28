import { AgencySiteStatus } from '@house/shared';
import { NextResponse, type NextRequest } from 'next/server';
import { mockError, mockGuard } from '@/lib/mock';
import {
  REJECT_REASON_SAMPLE,
  SUSPEND_REASON_SAMPLE,
  newOwnerSiteRow,
  resetSiteState,
  saveOwnerSite,
  siteState,
} from '../../../../sites/_state';

const STATES = ['NONE', 'REQUESTED', 'ACTIVE', 'PREPARING', 'REJECTED', 'SUSPENDED'] as const;
type DevState = (typeof STATES)[number];
const HOUR = 60 * 60 * 1000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

/**
 * MOCK ONLY (no backend counterpart) — puts the mock office's (B01) 사무소 홈페이지 into a given
 * state so every screen of /agent/site can be opened:
 *   /mock-api/v1/agencies/mine/site/dev-state?state=NONE|REQUESTED|ACTIVE|PREPARING|REJECTED|SUSPENDED
 *     [&subscription=free|active|missing] [&reset=1] [&returnTo=/agent/site]
 * PREPARING = ACTIVE before the certificate is issued ("주소 준비 중"). `subscription`: free = the
 * FEATURES switch off (default), active / missing = switch on with / without a SITE period.
 */
export function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  const sp = req.nextUrl.searchParams;
  const state = sp.get('reset') === '1' ? resetSiteState() : siteState();

  const wanted = sp.get('state') as DevState | null;
  if (wanted && !STATES.includes(wanted)) {
    return mockError(400, 'VALIDATION_FAILED', `state must be one of ${STATES.join(', ')}`);
  }
  if (wanted === 'NONE') saveOwnerSite(null);
  else if (wanted) {
    const decided = { decidedAt: ago(26 * HOUR) };
    const base = {
      color: 'GREEN' as const,
      tagline: '신대 레이크파크만 10년, 동·호수별 일조와 조망까지 알려 드려요',
    };
    saveOwnerSite(
      newOwnerSiteRow(
        wanted === 'REQUESTED'
          ? {
              ...base,
              status: AgencySiteStatus.REQUESTED,
              requestedSlug: 'sindae',
              requestedAt: ago(HOUR),
            }
          : wanted === 'REJECTED'
            ? {
                ...base,
                ...decided,
                status: AgencySiteStatus.REJECTED,
                requestedSlug: 'sindae-best1',
                decisionReason: REJECT_REASON_SAMPLE,
              }
            : wanted === 'SUSPENDED'
              ? {
                  ...base,
                  ...decided,
                  status: AgencySiteStatus.SUSPENDED,
                  slug: 'sindae',
                  requestedSlug: 'sindae',
                  decisionReason: SUSPEND_REASON_SAMPLE,
                }
              : {
                  ...base,
                  ...decided,
                  status: AgencySiteStatus.ACTIVE,
                  slug: 'sindae',
                  requestedSlug: 'sindae',
                  httpsReady: wanted !== 'PREPARING',
                },
      ),
    );
  }
  const subscription = sp.get('subscription');
  if (subscription) {
    state.subscriptionRequired = subscription !== 'free';
    state.subscriptionActive = subscription === 'active';
    state.subscriptionEndsOn = subscription === 'active' ? '2027-11-30' : null;
  }

  const raw = sp.get('returnTo') ?? '/agent/site';
  const returnTo = raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\') ? raw : '/';
  return NextResponse.redirect(new URL(returnTo, req.nextUrl.origin));
}
