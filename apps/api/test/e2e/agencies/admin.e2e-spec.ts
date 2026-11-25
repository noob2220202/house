import { AdminRole, AgencyStatus, UserRole, type BrokerRegistryRecord } from '@house/shared';
import { BROKER_REGISTRY } from '../../../src/modules/agencies/clients/broker-registry.client';
import { SessionService } from '../../../src/modules/auth/session/session.service';
import {
  actionConsents,
  createActionConsentTerms,
  createAdmin,
  createAgency,
  createComplex,
  createListing,
  createTestApp,
  createUser,
  loginAdmin,
  loginUser,
  resetAll,
  withSession,
  type TestApp,
} from '../../utils';
import {
  FakeBrokerRegistry,
  createAgent,
  createPendingAgency,
  pluck,
  writePrivateFile,
} from './helpers';

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
    await createActionConsentTerms(t.prisma);
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
        documentTypes: ['REGISTRATION_CERT'],
        activeListingCount: 0,
        memberCount: 1,
        owner: { id: first.owner.id },
      });
      // Lists mask the applicant's contacts.
      const owner = res.body.items[0].owner as { name: string | null; email: string | null };
      expect(owner.email).toMatch(/^.{1,2}\*\*\*@/);
      expect(owner.email).not.toBe(first.owner.email);
      if (first.owner.name) expect(owner.name).not.toBe(first.owner.name);
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
      await t.prisma.identity.create({
        data: { userId: owner.id, provider: 'GOOGLE', providerUserId: `g-${owner.id}` },
      });
      await t.prisma.agency.update({ where: { id: agency.id }, data: { viewCount: 7 } });
      const { s } = await admin();
      const res = await withSession(t.http().get(`/api/v1/admin/agencies/${agency.id}`), s).expect(
        200,
      );
      expect(res.body).toMatchObject({
        id: agency.id,
        status: 'PENDING',
        businessNumber: '2208162517',
        owner: {
          id: owner.id,
          email: owner.email,
          createdAt: owner.createdAt.toISOString(),
          providers: ['GOOGLE'],
        },
        viewCount: 7,
        warningCount: 0,
      });
      expect(res.body.documents).toHaveLength(1);
      expect(res.body.members).toHaveLength(1);
    });

    it('records each full view as a 개인정보 접속기록; REMOVED staff only on request, masked', async () => {
      const { agency } = await createAgency(t.prisma);
      const active = await createAgent(t.prisma, agency.id);
      const gone = await createAgent(t.prisma, agency.id);
      await t.prisma.agencyMember.update({
        where: { id: gone.memberId },
        data: { status: 'REMOVED', removedAt: new Date() },
      });
      const { admin: viewer, s } = await admin();
      const res = await withSession(t.http().get(`/api/v1/admin/agencies/${agency.id}`), s).expect(
        200,
      );
      expect(pluck(res.body.members, 'id')).not.toContain(gone.memberId);
      expect(res.body.members).toContainEqual(
        expect.objectContaining({ id: active.memberId, phone: '01099998888' }),
      );
      const audit = await t.prisma.auditLog.findFirstOrThrow({
        where: { action: 'agency.pii-view', resourceId: agency.id },
      });
      expect(audit).toMatchObject({ adminUserId: viewer.id, resourceType: 'Agency' });
      expect(JSON.stringify(audit.after)).not.toContain('01099998888');

      const all = await withSession(
        t.http().get(`/api/v1/admin/agencies/${agency.id}?includeRemoved=true`),
        s,
      ).expect(200);
      expect(all.body.members).toContainEqual(
        expect.objectContaining({ id: gone.memberId, phone: '010-****-8888' }),
      );
      await withSession(
        t.http().get(`/api/v1/admin/agencies/${agency.id}?includeRemoved=maybe`),
        s,
      ).expect(400);
      expect(await t.prisma.auditLog.count({ where: { action: 'agency.pii-view' } })).toBe(2);
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
      // Mutation responses mask contacts (the full view is the audited GET).
      expect(res.body.owner.email).not.toBe(owner.email);
      expect(res.body.owner.email).toMatch(/\*\*\*@/);
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
        .send({ code: invite.body.code, displayName: 'x', consents: actionConsents('AGENCY_JOIN') })
        .expect(400);

      // Lifting a suspension is as privileged as imposing it.
      const liftByOperator = await withSession(
        t.http().post(`/api/v1/admin/agencies/${agency.id}/decision`),
        operator.s,
      )
        .send({ status: 'APPROVED' })
        .expect(403);
      expect(liftByOperator.body.code).toBe('AGENCY_DECISION_FORBIDDEN');
      expect((await t.prisma.agency.findUniqueOrThrow({ where: { id: agency.id } })).status).toBe(
        AgencyStatus.SUSPENDED,
      );

      const reinstated = await withSession(
        t.http().post(`/api/v1/admin/agencies/${agency.id}/decision`),
        s,
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

    it("suspension takes the office's listings off public search, detail and counters; reinstate restores them", async () => {
      const { agency } = await createAgency(t.prisma);
      const { agency: coBroker } = await createAgency(t.prisma);
      const complex = await createComplex(t.prisma);
      const { listing } = await createListing(t.prisma, {
        agencyId: agency.id,
        property: { complexId: complex.id },
        listing: { complexId: complex.id },
      });
      await t.prisma.listingAgency.create({
        data: { listingId: listing.id, agencyId: coBroker.id },
      });
      const counts = async () => ({
        agency: (await t.prisma.agency.findUniqueOrThrow({ where: { id: agency.id } }))
          .activeListingCount,
        coBroker: (await t.prisma.agency.findUniqueOrThrow({ where: { id: coBroker.id } }))
          .activeListingCount,
        complex: (await t.prisma.complex.findUniqueOrThrow({ where: { id: complex.id } }))
          .activeListingCount,
      });
      const listed = async () =>
        pluck((await t.http().get('/api/v1/listings').expect(200)).body.items, 'id');

      // Warm the cached search so a stale hit would show the listing after suspension.
      expect(await listed()).toEqual([listing.id]);
      await t.http().get(`/api/v1/listings/${listing.id}`).expect(200);

      const { s } = await admin(AdminRole.ADMIN);
      const decide = (status: string, reason?: string) =>
        withSession(t.http().post(`/api/v1/admin/agencies/${agency.id}/decision`), s)
          .send({ status, reason })
          .expect(200);

      await decide('SUSPENDED', '허위매물 반복');
      expect(await listed()).toEqual([]);
      await t.http().get(`/api/v1/listings/${listing.id}`).expect(404);
      // The co-broker's public profile no longer counts it either.
      const profile = await t.http().get(`/api/v1/agencies/${coBroker.id}`).expect(200);
      expect(profile.body.listingCounts?.total ?? 0).toBe(0);
      expect(await counts()).toEqual({ agency: 0, coBroker: 0, complex: 0 });

      await decide('APPROVED');
      expect(await listed()).toEqual([listing.id]);
      await t.http().get(`/api/v1/listings/${listing.id}`).expect(200);
      expect(await counts()).toEqual({ agency: 1, coBroker: 1, complex: 1 });
    });

    it('approving one application for a 등록번호 auto-rejects competing pending ones', async () => {
      const real = await createPendingAgency(t.prisma, { registrationNumber: '46150-2026-04444' });
      const fake = await createPendingAgency(t.prisma, { registrationNumber: '46150202604444' });
      const fakeSession = await loginUser(t.app, fake.owner, { agencyId: fake.agency.id });
      const other = await createPendingAgency(t.prisma);
      const { admin: reviewer, s } = await admin();
      await withSession(t.http().post(`/api/v1/admin/agencies/${real.agency.id}/decision`), s)
        .send({ status: 'APPROVED' })
        .expect(200);

      const lost = await t.prisma.agency.findUniqueOrThrow({ where: { id: fake.agency.id } });
      expect(lost).toMatchObject({ status: 'REJECTED', statusReason: expect.any(String) });
      expect(
        (await t.prisma.agency.findUniqueOrThrow({ where: { id: other.agency.id } })).status,
      ).toBe('PENDING');
      const history = await t.prisma.agencyStatusHistory.findFirstOrThrow({
        where: { agencyId: fake.agency.id, toStatus: 'REJECTED' },
      });
      expect(history).toMatchObject({ fromStatus: 'PENDING', decidedByAdminId: reviewer.id });
      const note = await t.prisma.notification.findFirstOrThrow({
        where: { userId: fake.owner.id },
      });
      expect(note.type).toBe('AGENCY_REJECTED');
      const audit = await t.prisma.auditLog.findFirstOrThrow({
        where: { action: 'agency.reject', resourceId: fake.agency.id },
      });
      expect(audit.after).toMatchObject({ duplicateOfAgencyId: real.agency.id });
      const [session] = await t.app.get(SessionService).listForSubject('USER', fake.owner.id);
      expect(session?.agencyId).toBeNull();
      const mine = await withSession(t.http().get('/api/v1/agencies/mine'), fakeSession).expect(
        200,
      );
      expect(mine.body.status).toBe('REJECTED');
    });

    it('409 approving while another live office holds the 등록번호', async () => {
      const { agency: live } = await createAgency(t.prisma, {
        registrationNumber: '46150-2026-05555',
      });
      const { agency } = await createPendingAgency(t.prisma, {
        registrationNumber: '46150-2026-05555',
      });
      const { s } = await admin();
      const res = await withSession(
        t.http().post(`/api/v1/admin/agencies/${agency.id}/decision`),
        s,
      )
        .send({ status: 'APPROVED' })
        .expect(409);
      expect(res.body).toMatchObject({
        code: 'AGENCY_REGISTRATION_DUPLICATE',
        details: { agencyId: live.id },
      });
      expect((await t.prisma.agency.findUniqueOrThrow({ where: { id: agency.id } })).status).toBe(
        'PENDING',
      );
      // Rejecting it is still possible.
      await withSession(t.http().post(`/api/v1/admin/agencies/${agency.id}/decision`), s)
        .send({ status: 'REJECTED', reason: '이미 등록된 사무소입니다.' })
        .expect(200);
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

  describe('DELETE /api/v1/admin/agencies/:id', () => {
    it('204: soft-deletes a pending application, frees the applicant and audits it', async () => {
      const { agency, owner } = await createPendingAgency(t.prisma, {
        registrationNumber: '46150-2026-06666',
      });
      await loginUser(t.app, owner, { agencyId: agency.id });
      const { admin: reviewer, s } = await admin();
      await withSession(t.http().delete(`/api/v1/admin/agencies/${agency.id}`), s)
        .send({ reason: '허위 신청 (등록번호 도용)' })
        .expect(204);

      const row = await t.prisma.agency.findUniqueOrThrow({ where: { id: agency.id } });
      expect(row).toMatchObject({ status: 'REJECTED', deletedAt: expect.any(Date) });
      expect(
        await t.prisma.agencyMember.count({ where: { agencyId: agency.id, status: 'ACTIVE' } }),
      ).toBe(0);
      const audit = await t.prisma.auditLog.findFirstOrThrow({
        where: { action: 'agency.delete', resourceId: agency.id },
      });
      expect(audit).toMatchObject({ adminUserId: reviewer.id, resourceType: 'Agency' });
      expect(audit.before).toMatchObject({
        status: 'PENDING',
        registrationNumber: '46150-2026-06666',
      });
      const [session] = await t.app.get(SessionService).listForSubject('USER', owner.id);
      expect(session?.agencyId).toBeNull();
      await withSession(t.http().get(`/api/v1/admin/agencies/${agency.id}`), s).expect(404);
      const queue = await withSession(t.http().get('/api/v1/admin/agencies'), s).expect(200);
      expect(pluck(queue.body.items, 'id')).not.toContain(agency.id);

      // The applicant may apply again; a rejected application can be deleted as well.
      const so = await loginUser(t.app, owner);
      await withSession(t.http().get('/api/v1/agencies/mine'), so).expect(404);
      const rejected = await createPendingAgency(t.prisma, { status: AgencyStatus.REJECTED });
      await withSession(t.http().delete(`/api/v1/admin/agencies/${rejected.agency.id}`), s)
        .send({ reason: '중복 신청' })
        .expect(204);
    });

    it('400 for live offices or a missing reason; 401 for users; 404 unknown / already deleted', async () => {
      const { agency } = await createAgency(t.prisma);
      const { s } = await admin(AdminRole.SUPER_ADMIN);
      const live = await withSession(t.http().delete(`/api/v1/admin/agencies/${agency.id}`), s)
        .send({ reason: 'x' })
        .expect(400);
      expect(live.body.code).toBe('AGENCY_NOT_DELETABLE');
      const pending = await createPendingAgency(t.prisma);
      const noReason = await withSession(
        t.http().delete(`/api/v1/admin/agencies/${pending.agency.id}`),
        s,
      )
        .send({})
        .expect(400);
      expect(noReason.body.code).toBe('VALIDATION_FAILED');
      const user = await loginUser(t.app, await createUser(t.prisma));
      await withSession(t.http().delete(`/api/v1/admin/agencies/${pending.agency.id}`), user)
        .send({ reason: 'x' })
        .expect(401);
      await withSession(
        t.http().delete('/api/v1/admin/agencies/0190f3c2-7a4b-7cde-8f00-123456789abc'),
        s,
      )
        .send({ reason: 'x' })
        .expect(404);
      await withSession(t.http().delete(`/api/v1/admin/agencies/${pending.agency.id}`), s)
        .send({ reason: 'x' })
        .expect(204);
      await withSession(t.http().delete(`/api/v1/admin/agencies/${pending.agency.id}`), s)
        .send({ reason: 'x' })
        .expect(404);
      expect(
        (await t.prisma.agency.findUniqueOrThrow({ where: { id: agency.id } })).deletedAt,
      ).toBeNull();
    });
  });

  describe('PATCH /api/v1/admin/agencies/:id/location', () => {
    it('200: an admin applies the 소재지 change of an approved office, audited and notified', async () => {
      const { agency, owner } = await createAgency(t.prisma);
      const { admin: a, s } = await admin();
      const res = await withSession(
        t.http().patch(`/api/v1/admin/agencies/${agency.id}/location`),
        s,
      )
        .send({
          roadAddress: '전남광주통합특별시 순천시 연향로 5',
          addressDetail: '2층',
          emdCode: '1215010800',
          lat: 34.95,
          lng: 127.52,
          reason: '이전신고 확인 (등록증 재발급본)',
        })
        .expect(200);
      expect(res.body).toMatchObject({
        roadAddress: '전남광주통합특별시 순천시 연향로 5',
        addressDetail: '2층',
        emdCode: '1215010800',
        lat: 34.95,
        lng: 127.52,
      });
      const [geo] = await t.prisma.$queryRaw<{ lat: number }[]>`
        SELECT ST_Y(location::geometry) AS lat FROM agencies WHERE id = ${agency.id}::uuid`;
      expect(geo?.lat).toBeCloseTo(34.95);
      const audit = await t.prisma.auditLog.findFirstOrThrow({
        where: { action: 'agency.location.update', resourceId: agency.id },
      });
      expect(audit).toMatchObject({
        adminUserId: a.id,
        before: { roadAddress: agency.roadAddress },
        after: {
          roadAddress: '전남광주통합특별시 순천시 연향로 5',
          reason: '이전신고 확인 (등록증 재발급본)',
        },
      });
      expect(await t.prisma.notification.count({ where: { userId: owner.id } })).toBe(1);
    });

    it('400 for an empty change, a missing reason or a pending application; 401/404', async () => {
      const { agency } = await createAgency(t.prisma);
      const { s } = await admin();
      const url = `/api/v1/admin/agencies/${agency.id}/location`;
      await withSession(t.http().patch(url), s).send({ reason: '확인' }).expect(400);
      await withSession(t.http().patch(url), s).send({ roadAddress: '순천시 어딘가' }).expect(400);
      await withSession(t.http().patch(url), s).send({ lat: 34.9, reason: '확인' }).expect(400);

      const pending = await createPendingAgency(t.prisma);
      const notEditable = await withSession(
        t.http().patch(`/api/v1/admin/agencies/${pending.agency.id}/location`),
        s,
      )
        .send({ roadAddress: '순천시 어딘가', reason: '확인' })
        .expect(400);
      expect(notEditable.body.code).toBe('AGENCY_NOT_EDITABLE');

      await withSession(
        t.http().patch('/api/v1/admin/agencies/0190f3c2-7a4b-7cde-8f00-123456789abc/location'),
        s,
      )
        .send({ roadAddress: '순천시 어딘가', reason: '확인' })
        .expect(404);
      const owner = await t.prisma.user.findUniqueOrThrow({ where: { id: agency.ownerUserId } });
      const user = await loginUser(t.app, owner, { agencyId: agency.id });
      await withSession(t.http().patch(url), user)
        .send({ roadAddress: '순천시 어딘가', reason: '확인' })
        .expect(401);
      expect(
        (await t.prisma.agency.findUniqueOrThrow({ where: { id: agency.id } })).roadAddress,
      ).toBe(agency.roadAddress);
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
        regionName: '전남광주통합특별시 순천시',
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
