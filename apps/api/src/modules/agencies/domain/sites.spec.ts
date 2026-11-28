import {
  AgencySiteDecisionAction,
  AgencySiteStatus,
  AgencyStatus,
  SubscriptionProduct,
} from '@house/shared';
import {
  adminHostLabel,
  canRequestSite,
  dateOnly,
  isAgencyLive,
  isSiteLive,
  isSiteServable,
  siteColor,
  siteDecisionTarget,
  siteSlugProblemFor,
  subscriptionStatus,
  toDbDate,
  toSiteView,
  toSubscriptionView,
  type SiteContext,
  type SiteRow,
} from './sites';
import { minRoleForSiteDecision } from '../services/agency-site-review.service';

const at = (iso: string) => new Date(iso);

function row(over: Partial<SiteRow> = {}): SiteRow {
  return {
    id: 'site-1',
    agencyId: 'agency-1',
    status: AgencySiteStatus.ACTIVE,
    slug: 'gangnam',
    requestedSlug: 'gangnam',
    color: 'GREEN',
    tagline: '역 앞 10년',
    requestedAt: at('2026-11-01T00:00:00Z'),
    decidedAt: at('2026-11-02T00:00:00Z'),
    decisionReason: null,
    httpsReadyAt: at('2026-11-02T00:05:00Z'),
    createdAt: at('2026-11-01T00:00:00Z'),
    updatedAt: at('2026-11-02T00:05:00Z'),
    ...over,
  };
}

const ctx = (over: Partial<SiteContext> = {}): SiteContext => ({
  urlFor: (slug) => `https://${slug}.suncheonmap.kr`,
  httpsAlways: false,
  agencyLive: true,
  subscriptionOk: true,
  ...over,
});

describe('slug rules of the deployment (admin host label)', () => {
  it('takes the first label of the admin host, none for IP literals', () => {
    expect(adminHostLabel('https://manage.suncheonmap.kr')).toBe('manage');
    expect(adminHostLabel('https://Backoffice.Suncheonmap.kr:8443/')).toBe('backoffice');
    expect(adminHostLabel('http://localhost:3001')).toBe('localhost');
    expect(adminHostLabel('http://127.0.0.1:3001')).toBeNull();
    expect(adminHostLabel('http://[::1]:3001')).toBeNull();
    expect(adminHostLabel('not a url')).toBeNull();
  });

  it('a slug equal to it is RESERVED, as deploy/sites.sh refuses it (ADMIN_HOST)', () => {
    expect(siteSlugProblemFor('manage', 'manage')).toBe('RESERVED');
    expect(siteSlugProblemFor('manage', null)).toBeNull();
    expect(siteSlugProblemFor('gangnam', 'manage')).toBeNull();
    expect(siteSlugProblemFor('admin', null)).toBe('RESERVED');
    expect(siteSlugProblemFor('a--b', 'manage')).toBe('INVALID');
  });
});

describe('site decisions', () => {
  it('allows exactly the SPEC transitions', () => {
    const { REQUESTED, ACTIVE, REJECTED, SUSPENDED } = AgencySiteStatus;
    const { APPROVE, REJECT, SUSPEND, RESUME } = AgencySiteDecisionAction;
    expect(siteDecisionTarget(REQUESTED, APPROVE)).toBe(ACTIVE);
    expect(siteDecisionTarget(REQUESTED, REJECT)).toBe(REJECTED);
    expect(siteDecisionTarget(ACTIVE, SUSPEND)).toBe(SUSPENDED);
    expect(siteDecisionTarget(SUSPENDED, RESUME)).toBe(ACTIVE);
    for (const [from, action] of [
      [ACTIVE, APPROVE],
      [REJECTED, APPROVE],
      [ACTIVE, REJECT],
      [REQUESTED, SUSPEND],
      [SUSPENDED, SUSPEND],
      [ACTIVE, RESUME],
      [REJECTED, RESUME],
    ] as const) {
      expect(siteDecisionTarget(from, action)).toBeNull();
    }
  });

  it('suspend / resume need ADMIN, approve / reject OPERATOR', () => {
    expect(minRoleForSiteDecision(AgencySiteDecisionAction.APPROVE)).toBe('OPERATOR');
    expect(minRoleForSiteDecision(AgencySiteDecisionAction.REJECT)).toBe('OPERATOR');
    expect(minRoleForSiteDecision(AgencySiteDecisionAction.SUSPEND)).toBe('ADMIN');
    expect(minRoleForSiteDecision(AgencySiteDecisionAction.RESUME)).toBe('ADMIN');
  });

  it('the owner may request with no site, a pending or a rejected one only', () => {
    expect(canRequestSite(null)).toBe(true);
    expect(canRequestSite(AgencySiteStatus.REQUESTED)).toBe(true);
    expect(canRequestSite(AgencySiteStatus.REJECTED)).toBe(true);
    expect(canRequestSite(AgencySiteStatus.ACTIVE)).toBe(false);
    expect(canRequestSite(AgencySiteStatus.SUSPENDED)).toBe(false);
  });
});

