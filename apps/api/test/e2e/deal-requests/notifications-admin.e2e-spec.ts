import { AdminRole, DealRequestStatus, NotificationType } from '@house/shared';
import {
  NOTIFICATION_DISPATCHER,
  type DispatchableNotification,
  type NotificationDispatcher,
} from '../../../src/modules/deal-requests/notifications/notification-dispatcher';
import { createAdmin, loginAdmin, resetAll, withSession, type TestApp } from '../../utils';
import {
  broker,
  createDealRequestsApp,
  dealRequest,
  itemIds,
  proposal,
  requester,
} from './factories';

class RecordingDispatcher implements NotificationDispatcher {
  readonly sent: DispatchableNotification[] = [];
  dispatch(rows: readonly DispatchableNotification[]): Promise<void> {
    this.sent.push(...rows);
    return Promise.resolve();
  }
}

describe('deal-requests: notifications + admin moderation (e2e)', () => {
  let t: TestApp;
  const dispatcher = new RecordingDispatcher();

  beforeAll(async () => {
    ({ t } = await createDealRequestsApp((b) =>
      b.overrideProvider(NOTIFICATION_DISPATCHER).useValue(dispatcher),
    ));
  });
  beforeEach(async () => {
    dispatcher.sent.length = 0;
    await resetAll(t);
  });
  afterAll(() => t?.close());

  async function notify(userId: string, n: number): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const row = await t.prisma.notification.create({
        data: {
          userId,
          type: NotificationType.SYSTEM,
          title: `알림 ${i}`,
          data: { i },
          createdAt: new Date(Date.UTC(2026, 10, 1, 0, 0, i)),
        },
      });
      ids.push(row.id);
    }
    return ids.reverse(); // newest first
  }

  describe('GET /api/v1/me/notifications', () => {
    it('200: own notifications, newest first, cursor pages, unreadOnly', async () => {
      const { user, s } = await requester(t);
      const other = await requester(t);
      const ids = await notify(user.id, 5);
      await notify(other.user.id, 2);
      await t.prisma.notification.update({ where: { id: ids[0] }, data: { readAt: new Date() } });

      const first = await withSession(t.http().get('/api/v1/me/notifications?limit=3'), s).expect(
        200,
      );
      expect(itemIds(first.body)).toEqual(ids.slice(0, 3));
      expect(first.body.items[1]).toMatchObject({ type: 'SYSTEM', data: { i: 3 }, readAt: null });
      expect(first.body.nextCursor).toEqual(expect.any(String));
      const second = await withSession(
        t.http().get(`/api/v1/me/notifications?limit=3&cursor=${first.body.nextCursor}`),
        s,
      ).expect(200);
      expect(itemIds(second.body)).toEqual(ids.slice(3));
      expect(second.body.nextCursor).toBeNull();
      const unread = await withSession(
        t.http().get('/api/v1/me/notifications?unreadOnly=true'),
        s,
      ).expect(200);
      expect(unread.body.items).toHaveLength(4);
    });

    it('401 anonymous; 400 for invalid limit', async () => {
      await t.http().get('/api/v1/me/notifications').expect(401);
      const { s } = await requester(t);
      await withSession(t.http().get('/api/v1/me/notifications?limit=0'), s).expect(400);
      await withSession(t.http().get('/api/v1/me/notifications?unreadOnly=maybe'), s).expect(400);
    });
  });

  describe('GET /api/v1/me/notifications/unread-count', () => {
    it('200: counts own unread only', async () => {
      const { user, s } = await requester(t);
      const other = await requester(t);
      await notify(user.id, 2);
      await notify(other.user.id, 3);
      const res = await withSession(
        t.http().get('/api/v1/me/notifications/unread-count'),
        s,
      ).expect(200);
      expect(res.body).toEqual({ unread: 2 });
    });

    it('401 anonymous; 401 for an admin session (user route)', async () => {
      await t.http().get('/api/v1/me/notifications/unread-count').expect(401);
      const admin = await createAdmin(t.prisma);
      const as = await loginAdmin(t.app, { id: admin.id });
      await withSession(t.http().get('/api/v1/me/notifications/unread-count'), as).expect(401);
    });
  });

  describe('POST /api/v1/me/notifications/read', () => {
    it("200: marks given ids or all; never touches other users' rows", async () => {
      const { user, s } = await requester(t);
      const other = await requester(t);
      const mine = await notify(user.id, 3);
      const theirs = await notify(other.user.id, 1);
      const some = await withSession(t.http().post('/api/v1/me/notifications/read'), s)
        .send({ ids: [mine[0], theirs[0]] })
        .expect(200);
      expect(some.body).toEqual({ updated: 1, unread: 2 });
      const all = await withSession(t.http().post('/api/v1/me/notifications/read'), s)
        .send({ all: true })
        .expect(200);
      expect(all.body).toEqual({ updated: 2, unread: 0 });
      expect(
        await t.prisma.notification.count({ where: { userId: other.user.id, readAt: null } }),
      ).toBe(1);
    });

    it('400 for an empty / ambiguous body; 401 anonymous', async () => {
      const { s } = await requester(t);
      await withSession(t.http().post('/api/v1/me/notifications/read'), s).send({}).expect(400);
      await withSession(t.http().post('/api/v1/me/notifications/read'), s)
        .send({ ids: ['x'] })
        .expect(400);
      await t.http().post('/api/v1/me/notifications/read').send({ all: true }).expect(401);
    });
  });

  describe('admin /api/v1/admin/deal-requests', () => {
    async function adminSession(opts: { mfaVerified?: boolean } = {}) {
      const a = await createAdmin(t.prisma, { role: AdminRole.OPERATOR });
      return loginAdmin(t.app, { id: a.id, role: AdminRole.OPERATOR }, opts);
    }

    it('GET list/detail 200: requester id + masked contact only', async () => {
      const { user } = await requester(t);
      const req = await dealRequest(t.prisma, user.id);
      await dealRequest(t.prisma, user.id, { status: DealRequestStatus.CLOSED });
      const s = await adminSession();
      const res = await withSession(
        t.http().get('/api/v1/admin/deal-requests?status=OPEN'),
        s,
      ).expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.items[0]).toMatchObject({
        id: req.id,
        userId: user.id,
        contactNameMasked: '홍*동',
        contactPhoneMasked: '010-****-5678',
      });
      expect(JSON.stringify(res.body)).not.toContain('01012345678');
      const detail = await withSession(
        t.http().get(`/api/v1/admin/deal-requests/${req.id}`),
        s,
      ).expect(200);
      expect(detail.body).not.toHaveProperty('contactPhone');
      expect(detail.body).not.toHaveProperty('addressDetail');
    });

    it('GET 401 for user sessions and admins without TOTP; 404 unknown; 400 bad input', async () => {
      const { s: userSession } = await requester(t);
      await withSession(t.http().get('/api/v1/admin/deal-requests'), userSession).expect(401);
      const noMfa = await adminSession({ mfaVerified: false });
      const res = await withSession(t.http().get('/api/v1/admin/deal-requests'), noMfa).expect(401);
      expect(res.body.code).toBe('AUTH_TOTP_REQUIRED');
      const s = await adminSession();
      await withSession(
        t.http().get('/api/v1/admin/deal-requests/0190a0b0-0000-7000-8000-00000000dead'),
        s,
      ).expect(404);
      await withSession(t.http().get('/api/v1/admin/deal-requests/nope'), s).expect(400);
      await withSession(t.http().get('/api/v1/admin/deal-requests?status=ZZZ'), s).expect(400);
    });

    it('POST close 200: closes, revokes grants, notifies requester + agencies, audited, dispatched', async () => {
      const { user } = await requester(t);
      const b = await broker(t);
      const req = await dealRequest(t.prisma, user.id);
      await proposal(t.prisma, req.id, b.agency.id);
      await t.prisma.dealRequestContactGrant.create({
        data: { dealRequestId: req.id, agencyId: b.agency.id },
      });
      const s = await adminSession();
      const res = await withSession(t.http().post(`/api/v1/admin/deal-requests/${req.id}/close`), s)
        .send({ reason: '허위 요청 신고 확인' })
        .expect(200);
      expect(res.body).toMatchObject({ status: 'CLOSED', closeReason: '허위 요청 신고 확인' });
      expect(await t.prisma.dealRequestContactGrant.count({ where: { revokedAt: null } })).toBe(0);
      expect(await t.prisma.notification.count({ where: { userId: user.id } })).toBe(1);
      expect(await t.prisma.notification.count({ where: { userId: b.user.id } })).toBe(1);
      expect(dispatcher.sent.map((d) => d.userId).sort()).toEqual([user.id, b.user.id].sort());
      const audit = await t.prisma.auditLog.findFirstOrThrow({
        where: { action: 'dealRequest.close' },
      });
      expect(audit).toMatchObject({ resourceType: 'DealRequest', resourceId: req.id });
      expect(JSON.stringify(audit.before)).toContain('"status":"OPEN"');
      expect(JSON.stringify(audit.after)).toContain('"status":"CLOSED"');
      const again = await withSession(
        t.http().post(`/api/v1/admin/deal-requests/${req.id}/close`),
        s,
      )
        .send({ reason: '중복' })
        .expect(400);
      expect(again.body.code).toBe('DEAL_REQUEST_STATE_INVALID');
    });

    it('POST close 401 for user session / no TOTP; 400 without a reason', async () => {
      const { user, s: userSession } = await requester(t);
      const req = await dealRequest(t.prisma, user.id);
      const url = `/api/v1/admin/deal-requests/${req.id}/close`;
      await withSession(t.http().post(url), userSession).send({ reason: 'x' }).expect(401);
      await withSession(t.http().post(url), await adminSession({ mfaVerified: false }))
        .send({ reason: 'x' })
        .expect(401);
      await withSession(t.http().post(url), await adminSession())
        .send({ reason: '' })
        .expect(400);
      expect((await t.prisma.dealRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe(
        'OPEN',
      );
    });
  });
});
