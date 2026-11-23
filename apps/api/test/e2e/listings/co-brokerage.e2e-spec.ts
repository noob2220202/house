import { ErrorCode, ListingAgencyStatus } from '@house/shared';
import { createTestApp, resetAll, withSession, type TestApp } from '../../utils';
import { agencyWithOwner, agentOf, createDraft, createPublished, NIL_UUID } from './helpers';

const BASE = '/api/v1/agency/listings';

describe('co-brokerage (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  describe('POST /agency/listings/:id/co-brokers', () => {
    it('joins an advertised listing; the co-broker shows in the public disclosure and can edit', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      const res = await withSession(t.http().post(`${BASE}/${id}/co-brokers`), b.ownerSession)
        .send({ contactName: '공동 실장', contactPhone: '010-9999-8888' })
        .expect(201);
      expect(res.body.isPrimaryAgency).toBe(false);
      expect((res.body.agencies as { agencyId: string }[]).map((x) => x.agencyId)).toEqual([
        a.agency.id,
        b.agency.id,
      ]);

      const pub = await t.http().get(`/api/v1/listings/${id}`).expect(200);
      expect(pub.body.agencyCount).toBe(2);
      expect(pub.body.agencies[1]).toMatchObject({
        agencyId: b.agency.id,
        isPrimary: false,
        name: b.agency.name,
        registrationNumber: b.agency.registrationNumber,
        representativeName: b.agency.representativeName,
        phone: b.agency.phone,
        roadAddress: b.agency.roadAddress,
        contactName: '공동 실장',
        contactPhone: '01099998888',
      });

      // Co-brokers may edit content and see the listing in their agency list.
      await withSession(t.http().patch(`${BASE}/${id}`), b.ownerSession)
        .send({ description: '공동중개 설명' })
        .expect(200);
      const list = await withSession(t.http().get(BASE), b.ownerSession).expect(200);
      expect(list.body.total).toBe(1);
      const ag = await t.prisma.agency.findUniqueOrThrow({ where: { id: b.agency.id } });
      expect(ag.activeListingCount).toBe(1);
    });

    it('rejoining after leaving reactivates the row; joining twice is 409', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      await withSession(t.http().post(`${BASE}/${id}/co-brokers`), b.ownerSession)
        .send({})
        .expect(201);
      const dup = await withSession(t.http().post(`${BASE}/${id}/co-brokers`), b.ownerSession)
        .send({})
        .expect(409);
      expect(dup.body.code).toBe(ErrorCode.LISTING_CO_BROKER_DUPLICATE);
      await withSession(t.http().delete(`${BASE}/${id}/co-brokers`), b.ownerSession).expect(204);
      await withSession(t.http().post(`${BASE}/${id}/co-brokers`), b.ownerSession)
        .send({})
        .expect(201);
      const rows = await t.prisma.listingAgency.findMany({ where: { listingId: id } });
      expect(rows).toHaveLength(2);
    });

    it('drafts are invisible to outsiders (404); AGENT role cannot join (403); 401 anonymous', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const draft = await createDraft(t, a.ownerSession);
      const r = await withSession(t.http().post(`${BASE}/${draft}/co-brokers`), b.ownerSession)
        .send({})
        .expect(404);
      expect(r.body.code).toBe(ErrorCode.LISTING_NOT_FOUND);
      const live = await createPublished(t, a.ownerSession);
      const agentB = await agentOf(t, b.agency.id);
      await withSession(t.http().post(`${BASE}/${live}/co-brokers`), agentB.session)
        .send({})
        .expect(403);
      await t.http().post(`${BASE}/${live}/co-brokers`).send({}).expect(401);
      // The primary agency is already a participant.
      await withSession(t.http().post(`${BASE}/${live}/co-brokers`), a.ownerSession)
        .send({})
        .expect(409);
    });

    it('400 on invalid contact data / id', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      const r = await withSession(t.http().post(`${BASE}/${id}/co-brokers`), b.ownerSession)
        .send({ contactPhone: '12345' })
        .expect(400);
      expect(r.body.code).toBe(ErrorCode.VALIDATION_FAILED);
      await withSession(t.http().post(`${BASE}/bad/co-brokers`), b.ownerSession)
        .send({})
        .expect(400);
    });
  });

  describe('DELETE /agency/listings/:id/co-brokers (leave)', () => {
    it('a co-broker leaves; the primary cannot', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      await withSession(t.http().post(`${BASE}/${id}/co-brokers`), b.ownerSession)
        .send({})
        .expect(201);
      await withSession(t.http().delete(`${BASE}/${id}/co-brokers`), b.ownerSession).expect(204);
      const row = await t.prisma.listingAgency.findFirstOrThrow({
        where: { listingId: id, agencyId: b.agency.id },
      });
      expect(row.status).toBe(ListingAgencyStatus.WITHDRAWN);
      // After leaving, the listing is no longer editable by that agency.
      await withSession(t.http().patch(`${BASE}/${id}`), b.ownerSession)
        .send({ title: 'x' })
        .expect(404);

      const r = await withSession(
        t.http().delete(`${BASE}/${id}/co-brokers`),
        a.ownerSession,
      ).expect(400);
      expect(r.body.code).toBe(ErrorCode.LISTING_PRIMARY_CANNOT_LEAVE);
    });

    it('404 when not participating, 403 for AGENT role, 401 anonymous, 400 bad id', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      const r = await withSession(
        t.http().delete(`${BASE}/${id}/co-brokers`),
        b.ownerSession,
      ).expect(404);
      expect(r.body.code).toBe(ErrorCode.LISTING_CO_BROKER_NOT_FOUND);
      const agentA = await agentOf(t, a.agency.id);
      await withSession(t.http().delete(`${BASE}/${id}/co-brokers`), agentA.session).expect(403);
      await t.http().delete(`${BASE}/${id}/co-brokers`).expect(401);
      await withSession(t.http().delete(`${BASE}/zzz/co-brokers`), b.ownerSession).expect(400);
    });
  });

  describe('DELETE /agency/listings/:id/co-brokers/:agencyId (remove)', () => {
    it('the primary removes a co-broker', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      await withSession(t.http().post(`${BASE}/${id}/co-brokers`), b.ownerSession)
        .send({})
        .expect(201);
      await withSession(
        t.http().delete(`${BASE}/${id}/co-brokers/${b.agency.id}`),
        a.ownerSession,
      ).expect(204);
      const pub = await t.http().get(`/api/v1/listings/${id}`).expect(200);
      expect(pub.body.agencies).toHaveLength(1);
    });

    it('co-brokers cannot remove others (403); unknown agency 404; primary row 400; bad ids 400', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const c = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      for (const s of [b, c]) {
        await withSession(t.http().post(`${BASE}/${id}/co-brokers`), s.ownerSession)
          .send({})
          .expect(201);
      }
      const forbidden = await withSession(
        t.http().delete(`${BASE}/${id}/co-brokers/${c.agency.id}`),
        b.ownerSession,
      ).expect(403);
      expect(forbidden.body.code).toBe(ErrorCode.LISTING_PRIMARY_AGENCY_ONLY);
      await withSession(
        t.http().delete(`${BASE}/${id}/co-brokers/${NIL_UUID}`),
        a.ownerSession,
      ).expect(404);
      await withSession(
        t.http().delete(`${BASE}/${id}/co-brokers/${a.agency.id}`),
        a.ownerSession,
      ).expect(400);
      await withSession(t.http().delete(`${BASE}/${id}/co-brokers/nope`), a.ownerSession).expect(
        400,
      );
      await t.http().delete(`${BASE}/${id}/co-brokers/${c.agency.id}`).expect(401);
    });
  });
});
