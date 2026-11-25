import {
  AdminRole,
  DealRequestStatus,
  DealRequestType,
  DealRequestVisibility,
  NotificationType,
  UserStatus,
} from '@house/shared';
import {
  NOTIFICATION_DISPATCHER,
  type DispatchableNotification,
  type NotificationDispatcher,
} from '../../../src/modules/deal-requests/notifications/notification-dispatcher';
import { DealRequestMaintenanceService } from '../../../src/modules/deal-requests/services/deal-request-maintenance.service';
import {
  createAdmin,
  createUser,
  loginAdmin,
  resetAll,
  withSession,
  type TestApp,
} from '../../utils';
import {
  EMD,
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

    it('GET list/detail: requester summary (live member without nickname ≠ withdrawn), region names', async () => {
      await t.prisma.region.createMany({
        data: [
          { code: '12150', name: '순천시', fullName: '전남광주통합특별시 순천시', level: 'SGG' },
          { code: EMD, name: '향동', fullName: '순천시 향동', level: 'EMD', parentCode: '12150' },
        ],
      });
      // A live Google sign-up: no nickname.
      const live = await createUser(t.prisma, { nickname: null });
      const withdrawn = await createUser(t.prisma, {
        nickname: '떠난회원',
        status: UserStatus.WITHDRAWN,
        withdrawnAt: new Date(),
      });
      const scrubbed = await createUser(t.prisma, { nickname: null, piiScrubbedAt: new Date() });
      const b = await broker(t, { name: '순천중앙공인중개사사무소' });
      const liveReq = await dealRequest(t.prisma, live.id, {
        emdCode: EMD,
        createdAt: new Date(Date.now() - 3000),
      });
      await dealRequest(t.prisma, live.id, {
        status: DealRequestStatus.CLOSED,
        createdAt: new Date(Date.now() - 4000),
      });
      const goneReq = await dealRequest(t.prisma, withdrawn.id, {
        type: DealRequestType.WANTED,
        roadAddress: null,
        regionCodes: [EMD, '12150999'],
        createdAt: new Date(Date.now() - 2000),
      });
      const scrubbedReq = await dealRequest(t.prisma, scrubbed.id, {
        createdAt: new Date(Date.now() - 1000),
      });
      await t.prisma.dealRequestTarget.create({
        data: { dealRequestId: liveReq.id, agencyId: b.agency.id },
      });
      await proposal(t.prisma, liveReq.id, b.agency.id, { message: '추천 매물 있어요' });
      await t.prisma.dealRequestContactGrant.create({
        data: { dealRequestId: liveReq.id, agencyId: b.agency.id },
      });
      const s = await adminSession();

      const list = await withSession(t.http().get('/api/v1/admin/deal-requests'), s).expect(200);
      const byId = new Map(
        (list.body.items as { id: string; requester: unknown }[]).map((i) => [i.id, i]),
      );
      expect(byId.get(liveReq.id)).toMatchObject({
        userId: live.id,
        emdName: '향동',
        regionNames: [],
        requester: {
          id: live.id,
          nickname: null,
          status: 'ACTIVE',
          createdAt: live.createdAt.toISOString(),
          dealRequestCount: 2,
        },
      });
      expect(byId.get(goneReq.id)).toMatchObject({
        emdName: null,
        regionNames: ['향동'],
        requester: { id: withdrawn.id, nickname: null, status: 'WITHDRAWN', dealRequestCount: 1 },
      });
      expect(byId.get(scrubbedReq.id)).toMatchObject({
        requester: { id: scrubbed.id, nickname: null, status: 'WITHDRAWN' },
      });
      expect(JSON.stringify(list.body)).not.toContain('떠난회원');
      // Search: address / content / a live requester's nickname — never a withdrawn one's.
      await t.prisma.user.update({ where: { id: live.id }, data: { nickname: '순천곰' } });
      const byNick = await withSession(
        t.http().get(`/api/v1/admin/deal-requests?q=${encodeURIComponent('순천곰')}`),
        s,
      ).expect(200);
      expect(byNick.body.total).toBe(2);
      expect(itemIds(byNick.body)).toContain(liveReq.id);
      const gone = await withSession(
        t.http().get(`/api/v1/admin/deal-requests?q=${encodeURIComponent('떠난회원')}`),
        s,
      ).expect(200);
      expect(gone.body.total).toBe(0);
      await t.prisma.user.update({ where: { id: live.id }, data: { nickname: null } });

      const detail = await withSession(
        t.http().get(`/api/v1/admin/deal-requests/${liveReq.id}`),
        s,
      ).expect(200);
      expect(detail.body).toMatchObject({
        requester: { id: live.id, nickname: null, status: 'ACTIVE', dealRequestCount: 2 },
        emdName: '향동',
        targets: [{ agencyId: b.agency.id, name: '순천중앙공인중개사사무소' }],
        proposals: [
          {
            agencyId: b.agency.id,
            agencyName: '순천중앙공인중개사사무소',
            status: 'SENT',
            message: '추천 매물 있어요',
            listingCount: 0,
          },
        ],
        contactGrants: [{ agencyId: b.agency.id, agencyName: '순천중앙공인중개사사무소' }],
      });
      expect((detail.body.history as { action: string }[]).map((h) => h.action).sort()).toEqual([
        'CONTACT_GRANTED',
        'DEAL_REQUEST_CREATED',
        'PROPOSAL_SENT',
      ]);

      const goneDetail = await withSession(
        t.http().get(`/api/v1/admin/deal-requests/${goneReq.id}`),
        s,
      ).expect(200);
      expect(goneDetail.body.requester).toMatchObject({ nickname: null, status: 'WITHDRAWN' });
      expect(goneDetail.body.regionNames).toEqual(['향동']);

      // Moderation actions show up in the history with the admin's name.
      await withSession(t.http().post(`/api/v1/admin/deal-requests/${liveReq.id}/spam-flag`), s)
        .send({ flagged: true, reason: '광고성 요청 반복' })
        .expect(200);
      const closed = await withSession(
        t.http().post(`/api/v1/admin/deal-requests/${liveReq.id}/close`),
        s,
      )
        .send({ reason: '허위 요청 신고 확인' })
        .expect(200);
      expect(closed.body.contactGrants).toEqual([]);
      expect((closed.body.history as unknown[]).slice(0, 2)).toMatchObject([
        { action: 'DEAL_REQUEST_CLOSED', note: '허위 요청 신고 확인' },
        { action: 'DEAL_REQUEST_SPAM_FLAGGED', note: '광고성 요청 반복' },
      ]);
      const after = await withSession(
        t.http().get(`/api/v1/admin/deal-requests/${liveReq.id}`),
        s,
      ).expect(200);
      const actions = (after.body.history as { action: string }[]).map((h) => h.action);
      expect(actions.filter((a) => a === 'DEAL_REQUEST_CLOSED')).toHaveLength(1);
      expect(actions).not.toContain('DEAL_REQUEST_COMPLETED');
      expect(after.body.history[0]).toMatchObject({
        action: 'DEAL_REQUEST_CLOSED',
        actorName: expect.any(String),
      });
    });

    it('requester summary never reaches the public or agency views', async () => {
      const { user } = await requester(t);
      const b = await broker(t);
      const req = await dealRequest(t.prisma, user.id, {
        visibility: DealRequestVisibility.SELECTED_AGENCIES,
      });
      await t.prisma.dealRequestTarget.create({
        data: { dealRequestId: req.id, agencyId: b.agency.id },
      });
      const res = await withSession(
        t.http().get(`/api/v1/agency/deal-requests/${req.id}`),
        b.s,
      ).expect(200);
      expect(res.body).not.toHaveProperty('requester');
      expect(res.body).not.toHaveProperty('userId');
      expect(JSON.stringify(res.body)).not.toContain(user.id);
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

    describe('POST /:id/spam-flag', () => {
      const flag = (s: Parameters<typeof withSession>[1], id: string, body: unknown) =>
        withSession(t.http().post(`/api/v1/admin/deal-requests/${id}/spam-flag`), s).send(
          body as object,
        );
      const inbox = async (b: { s: Parameters<typeof withSession>[1] }, scope = 'ALL') =>
        (
          await withSession(
            t.http().get(`/api/v1/agency/deal-requests?scope=${scope}`),
            b.s,
          ).expect(200)
        ).body as unknown;

      it('hides a flagged request from every agency path until cleared; audited', async () => {
        const { user } = await requester(t);
        const region = await broker(t);
        const targeted = await broker(t);
        const proposer = await broker(t);
        const req = await dealRequest(t.prisma, user.id);
        const sel = await dealRequest(t.prisma, user.id, {
          visibility: DealRequestVisibility.SELECTED_AGENCIES,
        });
        await t.prisma.dealRequestTarget.create({
          data: { dealRequestId: sel.id, agencyId: targeted.agency.id },
        });
        await proposal(t.prisma, req.id, proposer.agency.id);
        // Before: visible.
        expect(itemIds(await inbox(region))).toContain(req.id);
        expect(itemIds(await inbox(targeted, 'TARGETED'))).toEqual([sel.id]);
        expect(itemIds(await inbox(proposer, 'PROPOSED'))).toEqual([req.id]);

        const admin = await createAdmin(t.prisma, { role: AdminRole.OPERATOR });
        const s = await loginAdmin(t.app, { id: admin.id, role: AdminRole.OPERATOR });
        const res = await flag(s, req.id, {
          flagged: true,
          reason: '  같은 연락처 반복 등록  ',
        }).expect(200);
        expect(res.body).toMatchObject({
          id: req.id,
          status: 'OPEN',
          spamReason: '같은 연락처 반복 등록',
          spamSignalCount: 0,
          spamSignals: [],
        });
        expect(Date.parse(res.body.spamFlaggedAt as string)).not.toBeNaN();
        await flag(s, sel.id, { flagged: true, reason: '광고성 요청' }).expect(200);
        const row = await t.prisma.dealRequest.findUniqueOrThrow({ where: { id: req.id } });
        expect(row.spamFlaggedBy).toBe(admin.id);
        const audit = await t.prisma.auditLog.findFirstOrThrow({
          where: { action: 'dealRequest.spamFlag', resourceId: req.id },
        });
        expect(audit).toMatchObject({ resourceType: 'DealRequest' });
        expect(JSON.stringify(audit.before)).toContain('"spamFlaggedAt":null');
        expect(JSON.stringify(audit.after)).toContain('"spamReason":"같은 연락처 반복 등록"');

        // Hidden: inboxes (all scopes), detail, proposals, candidates, dashboard.
        expect(itemIds(await inbox(region))).toEqual([]);
        expect(itemIds(await inbox(targeted))).toEqual([]);
        expect(itemIds(await inbox(targeted, 'TARGETED'))).toEqual([]);
        expect(itemIds(await inbox(proposer, 'PROPOSED'))).toEqual([]);
        await withSession(t.http().get(`/api/v1/agency/deal-requests/${req.id}`), region.s).expect(
          404,
        );
        await withSession(
          t.http().get(`/api/v1/agency/deal-requests/${req.id}/listing-candidates`),
          region.s,
        ).expect(404);
        await withSession(
          t.http().post(`/api/v1/agency/deal-requests/${req.id}/proposals`),
          region.s,
        )
          .send({ message: '좋은 매물 있습니다. 연락 주세요.', listingIds: [] })
          .expect((r) => expect([400, 404]).toContain(r.status));
        const dash = await withSession(
          t.http().get('/api/v1/agencies/mine/dashboard'),
          region.s,
        ).expect(200);
        expect(JSON.stringify(dash.body)).not.toContain(req.id);
        // A request flagged before its fan-out job ran notifies nobody.
        expect(await t.app.get(DealRequestMaintenanceService).fanout(req.id)).toBe(0);

        // Admin views: list filter + detail keep the flag.
        const flagged = await withSession(
          t.http().get('/api/v1/admin/deal-requests?spam=flagged'),
          s,
        ).expect(200);
        expect(itemIds(flagged.body).sort()).toEqual([req.id, sel.id].sort());
        const suspected = await withSession(
          t.http().get('/api/v1/admin/deal-requests?spam=suspected'),
          s,
        ).expect(200);
        expect(suspected.body.total).toBe(0);
        const all = await withSession(t.http().get('/api/v1/admin/deal-requests'), s).expect(200);
        expect(all.body.total).toBe(2);
        const detail = await withSession(
          t.http().get(`/api/v1/admin/deal-requests/${req.id}`),
          s,
        ).expect(200);
        expect(detail.body).toMatchObject({ spamReason: '같은 연락처 반복 등록', spamSignals: [] });

        // Re-flagging keeps the original time and replaces the reason.
        const again = await flag(s, req.id, { flagged: true, reason: '반복 등록 확인됨' }).expect(
          200,
        );
        expect(again.body.spamFlaggedAt).toBe(res.body.spamFlaggedAt);
        expect(again.body.spamReason).toBe('반복 등록 확인됨');

        // Clearing (reason optional) makes it visible again.
        const cleared = await flag(s, req.id, { flagged: false }).expect(200);
        expect(cleared.body).toMatchObject({ spamFlaggedAt: null, spamReason: null });
        expect(
          (await t.prisma.dealRequest.findUniqueOrThrow({ where: { id: req.id } })).spamFlaggedBy,
        ).toBeNull();
        expect(itemIds(await inbox(region))).toContain(req.id);
        expect(itemIds(await inbox(proposer, 'PROPOSED'))).toEqual([req.id]);
        expect(
          await t.prisma.auditLog.count({
            where: { action: 'dealRequest.spamFlag', resourceId: req.id },
          }),
        ).toBe(3);
        // The requester is not notified of moderation flags.
        expect(await t.prisma.notification.count({ where: { userId: user.id } })).toBe(0);
      });

      it('400 for a short / missing reason when flagging or a non-boolean flag; 404; 401', async () => {
        const { user, s: userSession } = await requester(t);
        const req = await dealRequest(t.prisma, user.id);
        const s = await adminSession();
        const short = await flag(s, req.id, { flagged: true, reason: ' 스팸 ' }).expect(400);
        expect(short.body.code).toBe('VALIDATION_FAILED');
        expect(JSON.stringify(short.body)).toContain('사유를 5자 이상 입력해 주세요.');
        await flag(s, req.id, { flagged: true }).expect(400);
        await flag(s, req.id, { flagged: 'yes', reason: '광고성 요청입니다' }).expect(400);
        await flag(s, req.id, {}).expect(400);
        await flag(s, req.id, { flagged: true, reason: '가'.repeat(501) }).expect(400);
        const missing = await flag(s, '0190a0b0-0000-7000-8000-00000000dead', {
          flagged: true,
          reason: '광고성 요청입니다',
        }).expect(404);
        expect(missing.body.code).toBe('DEAL_REQUEST_NOT_FOUND');
        await flag(userSession, req.id, { flagged: true, reason: '광고성 요청입니다' }).expect(401);
        await flag(await adminSession({ mfaVerified: false }), req.id, {
          flagged: true,
          reason: '광고성 요청입니다',
        }).expect(401);
        expect(
          (await t.prisma.dealRequest.findUniqueOrThrow({ where: { id: req.id } })).spamFlaggedAt,
        ).toBeNull();
      });
    });
  });
});
