import { AdminRole, AgencySiteStatus } from '@house/shared';
import { AdminNotificationsService } from '../../../src/modules/admin/services/admin-notifications.service';
import {
  createAgency,
  createTestApp,
  createUser,
  loginUser,
  resetAll,
  type TestApp,
  type TestSession,
} from '../../utils';
import { createAgencySite } from '../agencies/helpers';
import { adminActor, as, expectAdminAuthz, pluck } from './helpers';

const MIN = 60_000;

describe('admin: 사무소 홈페이지 requests on the dashboard and the bell (e2e)', () => {
  let t: TestApp;
  let userSession: TestSession;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetAll(t);
    userSession = await loginUser(t.app, await createUser(t.prisma));
  });
  afterAll(() => t?.close());

  async function seed() {
    const now = Date.now();
    const older = await createAgency(t.prisma, { name: '첫째공인중개사사무소' });
    const newer = await createAgency(t.prisma, { name: '둘째공인중개사사무소' });
    const live = await createAgency(t.prisma, { name: '운영중공인중개사사무소' });
    const gone = await createAgency(t.prisma, {
      name: '삭제된공인중개사사무소',
      deletedAt: new Date(),
    });
    await createAgencySite(t.prisma, newer.agency.id, {
      status: AgencySiteStatus.REQUESTED,
      requestedSlug: 'newer-one',
      requestedAt: new Date(now - 10 * MIN),
    });
    await createAgencySite(t.prisma, older.agency.id, {
      status: AgencySiteStatus.REQUESTED,
      requestedSlug: 'older-one',
      requestedAt: new Date(now - 60 * MIN),
    });
    await createAgencySite(t.prisma, live.agency.id, { slug: 'live-one' });
    await createAgencySite(t.prisma, gone.agency.id, {
      status: AgencySiteStatus.REQUESTED,
      requestedSlug: 'gone-one',
    });
    return { older, newer };
  }

  it('GET /admin/dashboard/queues: pending requests, oldest first (deleted offices left out)', async () => {
    const { older, newer } = await seed();
    const { session } = await adminActor(t, AdminRole.OPERATOR);
    const res = await as(t, session, 'get', '/admin/dashboard/queues').expect(200);
    expect(res.body.pendingAgencySites).toEqual({
      total: 2,
      items: [
        {
          agencyId: older.agency.id,
          agencyName: '첫째공인중개사사무소',
          requestedSlug: 'older-one',
          requestedAt: expect.any(String),
        },
        {
          agencyId: newer.agency.id,
          agencyName: '둘째공인중개사사무소',
          requestedSlug: 'newer-one',
          requestedAt: expect.any(String),
        },
      ],
    });
  });

  it('GET /admin/dashboard: agencies.sitesPending (sidebar badge agencySitesPending)', async () => {
    await seed();
    const { session } = await adminActor(t, AdminRole.OPERATOR);
    const res = await as(t, session, 'get', '/admin/dashboard').expect(200);
    expect(res.body.agencies).toMatchObject({ sitesPending: 2 });
  });

  it('bell: AGENCY_SITE_REQUEST per request, re-armed by a re-request, never duplicated', async () => {
    const { older } = await seed();
    const { session } = await adminActor(t, AdminRole.OPERATOR);
    const res = await as(t, session, 'get', '/admin/notifications').expect(200);
    const sites = (res.body.items as { kind: string }[]).filter(
      (n) => n.kind === 'AGENCY_SITE_REQUEST',
    );
    expect(sites).toHaveLength(2);
    expect(sites[0]).toMatchObject({
      title: '사무소 홈페이지 승인 요청',
      body: '둘째공인중개사사무소 · newer-one',
      link: expect.stringMatching(/^\/agencies\/[0-9a-f-]{36}$/),
    });
    const sync = t.app.get(AdminNotificationsService);
    expect(await sync.sync()).toBe(0);
    await t.prisma.agencySite.update({
      where: { agencyId: older.agency.id },
      data: { requestedSlug: 'older-two', requestedAt: new Date() },
    });
    expect(await sync.sync()).toBe(1);
    const after = await as(t, session, 'get', '/admin/notifications').expect(200);
    expect(pluck(after.body.items, 'body')).toContain('첫째공인중개사사무소 · older-two');
  });

  it('authz', async () => {
    await expectAdminAuthz(t, 'get', '/admin/dashboard/queues', { userSession });
  });
});