describe('servable / live', () => {
  it('servable = ACTIVE + slug + live office + subscription gate (https not needed)', () => {
    expect(isSiteServable(row({ httpsReadyAt: null }), ctx())).toBe(true);
    expect(isSiteServable(row({ status: AgencySiteStatus.SUSPENDED }), ctx())).toBe(false);
    expect(isSiteServable(row({ slug: null }), ctx())).toBe(false);
    expect(isSiteServable(row(), ctx({ agencyLive: false }))).toBe(false);
    expect(isSiteServable(row(), ctx({ subscriptionOk: false }))).toBe(false);
  });

  it('live additionally needs https, except when the main site is plain http (dev)', () => {
    expect(isSiteLive(row(), ctx())).toBe(true);
    expect(isSiteLive(row({ httpsReadyAt: null }), ctx())).toBe(false);
    expect(isSiteLive(row({ httpsReadyAt: null }), ctx({ httpsAlways: true }))).toBe(true);
  });

  it('a live office is APPROVED and not deleted', () => {
    expect(isAgencyLive({ status: AgencyStatus.APPROVED, deletedAt: null })).toBe(true);
    expect(isAgencyLive({ status: AgencyStatus.SUSPENDED, deletedAt: null })).toBe(false);
    expect(isAgencyLive({ status: AgencyStatus.APPROVED, deletedAt: new Date() })).toBe(false);
  });
});

describe('toSiteView', () => {
  it('maps an active site with its URL and flags', () => {
    expect(toSiteView(row(), ctx())).toEqual({
      id: 'site-1',
      agencyId: 'agency-1',
      status: 'ACTIVE',
      slug: 'gangnam',
      requestedSlug: 'gangnam',
      color: 'GREEN',
      tagline: '역 앞 10년',
      url: 'https://gangnam.suncheonmap.kr',
      httpsReady: true,
      live: true,
      requestedAt: '2026-11-01T00:00:00.000Z',
      decidedAt: '2026-11-02T00:00:00.000Z',
      decisionReason: null,
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-02T00:05:00.000Z',
    });
  });

  it('URL only while ACTIVE (even before https is ready); suspended keeps the slug', () => {
    const pending = toSiteView(row({ httpsReadyAt: null }), ctx());
    expect(pending).toMatchObject({ url: 'https://gangnam.suncheonmap.kr', httpsReady: false });
    expect(pending.live).toBe(false);
    const suspended = toSiteView(row({ status: AgencySiteStatus.SUSPENDED }), ctx());
    expect(suspended).toMatchObject({ slug: 'gangnam', url: null, live: false });
    const requested = toSiteView(
      row({ status: AgencySiteStatus.REQUESTED, slug: null, decidedAt: null }),
      ctx(),
    );
    expect(requested).toMatchObject({ slug: null, url: null, live: false, decidedAt: null });
  });

  it('an unknown stored colour is shown as the default', () => {
    expect(siteColor('MAGENTA')).toBe('BLUE');
    expect(siteColor('toString')).toBe('BLUE');
    expect(siteColor('NAVY')).toBe('NAVY');
    expect(toSiteView(row({ color: 'MAGENTA' }), ctx()).color).toBe('BLUE');
  });
});

describe('subscriptions', () => {
  it('round-trips @db.Date values as KST days', () => {
    expect(toDbDate('2026-11-28').toISOString()).toBe('2026-11-28T00:00:00.000Z');
    expect(dateOnly(toDbDate('2026-02-01'))).toBe('2026-02-01');
  });

  it('derives the state on the given KST day', () => {
    const base = {
      id: 's1',
      agencyId: 'a1',
      product: SubscriptionProduct.SITE,
      startsOn: toDbDate('2026-11-01'),
      endsOn: toDbDate('2026-11-30'),
      amountWon: 50_000,
      memo: '11월분 입금',
      canceledAt: null,
      createdAt: at('2026-10-31T01:00:00Z'),
      createdBy: { name: '관리자' },
    };
    expect(toSubscriptionView(base, '2026-11-28')).toEqual({
      id: 's1',
      agencyId: 'a1',
      product: 'SITE',
      startsOn: '2026-11-01',
      endsOn: '2026-11-30',
      amountWon: 50_000,
      memo: '11월분 입금',
      canceledAt: null,
      state: 'ACTIVE',
      createdByName: '관리자',
      createdAt: '2026-10-31T01:00:00.000Z',
    });
    expect(toSubscriptionView(base, '2026-10-31').state).toBe('SCHEDULED');
    expect(toSubscriptionView(base, '2026-12-01').state).toBe('ENDED');
    expect(toSubscriptionView({ ...base, endsOn: null }, '2030-01-01').state).toBe('ACTIVE');
    const canceled = toSubscriptionView(
      { ...base, canceledAt: at('2026-11-10T00:00:00Z') },
      '2026-11-28',
    );
    expect(canceled.state).toBe('CANCELED');
    expect(toSubscriptionView({ ...base, createdBy: null }, '2026-11-28').createdByName).toBeNull();
  });

  it('the console line names the latest last day, null when open-ended', () => {
    expect(subscriptionStatus(false, [])).toEqual({ required: false, active: false, endsOn: null });
    expect(subscriptionStatus(true, ['2026-12-31', '2027-01-31'])).toEqual({
      required: true,
      active: true,
      endsOn: '2027-01-31',
    });
    expect(subscriptionStatus(true, ['2026-12-31', null]).endsOn).toBeNull();
  });
});
