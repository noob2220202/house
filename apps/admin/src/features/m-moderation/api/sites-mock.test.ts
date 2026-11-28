// @vitest-environment node
import { COOKIE_NAMES } from '@house/shared';
import { NextRequest } from 'next/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  adminAgencyPageSchema,
  adminAgencySiteListItemSchema,
  adminAgencySitePageSchema,
  adminAgencySiteResponseSchema,
  agencySiteDecisionResultSchema,
  agencySiteViewSchema,
  agencySubscriptionViewSchema,
  agencySubscriptionsResponseSchema,
} from './schemas';

/**
 * 사무소 홈페이지 + 구독 mocks follow SPEC §3.1: GET /admin/agency-sites, GET …/:id/site,
 * POST …/:id/site/decision, GET/POST …/:id/subscriptions, PATCH /admin/subscriptions/:id.
 */
type R = {
  sites: typeof import('@/app/mock-api/v1/admin/agency-sites/route');
  site: typeof import('@/app/mock-api/v1/admin/agencies/[id]/site/route');
  decision: typeof import('@/app/mock-api/v1/admin/agencies/[id]/site/decision/route');
  subscriptions: typeof import('@/app/mock-api/v1/admin/agencies/[id]/subscriptions/route');
  subscription: typeof import('@/app/mock-api/v1/admin/subscriptions/[id]/route');
  agencies: typeof import('@/app/mock-api/v1/admin/agencies/route');
  fixtures: typeof import('@/app/mock-api/v1/admin/agency-sites/_fixtures');
  agencyFixtures: typeof import('@/app/mock-api/v1/admin/agencies/_fixtures');
  content: typeof import('@/features/m-content/mock/store');
};
let r: R;

beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCK', '1');
  vi.resetModules();
  r = {
    sites: await import('@/app/mock-api/v1/admin/agency-sites/route'),
    site: await import('@/app/mock-api/v1/admin/agencies/[id]/site/route'),
    decision: await import('@/app/mock-api/v1/admin/agencies/[id]/site/decision/route'),
    subscriptions: await import('@/app/mock-api/v1/admin/agencies/[id]/subscriptions/route'),
    subscription: await import('@/app/mock-api/v1/admin/subscriptions/[id]/route'),
    agencies: await import('@/app/mock-api/v1/admin/agencies/route'),
    fixtures: await import('@/app/mock-api/v1/admin/agency-sites/_fixtures'),
    agencyFixtures: await import('@/app/mock-api/v1/admin/agencies/_fixtures'),
    content: await import('@/features/m-content/mock/store'),
  };
});

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR';
function req(
  path: string,
  init: { method?: string; body?: unknown; role?: Role } = {},
): NextRequest {
  const sep = path.includes('?') ? '&' : '?';
  return new NextRequest(`http://localhost:3201/api/v1${path}${sep}_delay=1`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      cookie: `${COOKIE_NAMES.ADMIN_SESSION}=mock-${init.role ?? 'ADMIN'}; ${COOKIE_NAMES.CSRF}=t`,
      'x-csrf-token': 't',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const json = async (res: Response) => (await res.json()) as Record<string, unknown>;
const wire = <T>(value: T): unknown => JSON.parse(JSON.stringify(value));

describe('사무소 홈페이지 fixtures match the response schemas', () => {
  it('every site row parses as AgencySiteView and AdminAgencySiteListItem', () => {
    const rows = r.fixtures.sitesDb();
    expect(new Set(rows.map((s) => s.status)).size).toBe(4);
    for (const row of rows) {
      expect(
        agencySiteViewSchema.safeParse(wire(r.fixtures.toSiteView(row))).error,
      ).toBeUndefined();
      expect(
        adminAgencySiteListItemSchema.safeParse(wire(r.fixtures.toSiteListItem(row))).error,
      ).toBeUndefined();
    }
  });

  it('every office has a parseable subscriptions response', () => {
    for (const agency of r.agencyFixtures.agenciesDb()) {
      const parsed = agencySubscriptionsResponseSchema.safeParse(
        wire(r.fixtures.subscriptionsResponse(agency.id)),
      );
      expect(parsed.error).toBeUndefined();
    }
    const b01 = r.fixtures.subscriptionsResponse(r.agencyFixtures.AGENCY_ID.B01);
    expect(b01.current).toEqual({ SITE: true, PLATFORM: true });
    expect(b01.items.map((s) => s.state)).toContain('ENDED');
  });

  it('reads a decision answer with or without the { site } envelope; unknown colours fall back', () => {
    const view = wire(r.fixtures.toSiteView(r.fixtures.sitesDb()[0]!)) as Record<string, unknown>;
    expect(agencySiteDecisionResultSchema.parse({ site: view }).id).toBe(view.id);
    expect(agencySiteDecisionResultSchema.parse(view).id).toBe(view.id);
    expect(agencySiteViewSchema.parse({ ...view, color: 'MAGENTA' }).color).toBe('BLUE');
  });
});

describe('사무소 홈페이지 mocks (SPEC §3.1)', () => {
  const id = (key: 'B01' | 'B02' | 'B03' | 'B04' | 'B07') => r.agencyFixtures.AGENCY_ID[key];

  it('lists the REQUESTED queue oldest first', async () => {
    const page = adminAgencySitePageSchema.parse(
      await json(await r.sites.GET(req('/admin/agency-sites?status=REQUESTED'))),
    );
    expect(page.items.length).toBeGreaterThanOrEqual(2);
    expect(page.items.every((i) => i.site.status === 'REQUESTED')).toBe(true);
    const times = page.items.map((i) => i.site.requestedAt);
    expect([...times].sort()).toEqual(times);
    const bad = await r.sites.GET(req('/admin/agency-sites?status=NOPE'));
    expect(bad.status).toBe(400);
  });

  it('answers { site } per office, null when never asked, 404 for an unknown office', async () => {
    const asked = adminAgencySiteResponseSchema.parse(
      await json(await r.site.GET(req(`/admin/agencies/${id('B02')}/site`), params(id('B02')))),
    );
    expect(asked.site?.status).toBe('REQUESTED');
    const never = await json(
      await r.site.GET(req(`/admin/agencies/${id('B07')}/site`), params(id('B07'))),
    );
    expect(never).toEqual({ site: null });
    const unknown = await r.site.GET(req('/admin/agencies/nope/site'), params('nope'));
    expect(unknown.status).toBe(404);
  });

  it('approves with a corrected slug, refuses a taken slug and a second approval', async () => {
    const path = `/admin/agencies/${id('B02')}/site/decision`;
    const taken = await r.decision.POST(
      req(path, { method: 'POST', body: { action: 'APPROVE', slug: 'sindae' } }),
      params(id('B02')),
    );
    expect(taken.status).toBe(409);
    expect((await json(taken)).code).toBe('AGENCY_SITE_SLUG_DUPLICATE');
    // Another office's open request holds its slug too (the API's siteSlugTaken).
    const requested = await r.decision.POST(
      req(path, { method: 'POST', body: { action: 'APPROVE', slug: 'yeonhyang-central' } }),
      params(id('B02')),
    );
    expect(requested.status).toBe(409);
    expect((await json(requested)).code).toBe('AGENCY_SITE_SLUG_DUPLICATE');

    const reserved = await r.decision.POST(
      req(path, { method: 'POST', body: { action: 'APPROVE', slug: 'admin' } }),
      params(id('B02')),
    );
    expect(reserved.status).toBe(400);

    const ok = await r.decision.POST(
      req(path, { method: 'POST', body: { action: 'APPROVE', slug: ' Hosu-Lake ' } }),
      params(id('B02')),
    );
    expect(ok.status).toBe(200);
    const site = agencySiteDecisionResultSchema.parse(await json(ok));
    expect(site).toMatchObject({
      status: 'ACTIVE',
      slug: 'hosu-lake',
      requestedSlug: 'hosupark', // the office's request is kept, as in the API
      httpsReady: false,
    });
    expect(site.url).toContain('hosu-lake.');
    expect(site.live).toBe(false);
    expect(r.content.db().audit[0]).toMatchObject({
      action: 'agency_site.approve',
      resourceType: 'AgencySite',
    });

    const again = await r.decision.POST(
      req(path, { method: 'POST', body: { action: 'APPROVE' } }),
      params(id('B02')),
    );
    expect(again.status).toBe(409);
    expect((await json(again)).code).toBe('AGENCY_SITE_INVALID_TRANSITION');
  });

  it('lets operators approve / reject but not suspend / resume (ADMIN+, like the API)', async () => {
    const decide = (key: 'B01' | 'B04', body: unknown, role: Role) =>
      r.decision.POST(
        req(`/admin/agencies/${id(key)}/site/decision`, { method: 'POST', body, role }),
        params(id(key)),
      );
    const suspend = await decide(
      'B01',
      { action: 'SUSPEND', reason: '홈페이지에 허위 광고가 있습니다.' },
      'OPERATOR',
    );
    expect(suspend.status).toBe(403);
    expect((await json(suspend)).code).toBe('AGENCY_DECISION_FORBIDDEN');
    const resume = await decide('B04', { action: 'RESUME' }, 'OPERATOR');
    expect(resume.status).toBe(403);
    expect(r.fixtures.sitesDb().find((s) => s.agencyId === id('B01'))?.status).toBe('ACTIVE');
    expect(r.fixtures.sitesDb().find((s) => s.agencyId === id('B04'))?.status).toBe('SUSPENDED');
    // An operator's approval only fails on the state here (B01 is already ACTIVE), not the role.
    const approve = await decide('B01', { action: 'APPROVE' }, 'OPERATOR');
    expect(approve.status).toBe(409);
  });

  it('needs a reason to reject or suspend; resume reopens the same address', async () => {
    const reject = `/admin/agencies/${id('B03')}/site/decision`;
    const noReason = await r.decision.POST(
      req(reject, { method: 'POST', body: { action: 'REJECT' } }),
      params(id('B03')),
    );
    expect(noReason.status).toBe(400);
    const rejected = agencySiteDecisionResultSchema.parse(
      await json(
        await r.decision.POST(
          req(reject, {
            method: 'POST',
            body: { action: 'REJECT', reason: '부적절한 단어가 포함된 주소입니다.' },
          }),
          params(id('B03')),
        ),
      ),
    );
    expect(rejected).toMatchObject({ status: 'REJECTED', slug: null, url: null });
    expect(rejected.decisionReason).toBe('부적절한 단어가 포함된 주소입니다.');

    const active = `/admin/agencies/${id('B01')}/site/decision`;
    const suspended = agencySiteDecisionResultSchema.parse(
      await json(
        await r.decision.POST(
          req(active, {
            method: 'POST',
            body: { action: 'SUSPEND', reason: '홈페이지에 허위 광고가 있습니다.' },
          }),
          params(id('B01')),
        ),
      ),
    );
    expect(suspended).toMatchObject({ status: 'SUSPENDED', url: null, live: false });
    const resumed = agencySiteDecisionResultSchema.parse(
      await json(
        await r.decision.POST(
          req(active, { method: 'POST', body: { action: 'RESUME' } }),
          params(id('B01')),
        ),
      ),
    );
    expect(resumed).toMatchObject({ status: 'ACTIVE', slug: 'sindae', live: true });
  });

  it('records, ends and cancels subscriptions (ADMIN+ only)', async () => {
    const path = `/admin/agencies/${id('B03')}/subscriptions`;
    const body = { product: 'SITE', startsOn: '2026-01-01', endsOn: null, amountWon: 0 };
    const operator = await r.subscriptions.POST(
      req(path, { method: 'POST', body, role: 'OPERATOR' }),
      params(id('B03')),
    );
    expect(operator.status).toBe(403);
    const badPeriod = await r.subscriptions.POST(
      req(path, { method: 'POST', body: { ...body, endsOn: '2025-12-31' } }),
      params(id('B03')),
    );
    expect(badPeriod.status).toBe(400);

    const created = await r.subscriptions.POST(
      req(path, { method: 'POST', body: { ...body, memo: '  출시 기념 무료  ' } }),
      params(id('B03')),
    );
    expect(created.status).toBe(201);
    const sub = agencySubscriptionViewSchema.parse(await json(created));
    expect(sub).toMatchObject({ state: 'ACTIVE', memo: '출시 기념 무료', createdByName: '한지우' });

    const list = agencySubscriptionsResponseSchema.parse(
      await json(await r.subscriptions.GET(req(path, { role: 'OPERATOR' }), params(id('B03')))),
    );
    expect(list.current.SITE).toBe(true);
    expect(list.items[0]?.id).toBe(sub.id);

    const patch = (b: unknown, role?: Role) =>
      r.subscription.PATCH(
        req(`/admin/subscriptions/${sub.id}`, { method: 'PATCH', body: b, role }),
        params(sub.id),
      );
    expect((await patch({ cancel: true }, 'OPERATOR')).status).toBe(403);
    const early = await patch({ endsOn: '2025-06-30' });
    expect(early.status).toBe(400);
    expect((await json(early)).code).toBe('AGENCY_SUBSCRIPTION_INVALID_PERIOD');
    expect((await patch({})).status).toBe(400);
    const ended = agencySubscriptionViewSchema.parse(
      await json(await patch({ endsOn: '2026-01-31' })),
    );
    expect(ended).toMatchObject({ endsOn: '2026-01-31', state: 'ENDED' });
    const canceled = agencySubscriptionViewSchema.parse(await json(await patch({ cancel: true })));
    expect(canceled.state).toBe('CANCELED');
    expect(r.content.db().audit[0]).toMatchObject({ action: 'subscription.cancel' });

    const missing = await r.subscription.PATCH(
      req('/admin/subscriptions/nope', { method: 'PATCH', body: { cancel: true } }),
      params('nope'),
    );
    expect(missing.status).toBe(404);
  });
});

describe('agencies list mock honours sort (audit fix)', () => {
  it('reads OLDEST by default like the API, NEWEST when asked', async () => {
    const oldest = adminAgencyPageSchema.parse(
      await json(await r.agencies.GET(req('/admin/agencies?status=APPROVED&pageSize=50'))),
    );
    const newest = adminAgencyPageSchema.parse(
      await json(
        await r.agencies.GET(req('/admin/agencies?status=APPROVED&sort=NEWEST&pageSize=50')),
      ),
    );
    const created = (p: typeof oldest) => p.items.map((a) => a.createdAt);
    expect(created(oldest)).toEqual([...created(oldest)].sort());
    expect(created(newest)).toEqual([...created(oldest)].reverse());
  });
});
