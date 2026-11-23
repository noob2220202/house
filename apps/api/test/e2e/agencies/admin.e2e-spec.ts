import { AdminRole, AgencyStatus, UserRole, type BrokerRegistryRecord } from '@house/shared';
import { BROKER_REGISTRY } from '../../../src/modules/agencies/clients/broker-registry.client';
import { SessionService } from '../../../src/modules/auth/session/session.service';
import {
  createAdmin,
  createAgency,
  createTestApp,
  createUser,
  loginAdmin,
  loginUser,
  resetAll,
  withSession,
  type TestApp,
} from '../../utils';
import { FakeBrokerRegistry, createPendingAgency, pluck, writePrivateFile } from './helpers';

describe('agencies: admin review (e2e)', () => {
  let t: TestApp;
  const registry = new FakeBrokerRegistry();

  beforeAll(async () => {
    t = await createTestApp({
      override: (b) => b.overrideProvider(BROKER_REGISTRY).useValue(registry),
    });
  });
  beforeEach(async () => {
    registry.reset();
    await resetAll(t);
  });
  afterAll(() => t?.close());

  async function admin(role: AdminRole = AdminRole.OPERATOR) {
    const a = await createAdmin(t.prisma, { role });
    return { admin: a, s: await loginAdmin(t.app, { id: a.id, role }) };
  }

  describe('GET /api/v1/admin/agencies', () => {
    it('200: review queue filtered by status, oldest first, with counts', async () => {
      const first = await createPendingAgency(t.prisma, { name: '첫번째공인중개사' });
      const second = await createPendingAgency(t.prisma, { name: '두번째공인중개사' });
      await createAgency(t.prisma);
      const { s } = await admin();
      const res = await withSession(
        t.http().get('/api/v1/admin/agencies?status=PENDING'),
        s,
      ).expect(200);
      expect(res.body.total).toBe(2);
      expect(pluck(res.body.items, 'id')).toEqual([first.agency.id, second.agency.id]);
      expect(res.body.items[0]).toMatchObject({
        status: 'PENDING',
        documentCount: 1,
        memberCount: 1,
        owner: { id: first.owner.id },
      });
      const searched = await withSession(
        t.http().get(`/api/v1/admin/agencies?q=${encodeURIComponent('두번째')}`),
        s,
      ).expect(200);
      expect(pluck(searched.body.items, 'id')).toEqual([second.agency.id]);
      const all = await withSession(t.http().get('/api/v1/admin/agencies?sort=NEWEST'), s).expect(
        200,
      );
      expect(all.body.total).toBe(3);
    });

    it('401 for anonymous / user sessions and admins without TOTP', async () => {
      await t.http().get('/api/v1/admin/agencies').expect(401);
      const user = await loginUser(t.app, await createUser(t.prisma));
      await withSession(t.http().get('/api/v1/admin/agencies'), user).expect(401);
      const a = await createAdmin(t.prisma);
      const noMfa = await loginAdmin(t.app, a, { mfaVerified: false });
      const res = await withSession(t.http().get('/api/v1/admin/agencies'), noMfa).expect(401);
      expect(res.body.code).toBe('AUTH_TOTP_REQUIRED');
    });

    it('400 for invalid filters', async () => {
      const { s } = await admin();
      await withSession(t.http().get('/api/v1/admin/agencies?status=OPEN'), s).expect(400);
      await withSession(t.http().get('/api/v1/admin/agencies?page=0'), s).expect(400);
    });
  });

  describe('GET /api/v1/admin/agencies/:id', () => {
    it('200: full detail incl. owner contact, documents and members', async () => {
      const { agency, owner } = await createPendingAgency(t.prisma);
      const { s } = await admin();
      const res = await withSession(t.http().get(`/api/v1/admin/agencies/${agency.id}`), s).expect(
        200,
      );
      expect(res.body).toMatchObject({
        id: agency.id,
        status: 'PENDING',
        businessNumber: '2208162517',
        owner: { id: owner.id, email: owner.email },
        warningCount: 0,
      });
      expect(res.body.documents).toHaveLength(1);
      expect(res.body.members).toHaveLength(1);
    });

    it('401 without admin session; 404 unknown; 400 malformed id', async () => {
      const { agency } = await createPendingAgency(t.prisma);
      await t.http().get(`/api/v1/admin/agencies/${agency.id}`).expect(401);
      const { s } = await admin();
      await withSession(
        t.http().get('/api/v1/admin/agencies/0190f3c2-7a4b-7cde-8f00-123456789abc'),
        s,
      ).expect(404);
      await withSession(t.http().get('/api/v1/admin/agencies/nope'), s).expect(400);
    });
  });

  describe('POST /api/v1/admin/agencies/:id/decision', () => {
    it('approve: status, owner role, sessions, history, notification and audit log', async () => {
      const { agency, owner } = await createPendingAgency(t.prisma);
      const ownerSession = await loginUser(t.app, owner, { agencyId: agency.id });
      const { admin: reviewer, s } = await admin();
      const res = await withSession(
        t.http().post(`/api/v1/admin/agencies/${agency.id}/decision`),
        s,
      )
        .send({ status: 'APPROVED' })
        .expect(200);
      expect(res.body.status).toBe('APPROVED');
      expect(res.body.approvedAt).toEqual(expect.any(String));
      expect(res.body.statusHistory[0]).toMatchObject({
        fromStatus: 'PENDING',
        toStatus: 'APPROVED',
        decidedBy: { id: reviewer.id },
      });

      expect((await t.prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).role).toBe(
        UserRole.AGENCY_OWNER,
      );
      const [session] = await t.app.get(SessionService).listForSubject('USER', owner.id);
      expect(session).toMatchObject({ role: 'AGENCY_OWNER', agencyId: agency.id });
      // The owner's existing session can now manage staff without logging in again.
      await withSession(t.http().get('/api/v1/agencies/mine/members'), ownerSession).expect(200);

      const notification = await t.prisma.notification.findFirstOrThrow({
        where: { userId: owner.id },
      });
      expect(notification.type).toBe('AGENCY_APPROVED');
      const audit = await t.prisma.auditLog.findFirstOrThrow({
        where: { action: 'agency.approve', resourceId: agency.id },
      });
      expect(audit).toMatchObject({ adminUserId: reviewer.id, resourceType: 'Agency' });
      expect(audit.before).toMatchObject({ status: 'PENDING' });
      expect(audit.after).toMatchObject({ status: 'APPROVED' });

      // Now public.
      await t.http().get(`/api/v1/agencies/${agency.id}`).expect(200);
    });

    it('reject → resubmit → approve keeps a full history; rejection detaches the session', async () => {
      const { agency, owner } = await createPendingAgency(t.prisma);
      const ownerSession = await loginUser(t.app, owner, { agencyId: agency.id });
      const { s } = await admin();
      await withSession(t.http().post(`/api/v1/admin/agencies/${agency.id}/decision`), s)
        .send({ status: 'REJECTED', reason: '등록증 사본이 흐립니다.' })
        .expect(200);
      const [session] = await t.app.get(SessionService).listForSubject('USER', owner.id);
      expect(session?.agencyId).toBeNull();
      const mine = await withSession(t.http().get('/api/v1/agencies/mine'), ownerSession).expect(
        200,
      );
      expect(mine.body).toMatchObject({
        status: 'REJECTED',
        statusReason: '등록증 사본이 흐립니다.',
      });

      await withSession(t.http().post('/api/v1/agencies/mine/resubmit'), ownerSession)
        .send({ message: '다시 제출합니다.' })
        .expect(200);
      const approved = await withSession(
        t.http().post(`/api/v1/admin/agencies/${agency.id}/decision`),
        s,
      )
        .send({ status: 'APPROVED' })
        .expect(200);
      expect(pluck(approved.body.statusHistory, 'toStatus')).toEqual([
        'APPROVED',
        'PENDING',
        'REJECTED',
      ]);
    });

    it('suspend needs ADMIN, revokes invites; reinstate restores APPROVED', async () => {
      const { agency, owner } = await createAgency(t.prisma);
      const so = await loginUser(t.app, owner, { agencyId: agency.id });
      const invite = await withSession(t.http().post('/api/v1/agencies/mine/invites'), so)
        .send({})
        .expect(201);

      const operator = await admin(AdminRole.OPERATOR);
      const forbidden = await withSession(
        t.http().post(`/api/v1/admin/agencies/${agency.id}/decision`),
        operator.s,
      )
        .send({ status: 'SUSPENDED', reason: '허위매물 반복' })
        .expect(403);
      expect(forbidden.body.code).toBe('AGENCY_DECISION_FORBIDDEN');

      const { s } = await admin(AdminRole.ADMIN);
      const suspended = await withSession(
        t.http().post(`/api/v1/admin/agencies/${agency.id}/decision`),
        s,
      )
        .send({ status: 'SUSPENDED', reason: '허위매물 반복' })
        .expect(200);
      expect(suspended.body).toMatchObject({
        status: 'SUSPENDED',
        suspendedAt: expect.any(String),
      });
      await t.http().get(`/api/v1/agencies/${agency.id}`).expect(404);
      const joiner = await loginUser(t.app, await createUser(t.prisma));
      await withSession(t.http().post('/api/v1/agencies/join'), joiner)
        .send({ code: invite.body.code, displayName: 'x' })
        .expect(400);

      const reinstated = await withSession(
        t.http().post(`/api/v1/admin/agencies/${agency.id}/decision`),
        operator.s,
      )
        .send({ status: 'APPROVED' })
        .expect(200);
      expect(reinstated.body).toMatchObject({ status: 'APPROVED', suspendedAt: null });
      expect(
        await t.prisma.auditLog.count({
          where: { action: 'agency.reinstate', resourceId: agency.id },
        }),
      ).toBe(1);
    });

    it('400 for invalid transitions and payloads; 401 for user sessions; 404 unknown', async () => {
      const { agency } = await createPendingAgency(t.prisma);
      const { s } = await admin(AdminRole.SUPER_ADMIN);
      const bad = await withSession(
        t.http().post(`/api/v1/admin/agencies/${agency.id}/decision`),
        s,
      )
        .send({ status: 'SUSPENDED', reason: 'x' })
        .expect(400);
      expect(bad.body).toMatchObject({
        code: 'AGENCY_INVALID_STATUS_TRANSITION',
        details: { from: 'PENDING', to: 'SUSPENDED' },
      });
      await withSession(t.http().post(`/api/v1/admin/agencies/${agency.id}/decision`), s)
        .send({ status: 'REJECTED' })
        .expect(400);
      await withSession(t.http().post(`/api/v1/admin/agencies/${agency.id}/decision`), s)
        .send({ status: 'PENDING' })
        .expect(400);
      await withSession(
        t.http().post('/api/v1/admin/agencies/0190f3c2-7a4b-7cde-8f00-123456789abc/decision'),
        s,
      )
        .send({ status: 'APPROVED' })
        .expect(404);

      const user = await loginUser(t.app, await createUser(t.prisma));
      await withSession(t.http().post(`/api/v1/admin/agencies/${agency.id}/decision`), user)
        .send({ status: 'APPROVED' })
        .expect(401);
      const { s: noCsrf } = await admin();
      await t
        .http()
        .post(`/api/v1/admin/agencies/${agency.id}/decision`)
        .set('Cookie', noCsrf.cookie)
        .set('Origin', noCsrf.origin)
        .send({ status: 'APPROVED' })
        .expect(403);
      expect((await t.prisma.agency.findUniqueOrThrow({ where: { id: agency.id } })).status).toBe(
        AgencyStatus.PENDING,
      );
    });
  });

  describe('GET /api/v1/admin/agencies/:id/documents/:docId/file', () => {
    it('200: streams the private file with no-store and records an audit entry', async () => {
      const { agency, document } = await createPendingAgency(t.prisma);
      await writePrivateFile(document, '%PDF-1.4 test');
      const doc = await t.prisma.agencyDocument.findFirstOrThrow({
        where: { agencyId: agency.id },
      });
      const { s } = await admin();
      const res = await withSession(
        t.http().get(`/api/v1/admin/agencies/${agency.id}/documents/${doc.id}/file`),
        s,
      )
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['cache-control']).toBe('private, no-store');
      expect(res.headers['content-disposition']).toMatch(/^inline; filename="agency-/);
      expect((res.body as Buffer).toString()).toBe('%PDF-1.4 test');
      // recordSafe is fire-and-forget; give it a tick.
      await new Promise((r) => setImmediate(r));
      await expect(
        t.prisma.auditLog.count({ where: { action: 'agency.document.view', resourceId: doc.id } }),
      ).resolves.toBe(1);
    });

    it('401 for users (even the owner) on the admin route; 404 for mismatched ids or missing files', async () => {
      const { agency, owner, document } = await createPendingAgency(t.prisma);
      const doc = await t.prisma.agencyDocument.findFirstOrThrow({
        where: { agencyId: agency.id },
      });
      const so = await loginUser(t.app, owner, { agencyId: agency.id });
      await withSession(
        t.http().get(`/api/v1/admin/agencies/${agency.id}/documents/${doc.id}/file`),
        so,
      ).expect(401);
      const { s } = await admin();
      // File not on disk yet.
      await withSession(
        t.http().get(`/api/v1/admin/agencies/${agency.id}/documents/${doc.id}/file`),
        s,
      ).expect(404);
      await writePrivateFile(document, 'x');
      const other = await createPendingAgency(t.prisma);
      await withSession(
        t.http().get(`/api/v1/admin/agencies/${other.agency.id}/documents/${doc.id}/file`),
        s,
      ).expect(404);
      await withSession(
        t.http().get(`/api/v1/admin/agencies/${agency.id}/documents/bad/file`),
        s,
      ).expect(400);
    });

    it('refuses storage keys that escape the private root', async () => {
      const { agency, document } = await createPendingAgency(t.prisma);
      await t.prisma.media.update({
        where: { id: document.id },
        data: { storageKey: '../../../etc/passwd' },
      });
      const doc = await t.prisma.agencyDocument.findFirstOrThrow({
        where: { agencyId: agency.id },
      });
      const { s } = await admin();
      await withSession(
        t.http().get(`/api/v1/admin/agencies/${agency.id}/documents/${doc.id}/file`),
        s,
      ).expect(404);
    });
  });

  describe('GET /api/v1/admin/agencies/:id/registry-check', () => {
    it('200: MATCH / MISMATCH against the registry fake, cached until refresh', async () => {
      const { agency } = await createPendingAgency(t.prisma, {
        name: '순천중앙공인중개사사무소',
        representativeName: '홍길동',
      });
      registry.records.set(agency.registrationNumber, {
        registrationNumber: agency.registrationNumber,
        officeName: '순천중앙 공인중개사',
        representativeName: '홍길동',
        operating: true,
        statusLabel: '영업중',
        regionName: '전라남도 순천시',
        registeredOn: '2020-01-01',
      });
      const { s } = await admin();
      const url = `/api/v1/admin/agencies/${agency.id}/registry-check`;
      const ok = await withSession(t.http().get(url), s).expect(200);
      expect(ok.body).toMatchObject({ status: 'MATCH', mismatches: [] });
      expect(ok.body.record.officeName).toBe('순천중앙 공인중개사');

      registry.records.set(agency.registrationNumber, {
        ...(ok.body.record as BrokerRegistryRecord),
        representativeName: '김철수',
        operating: false,
      });
      expect((await withSession(t.http().get(url), s).expect(200)).body.status).toBe('MATCH');
      expect(registry.calls).toBe(1);
      const fresh = await withSession(t.http().get(`${url}?refresh=true`), s).expect(200);
      expect(fresh.body).toMatchObject({
        status: 'MISMATCH',
        mismatches: ['representativeName', 'operating'],
      });
    });

    it('NOT_FOUND / UNAVAILABLE results', async () => {
      const { agency } = await createPendingAgency(t.prisma);
      const { s } = await admin();
      const url = `/api/v1/admin/agencies/${agency.id}/registry-check?refresh=1`;
      expect((await withSession(t.http().get(url), s).expect(200)).body.status).toBe('NOT_FOUND');
      registry.fail = true;
      expect((await withSession(t.http().get(url), s).expect(200)).body.status).toBe('UNAVAILABLE');
      registry.fail = false;
      registry.enabled = false;
      expect((await withSession(t.http().get(url), s).expect(200)).body.status).toBe('UNAVAILABLE');
    });

    it('401 without admin session; 400 invalid query; 404 unknown agency', async () => {
      const { agency } = await createPendingAgency(t.prisma);
      await t.http().get(`/api/v1/admin/agencies/${agency.id}/registry-check`).expect(401);
      const { s } = await admin();
      await withSession(
        t.http().get(`/api/v1/admin/agencies/${agency.id}/registry-check?refresh=maybe`),
        s,
      ).expect(400);
      await withSession(
        t.http().get('/api/v1/admin/agencies/0190f3c2-7a4b-7cde-8f00-123456789abc/registry-check'),
        s,
      ).expect(404);
    });
  });
});
