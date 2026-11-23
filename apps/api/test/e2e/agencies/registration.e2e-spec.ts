import {
  AgencyDocumentType,
  AgencyStatus,
  MediaPurpose,
  MediaVisibility,
  UserRole,
} from '@house/shared';
import { SessionService } from '../../../src/modules/auth/session/session.service';
import {
  createAgency,
  createMedia,
  createTestApp,
  createUser,
  loginUser,
  resetAll,
  withSession,
  type TestApp,
} from '../../utils';
import { createDocumentMedia, createPendingAgency, pluck, registerBody } from './helpers';

describe('agencies: registration & my agency (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  it('runs against its own database and Redis index', async () => {
    expect(process.env.DATABASE_URL).toContain('/house_test_agencies?');
    const [row] = await t.prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    expect(row?.db).toBe('house_test_agencies');
    expect(t.redis.options.db).toBe(4);
  });

  describe('POST /api/v1/agencies', () => {
    it('201: creates a PENDING application with owner membership, documents and history', async () => {
      const user = await createUser(t.prisma);
      const doc = await createDocumentMedia(t.prisma, user.id);
      const s = await loginUser(t.app, user);
      const body = registerBody(doc.id, { registrationNumber: '제46150-2026-00001호' });
      const res = await withSession(t.http().post('/api/v1/agencies'), s).send(body).expect(201);

      expect(res.body).toMatchObject({
        name: body.name,
        registrationNumber: '46150-2026-00001',
        businessNumber: '2208162517',
        phone: '0617491234',
        mobile: '01012345678',
        status: AgencyStatus.PENDING,
        emdCode: '46150101',
        memberCount: 1,
        specialties: ['APT', 'ONEROOM'],
        businessHours: { mon: { open: '09:00', close: '18:00' }, sun: null },
      });
      expect(res.body.documents).toHaveLength(1);
      expect(res.body.documents[0]).toMatchObject({ type: 'REGISTRATION_CERT', mediaId: doc.id });
      expect(res.body.documents[0]).not.toHaveProperty('storageKey');
      expect(res.body.statusHistory[0]).toMatchObject({ fromStatus: null, toStatus: 'PENDING' });

      const agency = await t.prisma.agency.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(agency.sggCode).toBe('46150');
      const member = await t.prisma.agencyMember.findFirstOrThrow({
        where: { agencyId: agency.id },
      });
      expect(member).toMatchObject({ userId: user.id, role: 'OWNER', status: 'ACTIVE' });
      // Role changes only on approval; the session already acts for the application.
      expect((await t.prisma.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe('USER');
      const [session] = await t.app.get(SessionService).listForSubject('USER', user.id);
      expect(session?.agencyId).toBe(agency.id);
    });

    it('401 without a session, 403 without CSRF token', async () => {
      await t.http().post('/api/v1/agencies').send({}).expect(401);
      const user = await createUser(t.prisma);
      const s = await loginUser(t.app, user);
      await t
        .http()
        .post('/api/v1/agencies')
        .set('Cookie', s.cookie)
        .set('Origin', s.origin)
        .send({})
        .expect(403);
    });

    it('400 on invalid payloads (bad 사업자번호, missing 등록증)', async () => {
      const user = await createUser(t.prisma);
      const doc = await createDocumentMedia(t.prisma, user.id);
      const s = await loginUser(t.app, user);
      const res = await withSession(t.http().post('/api/v1/agencies'), s)
        .send(registerBody(doc.id, { businessNumber: '1234567890' }))
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      await withSession(t.http().post('/api/v1/agencies'), s)
        .send(registerBody(doc.id, { documents: [{ type: 'OTHER', mediaId: doc.id }] }))
        .expect(400);
    });

    it('400 AGENCY_DOCUMENT_INVALID for media of another user, public media or reused documents', async () => {
      const user = await createUser(t.prisma);
      const other = await createUser(t.prisma);
      const s = await loginUser(t.app, user);
      const foreign = await createDocumentMedia(t.prisma, other.id);
      const publicPhoto = await createMedia(t.prisma, {
        ownerUserId: user.id,
        purpose: MediaPurpose.AGENCY_DOCUMENT,
        visibility: MediaVisibility.PUBLIC,
      });
      const pending = await createDocumentMedia(t.prisma, user.id, { status: 'PENDING' });
      for (const mediaId of [foreign.id, publicPhoto.id, pending.id]) {
        const res = await withSession(t.http().post('/api/v1/agencies'), s)
          .send(registerBody(mediaId))
          .expect(400);
        expect(res.body.code).toBe('AGENCY_DOCUMENT_INVALID');
      }
      // A document already attached to another agency cannot be reused.
      const { agency } = await createPendingAgency(t.prisma);
      const used = await createDocumentMedia(t.prisma, user.id);
      await t.prisma.agencyDocument.create({
        data: { agencyId: agency.id, type: 'OTHER', mediaId: used.id },
      });
      await withSession(t.http().post('/api/v1/agencies'), s)
        .send(registerBody(used.id))
        .expect(400);
      expect(await t.prisma.agency.count({ where: { ownerUserId: user.id } })).toBe(0);
    });

    it('409 for a duplicate 등록번호, a second application or an existing membership', async () => {
      const { agency } = await createAgency(t.prisma);
      const user = await createUser(t.prisma);
      const s = await loginUser(t.app, user);
      const doc1 = await createDocumentMedia(t.prisma, user.id);
      const dup = await withSession(t.http().post('/api/v1/agencies'), s)
        .send(registerBody(doc1.id, { registrationNumber: agency.registrationNumber }))
        .expect(409);
      expect(dup.body.code).toBe('AGENCY_REGISTRATION_DUPLICATE');

      await withSession(t.http().post('/api/v1/agencies'), s)
        .send(registerBody(doc1.id))
        .expect(201);
      const doc2 = await createDocumentMedia(t.prisma, user.id);
      const again = await withSession(t.http().post('/api/v1/agencies'), s)
        .send(registerBody(doc2.id))
        .expect(409);
      expect(again.body.code).toBe('AGENCY_ALREADY_REGISTERED');

      const agent = await createUser(t.prisma, { role: UserRole.AGENT });
      await t.prisma.agencyMember.create({
        data: { agencyId: agency.id, userId: agent.id, displayName: '직원' },
      });
      const sa = await loginUser(t.app, agent, { agencyId: agency.id });
      const doc3 = await createDocumentMedia(t.prisma, agent.id);
      const member = await withSession(t.http().post('/api/v1/agencies'), sa)
        .send(registerBody(doc3.id))
        .expect(409);
      expect(member.body.code).toBe('AGENCY_ALREADY_MEMBER');
    });
  });

  describe('GET/PATCH /api/v1/agencies/mine', () => {
    it('200: returns the own agency incl. status history; 404 for users without one', async () => {
      const { agency, owner } = await createPendingAgency(t.prisma);
      const s = await loginUser(t.app, owner, { agencyId: agency.id });
      const res = await withSession(t.http().get('/api/v1/agencies/mine'), s).expect(200);
      expect(res.body).toMatchObject({ id: agency.id, status: 'PENDING', memberCount: 1 });
      expect(res.body.documents).toHaveLength(1);

      const stranger = await loginUser(t.app, await createUser(t.prisma));
      const nf = await withSession(t.http().get('/api/v1/agencies/mine'), stranger).expect(404);
      expect(nf.body.code).toBe('AGENCY_NOT_FOUND');
      await t.http().get('/api/v1/agencies/mine').expect(401);
    });

    it('200: owner updates profile fields and logo; 시군구 follows 읍면동', async () => {
      const { agency, owner } = await createAgency(t.prisma);
      const logo = await createMedia(t.prisma, {
        ownerUserId: owner.id,
        purpose: MediaPurpose.AGENCY_LOGO,
        storageKey: 'logos/a.webp',
        variants: { thumb: { key: 'logos/a.thumb.webp' } },
      });
      const s = await loginUser(t.app, owner, { agencyId: agency.id });
      const res = await withSession(t.http().patch('/api/v1/agencies/mine'), s)
        .send({
          intro: '새 소개',
          phone: '1588-1234',
          emdCode: '4615025300',
          logoMediaId: logo.id,
          businessHours: null,
          specialties: ['LAND', 'LAND'],
        })
        .expect(200);
      expect(res.body).toMatchObject({
        intro: '새 소개',
        phone: '15881234',
        emdCode: '4615025300',
        logoMediaId: logo.id,
        logoUrl: '/media/logos/a.thumb.webp',
        businessHours: null,
        specialties: ['LAND'],
        // Certificate fields are not editable here.
        name: agency.name,
      });
      const row = await t.prisma.agency.findUniqueOrThrow({ where: { id: agency.id } });
      expect(row.sggCode).toBe('46150');
    });

    it('400: validation (empty body, lat without lng, foreign logo); 404 for non-owners', async () => {
      const { agency, owner } = await createAgency(t.prisma);
      const s = await loginUser(t.app, owner, { agencyId: agency.id });
      await withSession(t.http().patch('/api/v1/agencies/mine'), s).send({}).expect(400);
      await withSession(t.http().patch('/api/v1/agencies/mine'), s).send({ lat: 34.9 }).expect(400);
      // Certificate fields are stripped, leaving nothing to change.
      await withSession(t.http().patch('/api/v1/agencies/mine'), s)
        .send({ name: '이름변경' })
        .expect(400);
      const otherLogo = await createMedia(t.prisma, { purpose: MediaPurpose.AGENCY_LOGO });
      const bad = await withSession(t.http().patch('/api/v1/agencies/mine'), s)
        .send({ logoMediaId: otherLogo.id })
        .expect(400);
      expect(bad.body.code).toBe('AGENCY_LOGO_INVALID');

      // A member who is not the owner has no "mine" agency.
      const agent = await createUser(t.prisma, { role: UserRole.AGENT });
      await t.prisma.agencyMember.create({
        data: { agencyId: agency.id, userId: agent.id, displayName: '직원' },
      });
      const sa = await loginUser(t.app, agent, { agencyId: agency.id });
      await withSession(t.http().patch('/api/v1/agencies/mine'), sa)
        .send({ intro: 'hack' })
        .expect(404);
    });

    it('400 AGENCY_NOT_EDITABLE for rejected/suspended agencies', async () => {
      const { agency, owner } = await createAgency(t.prisma, { status: AgencyStatus.SUSPENDED });
      const s = await loginUser(t.app, owner, { agencyId: agency.id });
      const res = await withSession(t.http().patch('/api/v1/agencies/mine'), s)
        .send({ intro: 'x' })
        .expect(400);
      expect(res.body.code).toBe('AGENCY_NOT_EDITABLE');
    });
  });

  describe('POST /api/v1/agencies/mine/resubmit', () => {
    it('200: REJECTED → PENDING with corrections, extra documents and a history row', async () => {
      const { agency, owner } = await createPendingAgency(t.prisma, {
        status: AgencyStatus.REJECTED,
        statusReason: '서류 불명확',
      });
      const doc = await createDocumentMedia(t.prisma, owner.id);
      const s = await loginUser(t.app, owner);
      const res = await withSession(t.http().post('/api/v1/agencies/mine/resubmit'), s)
        .send({
          representativeName: '홍길순',
          documents: [{ type: AgencyDocumentType.BUSINESS_REG_CERT, mediaId: doc.id }],
          message: '선명한 사본으로 다시 올립니다.',
        })
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'PENDING',
        statusReason: null,
        representativeName: '홍길순',
      });
      expect(res.body.documents).toHaveLength(2);
      expect(res.body.statusHistory[0]).toMatchObject({
        fromStatus: 'REJECTED',
        toStatus: 'PENDING',
        reason: '선명한 사본으로 다시 올립니다.',
        decidedBy: null,
      });
      const [session] = await t.app.get(SessionService).listForSubject('USER', owner.id);
      expect(session?.agencyId).toBe(agency.id);
    });

    it('400 for a non-rejected agency or invalid body; 401 anonymous; 404 without an agency', async () => {
      const { agency, owner } = await createPendingAgency(t.prisma);
      const s = await loginUser(t.app, owner, { agencyId: agency.id });
      const res = await withSession(t.http().post('/api/v1/agencies/mine/resubmit'), s)
        .send({})
        .expect(400);
      expect(res.body.code).toBe('AGENCY_INVALID_STATUS_TRANSITION');
      await withSession(t.http().post('/api/v1/agencies/mine/resubmit'), s)
        .send({ businessNumber: '1111111111' })
        .expect(400);
      await t.http().post('/api/v1/agencies/mine/resubmit').send({}).expect(401);
      const stranger = await loginUser(t.app, await createUser(t.prisma));
      await withSession(t.http().post('/api/v1/agencies/mine/resubmit'), stranger)
        .send({})
        .expect(404);
    });
  });

  describe('documents', () => {
    it('GET/POST/DELETE /api/v1/agencies/mine/documents happy path', async () => {
      const { agency, owner, document } = await createPendingAgency(t.prisma);
      const s = await loginUser(t.app, owner, { agencyId: agency.id });
      const extra = await createDocumentMedia(t.prisma, owner.id);
      const added = await withSession(t.http().post('/api/v1/agencies/mine/documents'), s)
        .send({ type: 'REGISTRATION_CERT', mediaId: extra.id })
        .expect(201);
      expect(added.body).toMatchObject({ type: 'REGISTRATION_CERT', mediaId: extra.id });

      const list = await withSession(t.http().get('/api/v1/agencies/mine/documents'), s).expect(
        200,
      );
      expect(pluck(list.body, 'mediaId')).toEqual([document.id, extra.id]);

      await withSession(
        t.http().delete(`/api/v1/agencies/mine/documents/${added.body.id}`),
        s,
      ).expect(204);
      // The last 등록증 cannot be removed.
      const firstId = list.body[0].id as string;
      const last = await withSession(
        t.http().delete(`/api/v1/agencies/mine/documents/${firstId}`),
        s,
      ).expect(400);
      expect(last.body.code).toBe('AGENCY_DOCUMENT_REQUIRED');
    });

    it("authz: 401 anonymous; 404 for another agency's document; approved agencies keep documents", async () => {
      await t.http().get('/api/v1/agencies/mine/documents').expect(401);
      const a = await createPendingAgency(t.prisma);
      const b = await createPendingAgency(t.prisma);
      const sb = await loginUser(t.app, b.owner, { agencyId: b.agency.id });
      const aDoc = await t.prisma.agencyDocument.findFirstOrThrow({
        where: { agencyId: a.agency.id },
      });
      const nf = await withSession(
        t.http().delete(`/api/v1/agencies/mine/documents/${aDoc.id}`),
        sb,
      ).expect(404);
      expect(nf.body.code).toBe('AGENCY_DOCUMENT_NOT_FOUND');

      const { agency, owner } = await createAgency(t.prisma);
      const doc = await createDocumentMedia(t.prisma, owner.id);
      const s = await loginUser(t.app, owner, { agencyId: agency.id });
      const added = await withSession(t.http().post('/api/v1/agencies/mine/documents'), s)
        .send({ type: 'OTHER', mediaId: doc.id })
        .expect(201);
      const locked = await withSession(
        t.http().delete(`/api/v1/agencies/mine/documents/${added.body.id}`),
        s,
      ).expect(400);
      expect(locked.body.code).toBe('AGENCY_NOT_EDITABLE');
    });

    it('400 for invalid ids and payloads', async () => {
      const { agency, owner } = await createPendingAgency(t.prisma);
      const s = await loginUser(t.app, owner, { agencyId: agency.id });
      await withSession(t.http().post('/api/v1/agencies/mine/documents'), s)
        .send({ type: 'SELFIE', mediaId: 'nope' })
        .expect(400);
      await withSession(t.http().delete('/api/v1/agencies/mine/documents/not-a-uuid'), s).expect(
        400,
      );
      const foreign = await createDocumentMedia(t.prisma, (await createUser(t.prisma)).id);
      const res = await withSession(t.http().post('/api/v1/agencies/mine/documents'), s)
        .send({ type: 'OTHER', mediaId: foreign.id })
        .expect(400);
      expect(res.body.code).toBe('AGENCY_DOCUMENT_INVALID');
    });
  });
});
