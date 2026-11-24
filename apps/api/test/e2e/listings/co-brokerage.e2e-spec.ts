import { ErrorCode, ListingAgencyStatus } from '@house/shared';
import { createTestApp, resetAll, withoutUuids, withSession, type TestApp } from '../../utils';
import {
  addCoBroker,
  agencyWithOwner,
  agentOf,
  createDraft,
  createPublished,
  NIL_UUID,
} from './helpers';

const BASE = '/api/v1/agency/listings';

describe('co-brokerage (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  const statusOf = async (listingId: string, agencyId: string) =>
    (await t.prisma.listingAgency.findFirstOrThrow({ where: { listingId, agencyId } })).status;

  describe('POST /agency/listings/:id/co-brokers (request)', () => {
    it("an outsider's request stays PENDING: no access, not public, until the primary accepts", async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      const res = await withSession(t.http().post(`${BASE}/${id}/co-brokers`), b.ownerSession)
        .send({})
        .expect(201);
      expect(res.body).toMatchObject({
        listingId: id,
        agencyId: b.agency.id,
        status: ListingAgencyStatus.PENDING,
      });
      // Random UUIDs can contain the digits 1203: check everything but the ids.
      expect(withoutUuids(res.body)).not.toContain('1203');

      // Pending: no agency access, no public disclosure, not counted.
      await withSession(t.http().get(`${BASE}/${id}`), b.ownerSession).expect(404);
      await withSession(t.http().patch(`${BASE}/${id}`), b.ownerSession)
        .send({ contact: {} })
        .expect(404);
      const pub = await t.http().get(`/api/v1/listings/${id}`).expect(200);
      expect(pub.body.agencyCount).toBe(1);
      expect(pub.body.agencies).toHaveLength(1);
      const list = await withSession(t.http().get(BASE), b.ownerSession).expect(200);
      expect(list.body.total).toBe(0);

      // The primary sees the request (and was notified).
      const mine = await withSession(t.http().get(`${BASE}/${id}`), a.ownerSession).expect(200);
      expect((mine.body.agencies as { status: string }[]).map((x) => x.status)).toEqual([
        'ACTIVE',
        'PENDING',
      ]);
      expect(await t.prisma.notification.count({ where: { userId: a.owner.id } })).toBe(1);

      const dup = await withSession(t.http().post(`${BASE}/${id}/co-brokers`), b.ownerSession)
        .send({})
        .expect(409);
      expect(dup.body.code).toBe(ErrorCode.LISTING_CO_BROKER_PENDING);
    });

    it('drafts are invisible to outsiders (404); AGENT role cannot request (403); 401 anonymous', async () => {
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
      const self = await withSession(t.http().post(`${BASE}/${live}/co-brokers`), a.ownerSession)
        .send({})
        .expect(409);
      expect(self.body.code).toBe(ErrorCode.LISTING_CO_BROKER_DUPLICATE);
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

  describe('POST /agency/listings/:id/co-brokers/:agencyId/accept', () => {
    it('the primary accepts: the co-broker is disclosed publicly and counted', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      await withSession(t.http().post(`${BASE}/${id}/co-brokers`), b.ownerSession)
        .send({ contactPhone: '010-9999-8888' })
        .expect(201);
      const res = await withSession(
        t.http().post(`${BASE}/${id}/co-brokers/${b.agency.id}/accept`),
        a.ownerSession,
      ).expect(200);
      expect(res.body.isPrimaryAgency).toBe(true);
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
        contactName: b.agency.representativeName,
        contactPhone: '01099998888',
      });
      const list = await withSession(t.http().get(BASE), b.ownerSession).expect(200);
      expect(list.body.total).toBe(1);
      const ag = await t.prisma.agency.findUniqueOrThrow({ where: { id: b.agency.id } });
      expect(ag.activeListingCount).toBe(1);
    });

    it('only the primary may accept (co-broker 403, outsider 404, AGENT role 403, 401, bad ids 400)', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const c = await agencyWithOwner(t);
      const d = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      await addCoBroker(t, id, a, b);
      await withSession(t.http().post(`${BASE}/${id}/co-brokers`), c.ownerSession)
        .send({})
        .expect(201);
      const url = `${BASE}/${id}/co-brokers/${c.agency.id}/accept`;
      const byCo = await withSession(t.http().post(url), b.ownerSession).expect(403);
      expect(byCo.body.code).toBe(ErrorCode.LISTING_PRIMARY_AGENCY_ONLY);
      await withSession(t.http().post(url), d.ownerSession).expect(404);
      // A pending agency cannot accept itself.
      await withSession(t.http().post(url), c.ownerSession).expect(404);
      const agentA = await agentOf(t, a.agency.id);
      await withSession(t.http().post(url), agentA.session).expect(403);
      await t.http().post(url).expect(401);
      await withSession(
        t.http().post(`${BASE}/${id}/co-brokers/nope/accept`),
        a.ownerSession,
      ).expect(400);
      const none = await withSession(
        t.http().post(`${BASE}/${id}/co-brokers/${NIL_UUID}/accept`),
        a.ownerSession,
      ).expect(404);
      expect(none.body.code).toBe(ErrorCode.LISTING_CO_BROKER_NOT_FOUND);
      expect(await statusOf(id, c.agency.id)).toBe(ListingAgencyStatus.PENDING);
    });
  });

  describe('co-broker rights', () => {
    it('a co-broker may change only its own contact; content, property and photos are 403', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      await addCoBroker(t, id, a, b);

      for (const body of [
        { salePrice: 1 },
        { description: '공동중개 설명' },
        { property: { roadAddress: '다른 주소', lat: 34.96 } },
        { property: { ho: '101' } },
        { title: 'x', contact: {} },
      ]) {
        const r = await withSession(t.http().patch(`${BASE}/${id}`), b.ownerSession)
          .send(body)
          .expect(403);
        expect(r.body.code).toBe(ErrorCode.LISTING_PRIMARY_AGENCY_ONLY);
      }
      await withSession(t.http().put(`${BASE}/${id}/photos`), b.ownerSession)
        .send({ photos: [] })
        .expect(403);

      const ok = await withSession(t.http().patch(`${BASE}/${id}`), b.ownerSession)
        .send({ contact: { contactPhone: '010-5555-6666' } })
        .expect(200);
      const own = (ok.body.agencies as { agencyId: string; contactPhone: string }[]).find(
        (x) => x.agencyId === b.agency.id,
      );
      expect(own?.contactPhone).toBe('01055556666');
      const primaryRow = await t.prisma.listingAgency.findFirstOrThrow({
        where: { listingId: id, agencyId: a.agency.id },
      });
      expect(primaryRow.contactPhone).not.toBe('01055556666');
      const row = await t.prisma.listing.findUniqueOrThrow({ where: { id } });
      expect(row.salePrice).toBe(35_000);
    });

    it("a co-broker's detail hides 호, the hidden reason and other agencies' member ids", async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      await addCoBroker(t, id, a, b);
      const res = await withSession(t.http().get(`${BASE}/${id}`), b.ownerSession).expect(200);
      expect(res.body.isPrimaryAgency).toBe(false);
      expect(res.body.property.ho).toBeNull();
      expect(res.body.hiddenReason).toBeNull();
      const primary = (res.body.agencies as { agencyId: string; contactMemberId: unknown }[]).find(
        (x) => x.agencyId === a.agency.id,
      );
      expect(primary?.contactMemberId).toBeNull();
      // Random UUIDs can contain the digits 1203: check everything but the ids.
      expect(withoutUuids(res.body)).not.toContain('1203');
    });
  });

  describe('POST /agency/listings/:id/co-brokers/:agencyId/reject', () => {
    it('the primary rejects a request; the agency cannot request again', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      await withSession(t.http().post(`${BASE}/${id}/co-brokers`), b.ownerSession)
        .send({})
        .expect(201);
      await withSession(
        t.http().post(`${BASE}/${id}/co-brokers/${b.agency.id}/reject`),
        a.ownerSession,
      ).expect(204);
      expect(await statusOf(id, b.agency.id)).toBe(ListingAgencyStatus.REMOVED);
      const again = await withSession(t.http().post(`${BASE}/${id}/co-brokers`), b.ownerSession)
        .send({})
        .expect(403);
      expect(again.body.code).toBe(ErrorCode.LISTING_CO_BROKER_REMOVED);
    });

    it('403 for non-primary, 404 when nothing is pending, 401 anonymous, 400 bad ids', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const c = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      await addCoBroker(t, id, a, b);
      await withSession(t.http().post(`${BASE}/${id}/co-brokers`), c.ownerSession)
        .send({})
        .expect(201);
      const url = `${BASE}/${id}/co-brokers/${c.agency.id}/reject`;
      await withSession(t.http().post(url), b.ownerSession).expect(403);
      // An ACTIVE co-broker is removed via DELETE, not rejected.
      await withSession(
        t.http().post(`${BASE}/${id}/co-brokers/${b.agency.id}/reject`),
        a.ownerSession,
      ).expect(404);
      await t.http().post(url).expect(401);
      await withSession(t.http().post(`${BASE}/x/co-brokers/y/reject`), a.ownerSession).expect(400);
      expect(await statusOf(id, c.agency.id)).toBe(ListingAgencyStatus.PENDING);
    });
  });

  describe('DELETE /agency/listings/:id/co-brokers (leave)', () => {
    it('a co-broker leaves and may request again (PENDING); the primary cannot leave', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      await addCoBroker(t, id, a, b);
      const dup = await withSession(t.http().post(`${BASE}/${id}/co-brokers`), b.ownerSession)
        .send({})
        .expect(409);
      expect(dup.body.code).toBe(ErrorCode.LISTING_CO_BROKER_DUPLICATE);
      await withSession(t.http().delete(`${BASE}/${id}/co-brokers`), b.ownerSession).expect(204);
      expect(await statusOf(id, b.agency.id)).toBe(ListingAgencyStatus.WITHDRAWN);
      // After leaving, the listing is no longer accessible to that agency.
      await withSession(t.http().patch(`${BASE}/${id}`), b.ownerSession)
        .send({ contact: { contactPhone: '010-1111-2222' } })
        .expect(404);

      await withSession(t.http().post(`${BASE}/${id}/co-brokers`), b.ownerSession)
        .send({})
        .expect(201);
      expect(await statusOf(id, b.agency.id)).toBe(ListingAgencyStatus.PENDING);
      expect(await t.prisma.listingAgency.count({ where: { listingId: id } })).toBe(2);
      // A pending request can be cancelled the same way.
      await withSession(t.http().delete(`${BASE}/${id}/co-brokers`), b.ownerSession).expect(204);
      expect(await statusOf(id, b.agency.id)).toBe(ListingAgencyStatus.WITHDRAWN);

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
    it('the primary removes a co-broker; the removed agency cannot rejoin on its own', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      await addCoBroker(t, id, a, b);
      await withSession(
        t.http().delete(`${BASE}/${id}/co-brokers/${b.agency.id}`),
        a.ownerSession,
      ).expect(204);
      expect(await statusOf(id, b.agency.id)).toBe(ListingAgencyStatus.REMOVED);

      const rejoin = await withSession(t.http().post(`${BASE}/${id}/co-brokers`), b.ownerSession)
        .send({})
        .expect(403);
      expect(rejoin.body.code).toBe(ErrorCode.LISTING_CO_BROKER_REMOVED);
      await withSession(t.http().get(`${BASE}/${id}`), b.ownerSession).expect(404);
      const pub = await t.http().get(`/api/v1/listings/${id}`).expect(200);
      expect(pub.body.agencies).toHaveLength(1);
      const ag = await t.prisma.agency.findUniqueOrThrow({ where: { id: b.agency.id } });
      expect(ag.activeListingCount).toBe(0);

      // Only the primary can take it back.
      await withSession(
        t.http().post(`${BASE}/${id}/co-brokers/${b.agency.id}/accept`),
        a.ownerSession,
      ).expect(200);
      expect(await statusOf(id, b.agency.id)).toBe(ListingAgencyStatus.ACTIVE);
    });

    it('co-brokers cannot remove others (403); unknown agency 404; primary row 400; bad ids 400', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const c = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      for (const s of [b, c]) await addCoBroker(t, id, a, s);
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
