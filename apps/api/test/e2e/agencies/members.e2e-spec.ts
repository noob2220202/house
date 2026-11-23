import { AgencyStatus, UserRole } from '@house/shared';
import { SessionService } from '../../../src/modules/auth/session/session.service';
import {
  createAgency,
  createListing,
  createTestApp,
  createUser,
  loginUser,
  resetAll,
  withSession,
  type TestApp,
  type TestSession,
} from '../../utils';
import { createAgent, createPendingAgency, pluck } from './helpers';

describe('agencies: staff, invites & membership (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  async function ownerSession() {
    const { agency, owner } = await createAgency(t.prisma);
    const s = await loginUser(t.app, owner, { agencyId: agency.id });
    return { agency, owner, s };
  }

  async function issueInvite(s: TestSession, body: Record<string, unknown> = {}) {
    const res = await withSession(t.http().post('/api/v1/agencies/mine/invites'), s)
      .send(body)
      .expect(201);
    return res.body as { id: string; code: string; codeHint: string; expiresAt: string };
  }

  describe('invites', () => {
    it('POST/GET/DELETE /api/v1/agencies/mine/invites happy path', async () => {
      const { s } = await ownerSession();
      const invite = await issueInvite(s, { label: '김실장', expiresInHours: 24 });
      expect(invite.code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
      expect(invite.codeHint).toBe(invite.code.slice(-4));
      // Body-less creation uses the defaults.
      await withSession(t.http().post('/api/v1/agencies/mine/invites'), s).expect(201);

      const list = await withSession(t.http().get('/api/v1/agencies/mine/invites'), s).expect(200);
      expect(list.body).toHaveLength(2);
      expect(pluck(list.body, 'code').every((c) => c === undefined)).toBe(true);
      expect((list.body as { id: string }[]).find((i) => i.id === invite.id)).toMatchObject({
        label: '김실장',
      });

      await withSession(t.http().delete(`/api/v1/agencies/mine/invites/${invite.id}`), s).expect(
        204,
      );
      const after = await withSession(t.http().get('/api/v1/agencies/mine/invites'), s).expect(200);
      expect(after.body).toHaveLength(1);
      // Revoked codes cannot be redeemed.
      const joiner = await loginUser(t.app, await createUser(t.prisma));
      await withSession(t.http().post('/api/v1/agencies/join'), joiner)
        .send({ code: invite.code, displayName: '김실장' })
        .expect(400);
    });

    it("authz: 401 anonymous, 403 for plain users / agents, 403 for a suspended owner, 404 for another agency's invite", async () => {
      await t.http().get('/api/v1/agencies/mine/invites').expect(401);
      const user = await loginUser(t.app, await createUser(t.prisma));
      await withSession(t.http().post('/api/v1/agencies/mine/invites'), user).send({}).expect(403);

      const { agency, s } = await ownerSession();
      const { user: agent } = await createAgent(t.prisma, agency.id);
      const sa = await loginUser(t.app, agent, { agencyId: agency.id });
      await withSession(t.http().get('/api/v1/agencies/mine/invites'), sa).expect(403);

      const other = await ownerSession();
      const invite = await issueInvite(other.s);
      const nf = await withSession(
        t.http().delete(`/api/v1/agencies/mine/invites/${invite.id}`),
        s,
      ).expect(404);
      expect(nf.body.code).toBe('AGENCY_INVITE_NOT_FOUND');

      const suspended = await createAgency(t.prisma, { status: AgencyStatus.SUSPENDED });
      const ss = await loginUser(t.app, suspended.owner, { agencyId: suspended.agency.id });
      const res = await withSession(t.http().post('/api/v1/agencies/mine/invites'), ss)
        .send({})
        .expect(403);
      expect(res.body.code).toBe('AGENCY_NOT_APPROVED');
    });

    it('400 for invalid input', async () => {
      const { s } = await ownerSession();
      await withSession(t.http().post('/api/v1/agencies/mine/invites'), s)
        .send({ expiresInHours: 0 })
        .expect(400);
      await withSession(t.http().post('/api/v1/agencies/mine/invites'), s)
        .send({ label: 'x'.repeat(51) })
        .expect(400);
      await withSession(t.http().delete('/api/v1/agencies/mine/invites/NOT-AN-ID'), s).expect(400);
    });
  });

  describe('POST /api/v1/agencies/join', () => {
    it('201: redeems a code once; user becomes AGENT and sessions follow', async () => {
      const { agency, s } = await ownerSession();
      const invite = await issueInvite(s);
      const user = await createUser(t.prisma);
      const su = await loginUser(t.app, user);
      const formatted = `${invite.code.slice(0, 5).toLowerCase()}-${invite.code.slice(5)}`;
      const res = await withSession(t.http().post('/api/v1/agencies/join'), su)
        .send({
          code: formatted,
          displayName: '김실장',
          phone: '010-2222-3333',
          isLicensed: true,
          licenseNumber: '2020-1234',
        })
        .expect(201);
      expect(res.body).toMatchObject({
        role: 'AGENT',
        displayName: '김실장',
        agency: { id: agency.id, status: 'APPROVED' },
      });
      expect((await t.prisma.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe(
        'AGENT',
      );
      const [session] = await t.app.get(SessionService).listForSubject('USER', user.id);
      expect(session).toMatchObject({ role: 'AGENT', agencyId: agency.id });
      // The self-declared license is ignored: a joiner is a 중개보조원 until the owner confirms.
      const member = await t.prisma.agencyMember.findFirstOrThrow({
        where: { agencyId: agency.id, userId: user.id },
      });
      expect(member).toMatchObject({ isLicensed: false, licenseNumber: null });
      const profile = await t.http().get(`/api/v1/agencies/${agency.id}`).expect(200);
      expect(pluck(profile.body.members, 'id')).not.toContain(member.id);

      // Single use.
      const second = await loginUser(t.app, await createUser(t.prisma));
      const reused = await withSession(t.http().post('/api/v1/agencies/join'), second)
        .send({ code: invite.code, displayName: '박실장' })
        .expect(400);
      expect(reused.body.code).toBe('AGENCY_INVITE_INVALID');
    });

    it('409 for users already in a live agency (and the code survives the refusal)', async () => {
      const { s } = await ownerSession();
      const invite = await issueInvite(s);
      const other = await createPendingAgency(t.prisma);
      const so = await loginUser(t.app, other.owner, { agencyId: other.agency.id });
      const res = await withSession(t.http().post('/api/v1/agencies/join'), so)
        .send({ code: invite.code, displayName: '홍길동' })
        .expect(409);
      expect(res.body.code).toBe('AGENCY_ALREADY_MEMBER');
      const fresh = await loginUser(t.app, await createUser(t.prisma));
      await withSession(t.http().post('/api/v1/agencies/join'), fresh)
        .send({ code: invite.code, displayName: '새직원' })
        .expect(201);
    });

    it('a removed agent can rejoin with a new code', async () => {
      const { agency, s } = await ownerSession();
      const { user, memberId } = await createAgent(t.prisma, agency.id);
      await withSession(t.http().delete(`/api/v1/agencies/mine/members/${memberId}`), s).expect(
        204,
      );
      const invite = await issueInvite(s);
      const su = await loginUser(t.app, { id: user.id, role: UserRole.USER });
      await withSession(t.http().post('/api/v1/agencies/join'), su)
        .send({ code: invite.code, displayName: '복귀' })
        .expect(201);
      const member = await t.prisma.agencyMember.findUniqueOrThrow({ where: { id: memberId } });
      expect(member).toMatchObject({ status: 'ACTIVE', displayName: '복귀', removedAt: null });
    });

    it('401 anonymous; 400 for malformed codes and unknown codes', async () => {
      await t
        .http()
        .post('/api/v1/agencies/join')
        .send({ code: 'ABCDEFGHJK', displayName: 'x' })
        .expect(401);
      const su = await loginUser(t.app, await createUser(t.prisma));
      const bad = await withSession(t.http().post('/api/v1/agencies/join'), su)
        .send({ code: '0000', displayName: 'x' })
        .expect(400);
      expect(bad.body.code).toBe('VALIDATION_FAILED');
      const unknown = await withSession(t.http().post('/api/v1/agencies/join'), su)
        .send({ code: 'ABCDEFGHJK', displayName: 'x' })
        .expect(400);
      expect(unknown.body.code).toBe('AGENCY_INVITE_INVALID');
    });
  });

  describe('membership of the caller', () => {
    it('GET /api/v1/agencies/membership and POST /membership/leave', async () => {
      const { agency } = await ownerSession();
      const { user, memberId } = await createAgent(t.prisma, agency.id);
      const sa = await loginUser(t.app, user, { agencyId: agency.id });
      const res = await withSession(t.http().get('/api/v1/agencies/membership'), sa).expect(200);
      expect(res.body).toMatchObject({ memberId, role: 'AGENT', agency: { id: agency.id } });

      await withSession(t.http().post('/api/v1/agencies/membership/leave'), sa).expect(204);
      expect((await t.prisma.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe('USER');
      const [session] = await t.app.get(SessionService).listForSubject('USER', user.id);
      expect(session).toMatchObject({ role: 'USER', agencyId: null });
      await withSession(t.http().get('/api/v1/agencies/membership'), sa).expect(404);
    });

    it('authz/validation: 401 anonymous; owners cannot leave; users without membership get 404', async () => {
      await t.http().get('/api/v1/agencies/membership').expect(401);
      await t.http().post('/api/v1/agencies/membership/leave').expect(401);
      const { s } = await ownerSession();
      const res = await withSession(t.http().post('/api/v1/agencies/membership/leave'), s).expect(
        400,
      );
      expect(res.body.code).toBe('AGENCY_OWNER_NOT_REMOVABLE');
      const su = await loginUser(t.app, await createUser(t.prisma));
      await withSession(t.http().post('/api/v1/agencies/membership/leave'), su).expect(404);
    });
  });

  describe('staff management', () => {
    it('GET /api/v1/agencies/mine/members lists owner first, paginated', async () => {
      const { agency, s } = await ownerSession();
      const a = await createAgent(t.prisma, agency.id);
      await createAgent(t.prisma, agency.id);
      const res = await withSession(
        t.http().get('/api/v1/agencies/mine/members?pageSize=2'),
        s,
      ).expect(200);
      expect(res.body).toMatchObject({ total: 3, page: 1, pageSize: 2, totalPages: 2 });
      expect(res.body.items[0].role).toBe('OWNER');
      expect(res.body.items[1]).toMatchObject({ id: a.memberId, phone: '01099998888' });
      await withSession(t.http().get('/api/v1/agencies/mine/members?pageSize=500'), s).expect(400);
    });

    it('PATCH /api/v1/agencies/mine/members/:memberId updates staff details', async () => {
      const { agency, s } = await ownerSession();
      const { memberId } = await createAgent(t.prisma, agency.id);
      const res = await withSession(t.http().patch(`/api/v1/agencies/mine/members/${memberId}`), s)
        .send({ title: '실장', isLicensed: true, licenseNumber: '2021-0001' })
        .expect(200);
      expect(res.body).toMatchObject({
        title: '실장',
        isLicensed: true,
        licenseNumber: '2021-0001',
      });
      const off = await withSession(t.http().patch(`/api/v1/agencies/mine/members/${memberId}`), s)
        .send({ isLicensed: false })
        .expect(200);
      expect(off.body.licenseNumber).toBeNull();
      await withSession(t.http().patch(`/api/v1/agencies/mine/members/${memberId}`), s)
        .send({})
        .expect(400);
      await withSession(t.http().patch(`/api/v1/agencies/mine/members/${memberId}`), s)
        .send({ phone: '02-123-4567' })
        .expect(400);
    });

    it('PATCH: 소속공인중개사 needs a license number (request or on file)', async () => {
      const { agency, s } = await ownerSession();
      const { memberId } = await createAgent(t.prisma, agency.id);
      const patch = (body: Record<string, unknown>) =>
        withSession(t.http().patch(`/api/v1/agencies/mine/members/${memberId}`), s).send(body);
      const missing = await patch({ isLicensed: true }).expect(400);
      expect(missing.body.code).toBe('VALIDATION_FAILED');
      await patch({ isLicensed: true, licenseNumber: '!!' }).expect(400);
      await patch({ isLicensed: true, licenseNumber: '2021-0002' }).expect(200);
      // Clearing the number of a licensed member is refused (it would stay advertisable).
      const cleared = await patch({ licenseNumber: null }).expect(400);
      expect(cleared.body.code).toBe('AGENCY_LICENSE_NUMBER_REQUIRED');
      const row = await t.prisma.agencyMember.findUniqueOrThrow({ where: { id: memberId } });
      expect(row).toMatchObject({ isLicensed: true, licenseNumber: '2021-0002' });
    });

    it('PATCH carries the change onto listing ads: de-licensed → contact moves to the 대표; rename / new phone → ads follow', async () => {
      const { agency, s } = await ownerSession();
      const ownerMember = await t.prisma.agencyMember.update({
        where: { agencyId_userId: { agencyId: agency.id, userId: agency.ownerUserId } },
        data: { phone: '01011112222' },
      });
      const broker = await createAgent(t.prisma, agency.id);
      await t.prisma.agencyMember.update({
        where: { id: broker.memberId },
        data: { isLicensed: true, licenseNumber: '2020-0001' },
      });
      const ad = async (contactPhone: string) => {
        const { listing } = await createListing(t.prisma, { agencyId: agency.id });
        await t.prisma.listingAgency.update({
          where: { listingId_agencyId: { listingId: listing.id, agencyId: agency.id } },
          data: { contactMemberId: broker.memberId, contactName: '김실장', contactPhone },
        });
        return listing.id;
      };
      const plain = await ad('01099998888');
      const overridden = await ad('01055556666');
      const contactOf = async (listingId: string) => {
        const res = await t.http().get(`/api/v1/listings/${listingId}`).expect(200);
        return (res.body.agencies as Record<string, unknown>[]).find(
          (a) => a.agencyId === agency.id,
        );
      };
      const patch = (body: Record<string, unknown>) =>
        withSession(t.http().patch(`/api/v1/agencies/mine/members/${broker.memberId}`), s)
          .send(body)
          .expect(200);

      // Prime the public listing caches, then rename + new phone.
      await contactOf(plain);
      await patch({ displayName: '김중개', phone: '010-7777-8888' });
      expect(await contactOf(plain)).toMatchObject({
        contactName: '김중개',
        contactPhone: '01077778888',
      });
      // A per-listing phone override is kept.
      expect(await contactOf(overridden)).toMatchObject({
        contactName: '김중개',
        contactPhone: '01055556666',
      });

      // No longer licensed: the 중개보조원 must not stay named on any ad.
      await patch({ isLicensed: false });
      for (const id of [plain, overridden]) {
        expect(await contactOf(id)).toMatchObject({
          contactName: ownerMember.displayName,
          contactPhone: '01011112222',
        });
      }
      expect(
        await t.prisma.listingAgency.count({ where: { contactMemberId: broker.memberId } }),
      ).toBe(0);

      // Editing a 중개보조원 touches no ad.
      await patch({ displayName: '보조원' });
      expect(await contactOf(plain)).toMatchObject({ contactName: ownerMember.displayName });
    });

    it('DELETE /api/v1/agencies/mine/members/:memberId removes an agent and downgrades them', async () => {
      const { agency, s } = await ownerSession();
      const { user, memberId } = await createAgent(t.prisma, agency.id);
      const sa = await loginUser(t.app, user, { agencyId: agency.id });
      await withSession(t.http().delete(`/api/v1/agencies/mine/members/${memberId}`), s).expect(
        204,
      );
      const member = await t.prisma.agencyMember.findUniqueOrThrow({ where: { id: memberId } });
      expect(member.status).toBe('REMOVED');
      expect((await t.prisma.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe('USER');
      const [session] = await t.app.get(SessionService).listForSubject('USER', user.id);
      expect(session).toMatchObject({ role: 'USER', agencyId: null });
      // The removed agent's session no longer passes AGENCY_OWNER/AGENT role checks.
      await withSession(t.http().get('/api/v1/agencies/mine/members'), sa).expect(403);
    });

    it("removing / leaving takes the agent off the agency's listing ads (contact moves to the 대표)", async () => {
      const { agency, s } = await ownerSession();
      const ownerMember = await t.prisma.agencyMember.update({
        where: { agencyId_userId: { agencyId: agency.id, userId: agency.ownerUserId } },
        data: { phone: '01011112222' },
      });
      const removed = await createAgent(t.prisma, agency.id);
      const leaving = await createAgent(t.prisma, agency.id);
      const other = await createAgency(t.prisma);
      const ad = async (agencyId: string, contactMemberId: string) => {
        const { listing } = await createListing(t.prisma, { agencyId });
        if (agencyId !== agency.id) {
          await t.prisma.listingAgency.create({
            data: { listingId: listing.id, agencyId: agency.id },
          });
        }
        await t.prisma.listingAgency.update({
          where: { listingId_agencyId: { listingId: listing.id, agencyId: agency.id } },
          data: { contactMemberId, contactName: '김실장', contactPhone: '01099998888' },
        });
        return listing.id;
      };
      const own = await ad(agency.id, removed.memberId);
      // Co-brokered listing of another office where our agent is our contact.
      const coBrokered = await ad(other.agency.id, leaving.memberId);
      const contactOf = async (listingId: string) => {
        const res = await t.http().get(`/api/v1/listings/${listingId}`).expect(200);
        return (res.body.agencies as Record<string, unknown>[]).find(
          (a) => a.agencyId === agency.id,
        );
      };
      expect(await contactOf(own)).toMatchObject({ contactPhone: '01099998888' });

      await withSession(
        t.http().delete(`/api/v1/agencies/mine/members/${removed.memberId}`),
        s,
      ).expect(204);
      const sl = await loginUser(t.app, leaving.user, { agencyId: agency.id });
      await withSession(t.http().post('/api/v1/agencies/membership/leave'), sl).expect(204);

      for (const id of [own, coBrokered]) {
        expect(await contactOf(id)).toMatchObject({
          contactName: ownerMember.displayName,
          contactPhone: '01011112222',
        });
      }
      expect(
        await t.prisma.listingAgency.count({
          where: { contactMemberId: { in: [removed.memberId, leaving.memberId] } },
        }),
      ).toBe(0);
    });

    it("authz: owners cannot remove themselves; other agencies' members are 404; agents get 403", async () => {
      const { agency, s } = await ownerSession();
      const ownerMember = await t.prisma.agencyMember.findFirstOrThrow({
        where: { agencyId: agency.id, role: 'OWNER' },
      });
      const self = await withSession(
        t.http().delete(`/api/v1/agencies/mine/members/${ownerMember.id}`),
        s,
      ).expect(400);
      expect(self.body.code).toBe('AGENCY_OWNER_NOT_REMOVABLE');

      const other = await createAgency(t.prisma);
      const foreign = await createAgent(t.prisma, other.agency.id);
      const nf = await withSession(
        t.http().delete(`/api/v1/agencies/mine/members/${foreign.memberId}`),
        s,
      ).expect(404);
      expect(nf.body.code).toBe('AGENCY_MEMBER_NOT_FOUND');
      await withSession(t.http().patch(`/api/v1/agencies/mine/members/${foreign.memberId}`), s)
        .send({ title: 'x' })
        .expect(404);

      const sa = await loginUser(t.app, foreign.user, { agencyId: other.agency.id });
      await withSession(
        t.http().delete(`/api/v1/agencies/mine/members/${foreign.memberId}`),
        sa,
      ).expect(403);
      await t.http().get('/api/v1/agencies/mine/members').expect(401);
      await withSession(t.http().delete('/api/v1/agencies/mine/members/xyz'), s).expect(400);
    });
  });
});
