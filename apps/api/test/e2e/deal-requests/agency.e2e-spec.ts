import {
  AgencyStatus,
  DealRequestStatus,
  DealRequestType,
  DealRequestVisibility,
  DealType,
  ListingStatus,
  NotificationType,
  ProposalStatus,
  UserStatus,
} from '@house/shared';
import { createListing, resetAll, withSession, type TestApp } from '../../utils';
import {
  agent,
  broker,
  dealRequest,
  itemIds,
  proposal,
  requester,
  createDealRequestsApp,
} from './factories';

const ids = itemIds;

describe('deal-requests: agency inbox + proposals (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    ({ t } = await createDealRequestsApp());
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  describe('GET /api/v1/agency/deal-requests', () => {
    it('200: region-wide requests of its 시군구, requests targeting it, and ones it proposed to', async () => {
      const b = await broker(t);
      const otherB = await broker(t);
      const { user } = await requester(t);
      const region = await dealRequest(t.prisma, user.id);
      const targeted = await dealRequest(t.prisma, user.id, {
        visibility: DealRequestVisibility.SELECTED_AGENCIES,
      });
      await t.prisma.dealRequestTarget.create({
        data: { dealRequestId: targeted.id, agencyId: b.agency.id },
      });
      const notMine = await dealRequest(t.prisma, user.id, {
        visibility: DealRequestVisibility.SELECTED_AGENCIES,
      });
      await t.prisma.dealRequestTarget.create({
        data: { dealRequestId: notMine.id, agencyId: otherB.agency.id },
      });
      await dealRequest(t.prisma, user.id, { sggCode: '46130' });
      await dealRequest(t.prisma, user.id, { expiresAt: new Date(Date.now() - 1000) });
      await dealRequest(t.prisma, user.id, { deletedAt: new Date() });
      const closedProposed = await dealRequest(t.prisma, user.id, {
        status: DealRequestStatus.CLOSED,
      });
      await proposal(t.prisma, closedProposed.id, b.agency.id);
      await dealRequest(t.prisma, user.id, { status: DealRequestStatus.CLOSED });
      const withdrawnUser = await requester(t);
      await dealRequest(t.prisma, withdrawnUser.user.id);
      await t.prisma.user.update({
        where: { id: withdrawnUser.user.id },
        data: { status: UserStatus.WITHDRAWN },
      });

      const res = await withSession(t.http().get('/api/v1/agency/deal-requests'), b.s).expect(200);
      expect(res.body.total).toBe(3);
      expect(ids(res.body).sort()).toEqual([region.id, targeted.id, closedProposed.id].sort());
      for (const item of res.body.items) {
        expect(item.contact).toBeNull();
        expect(item).not.toHaveProperty('contactPhone');
        expect(item).not.toHaveProperty('addressDetail');
        expect(item).not.toHaveProperty('userId');
      }
      expect(JSON.stringify(res.body)).not.toContain('01012345678');
      expect(JSON.stringify(res.body)).not.toContain('1001호');

      const scoped = async (scope: string) =>
        ids(
          (
            await withSession(
              t.http().get(`/api/v1/agency/deal-requests?scope=${scope}`),
              b.s,
            ).expect(200)
          ).body,
        );
      expect(await scoped('TARGETED')).toEqual([targeted.id]);
      expect(await scoped('PROPOSED')).toEqual([closedProposed.id]);
      expect((await scoped('NEW')).sort()).toEqual([region.id, targeted.id].sort());
      const wanted = await withSession(
        t.http().get('/api/v1/agency/deal-requests?type=WANTED&dealType=JEONSE,MONTHLY'),
        b.s,
      ).expect(200);
      expect(wanted.body.total).toBe(0);
    });

    it('200 for an AGENT member too', async () => {
      const b = await broker(t);
      const a = await agent(t, b.agency);
      const { user } = await requester(t);
      await dealRequest(t.prisma, user.id);
      const res = await withSession(t.http().get('/api/v1/agency/deal-requests'), a.s).expect(200);
      expect(res.body.total).toBe(1);
    });

    it('401 anonymous; 403 for a plain user and for a suspended agency', async () => {
      await t.http().get('/api/v1/agency/deal-requests').expect(401);
      const { s } = await requester(t);
      await withSession(t.http().get('/api/v1/agency/deal-requests'), s).expect(403);
      const b = await broker(t);
      await t.prisma.agency.update({
        where: { id: b.agency.id },
        data: { status: AgencyStatus.SUSPENDED },
      });
      const res = await withSession(t.http().get('/api/v1/agency/deal-requests'), b.s).expect(403);
      expect(res.body.code).toBe('AGENCY_NOT_APPROVED');
    });

    it('400 for invalid filters', async () => {
      const b = await broker(t);
      await withSession(t.http().get('/api/v1/agency/deal-requests?scope=EVERYTHING'), b.s).expect(
        400,
      );
      await withSession(t.http().get('/api/v1/agency/deal-requests?assetType=CASTLE'), b.s).expect(
        400,
      );
    });
  });

  describe('GET /api/v1/agency/deal-requests/:id', () => {
    it('200: contact only after the requester grants this agency, hidden again after revoke', async () => {
      const b = await broker(t);
      const { user } = await requester(t);
      const req = await dealRequest(t.prisma, user.id);
      const url = `/api/v1/agency/deal-requests/${req.id}`;
      const before = await withSession(t.http().get(url), b.s).expect(200);
      expect(before.body).toMatchObject({ id: req.id, contact: null, targeted: false });
      await t.prisma.dealRequestContactGrant.create({
        data: { dealRequestId: req.id, agencyId: b.agency.id },
      });
      const after = await withSession(t.http().get(url), b.s).expect(200);
      expect(after.body.contact).toEqual({
        name: '홍길동',
        phone: '01012345678',
        addressDetail: '101동 1001호',
      });
      // Another agency never sees it.
      const other = await broker(t);
      const otherView = await withSession(t.http().get(url), other.s).expect(200);
      expect(otherView.body.contact).toBeNull();
      await t.prisma.dealRequestContactGrant.updateMany({ data: { revokedAt: new Date() } });
      expect((await withSession(t.http().get(url), b.s).expect(200)).body.contact).toBeNull();
    });

    it('contact disappears at once when the granting requester withdraws (request CANCELLED)', async () => {
      const b = await broker(t);
      const { user, s } = await requester(t);
      const req = await dealRequest(t.prisma, user.id);
      await proposal(t.prisma, req.id, b.agency.id);
      await t.prisma.dealRequestContactGrant.create({
        data: { dealRequestId: req.id, agencyId: b.agency.id },
      });
      const url = `/api/v1/agency/deal-requests/${req.id}`;
      expect((await withSession(t.http().get(url), b.s).expect(200)).body.contact).not.toBeNull();

      await withSession(t.http().post('/api/v1/me/withdraw'), s)
        .send({ confirm: true })
        .expect(204);
      const row = await t.prisma.dealRequest.findUniqueOrThrow({ where: { id: req.id } });
      expect(row.status).toBe(DealRequestStatus.CANCELLED);
      // Not even the proposing agency can open it any more, and no contact leaks via the list.
      await withSession(t.http().get(url), b.s).expect(404);
      const list = await withSession(t.http().get('/api/v1/agency/deal-requests'), b.s).expect(200);
      expect(ids(list.body)).not.toContain(req.id);
      expect(JSON.stringify(list.body)).not.toContain('01012345678');
    });

    it('withdrawn before any scrub: proposer gets 404; contact never served', async () => {
      const b = await broker(t);
      const { user } = await requester(t);
      const req = await dealRequest(t.prisma, user.id, { status: DealRequestStatus.MATCHED });
      await proposal(t.prisma, req.id, b.agency.id, { status: ProposalStatus.ACCEPTED });
      await t.prisma.dealRequestContactGrant.create({
        data: { dealRequestId: req.id, agencyId: b.agency.id },
      });
      // Status flipped without the withdrawal flow (e.g. a direct admin/DB action, jobs off).
      await t.prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.WITHDRAWN },
      });
      await withSession(t.http().get(`/api/v1/agency/deal-requests/${req.id}`), b.s).expect(404);
    });

    it('a suspended requester’s contact is hidden from granted agencies until reinstated', async () => {
      const b = await broker(t);
      const { user } = await requester(t);
      const req = await dealRequest(t.prisma, user.id, { status: DealRequestStatus.MATCHED });
      await proposal(t.prisma, req.id, b.agency.id, { status: ProposalStatus.ACCEPTED });
      await t.prisma.dealRequestContactGrant.create({
        data: { dealRequestId: req.id, agencyId: b.agency.id },
      });
      const url = `/api/v1/agency/deal-requests/${req.id}`;
      await t.prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.SUSPENDED },
      });
      const suspended = await withSession(t.http().get(url), b.s).expect(200);
      expect(suspended.body.contact).toBeNull();
      const list = await withSession(t.http().get('/api/v1/agency/deal-requests'), b.s).expect(200);
      expect(JSON.stringify(list.body)).not.toContain('01012345678');
      await t.prisma.user.update({ where: { id: user.id }, data: { status: UserStatus.ACTIVE } });
      expect((await withSession(t.http().get(url), b.s).expect(200)).body.contact).toMatchObject({
        phone: '01012345678',
      });
    });

    it('404 for requests the agency cannot see', async () => {
      const b = await broker(t);
      const { user } = await requester(t);
      const elsewhere = await dealRequest(t.prisma, user.id, { sggCode: '46130' });
      const res = await withSession(
        t.http().get(`/api/v1/agency/deal-requests/${elsewhere.id}`),
        b.s,
      ).expect(404);
      expect(res.body.code).toBe('DEAL_REQUEST_NOT_FOUND');
    });

    it('403 for a plain user; 400 for a malformed id', async () => {
      const { user, s } = await requester(t);
      const req = await dealRequest(t.prisma, user.id);
      await withSession(t.http().get(`/api/v1/agency/deal-requests/${req.id}`), s).expect(403);
      const b = await broker(t);
      await withSession(t.http().get('/api/v1/agency/deal-requests/abc'), b.s).expect(400);
    });
  });

  describe('POST /api/v1/agency/deal-requests/:id/proposals', () => {
    it('201: proposal with own active listing; requester notified; count bumped; 409 on repeat', async () => {
      const b = await broker(t);
      const { user } = await requester(t);
      const req = await dealRequest(t.prisma, user.id);
      const { listing } = await createListing(t.prisma, { agencyId: b.agency.id });
      const url = `/api/v1/agency/deal-requests/${req.id}/proposals`;
      const res = await withSession(t.http().post(url), b.s)
        .send({
          message: '조건에 맞는 매물이 있습니다.',
          listingIds: [listing.id],
          suggestedPrice: 29800,
        })
        .expect(201);
      expect(res.body).toMatchObject({
        dealRequestId: req.id,
        status: 'SENT',
        listingIds: [listing.id],
        suggestedPrice: 29800,
        dealRequest: { type: 'SELL_OR_LEASE', status: 'OPEN' },
      });
      expect(res.body.memberId).not.toBeNull();
      expect(
        (await t.prisma.dealRequest.findUniqueOrThrow({ where: { id: req.id } })).proposalCount,
      ).toBe(1);
      const n = await t.prisma.notification.findFirstOrThrow({ where: { userId: user.id } });
      expect(n).toMatchObject({ type: NotificationType.PROPOSAL_RECEIVED });
      expect(n.body).toContain(b.agency.name);
      const dup = await withSession(t.http().post(url), b.s).send({ message: '다시' }).expect(409);
      expect(dup.body.code).toBe('PROPOSAL_DUPLICATE');
    });

    it('400 for mismatching terms, foreign/inactive listings, closed requests and own requests', async () => {
      const b = await broker(t);
      const other = await broker(t);
      const { user } = await requester(t);
      const req = await dealRequest(t.prisma, user.id);
      const url = `/api/v1/agency/deal-requests/${req.id}/proposals`;
      const terms = await withSession(t.http().post(url), b.s)
        .send({ message: '월세 제안', suggestedMonthlyRent: 50 })
        .expect(400);
      expect(terms.body.code).toBe('PROPOSAL_TERMS_INVALID');
      const foreign = await createListing(t.prisma, { agencyId: other.agency.id });
      const draft = await createListing(t.prisma, {
        agencyId: b.agency.id,
        listing: { status: ListingStatus.DRAFT },
      });
      const bad = await withSession(t.http().post(url), b.s)
        .send({ message: '매물', listingIds: [foreign.listing.id, draft.listing.id] })
        .expect(400);
      expect(bad.body).toMatchObject({
        code: 'PROPOSAL_LISTING_INVALID',
        details: { listingIds: [foreign.listing.id, draft.listing.id] },
      });
      const closed = await dealRequest(t.prisma, user.id, { status: DealRequestStatus.MATCHED });
      await proposal(t.prisma, closed.id, other.agency.id);
      await t.prisma.dealRequestTarget.create({
        data: { dealRequestId: closed.id, agencyId: b.agency.id },
      });
      // MATCHED requests are only visible to agencies that proposed: b gets 404, other gets 409/400.
      await withSession(t.http().post(`/api/v1/agency/deal-requests/${closed.id}/proposals`), b.s)
        .send({ message: '제안' })
        .expect(404);
      const closedRes = await withSession(
        t.http().post(`/api/v1/agency/deal-requests/${closed.id}/proposals`),
        other.s,
      )
        .send({ message: '제안' })
        .expect(400);
      expect(closedRes.body.code).toBe('DEAL_REQUEST_CLOSED');
      const own = await dealRequest(t.prisma, b.user.id);
      const ownRes = await withSession(
        t.http().post(`/api/v1/agency/deal-requests/${own.id}/proposals`),
        b.s,
      )
        .send({ message: '제안' })
        .expect(400);
      expect(ownRes.body.code).toBe('PROPOSAL_OWN_REQUEST');
      expect(await t.prisma.proposal.count({ where: { agencyId: b.agency.id } })).toBe(0);
    });

    it('404 when not visible; 403 for a plain user or a non-member session', async () => {
      const b = await broker(t);
      const { user, s } = await requester(t);
      const selected = await dealRequest(t.prisma, user.id, {
        type: DealRequestType.WANTED,
        dealTypes: [DealType.JEONSE],
        visibility: DealRequestVisibility.SELECTED_AGENCIES,
      });
      await withSession(t.http().post(`/api/v1/agency/deal-requests/${selected.id}/proposals`), b.s)
        .send({ message: '제안' })
        .expect(404);
      const open = await dealRequest(t.prisma, user.id);
      await withSession(t.http().post(`/api/v1/agency/deal-requests/${open.id}/proposals`), s)
        .send({ message: '제안' })
        .expect(403);
      await t.prisma.agencyMember.updateMany({
        where: { agencyId: b.agency.id },
        data: { status: 'REMOVED' },
      });
      const removed = await withSession(
        t.http().post(`/api/v1/agency/deal-requests/${open.id}/proposals`),
        b.s,
      )
        .send({ message: '제안' })
        .expect(403);
      expect(removed.body.code).toBe('AGENCY_MEMBERSHIP_REQUIRED');
    });

    it('400 VALIDATION_FAILED for empty message / duplicate listings', async () => {
      const b = await broker(t);
      const { user } = await requester(t);
      const req = await dealRequest(t.prisma, user.id);
      const url = `/api/v1/agency/deal-requests/${req.id}/proposals`;
      await withSession(t.http().post(url), b.s).send({ message: '  ' }).expect(400);
      const l = '0190a0b0-0000-7000-8000-000000000001';
      await withSession(t.http().post(url), b.s)
        .send({ message: '제안', listingIds: [l, l] })
        .expect(400);
      await withSession(t.http().post(url), b.s)
        .send({ message: '제안', suggestedPrice: -1 })
        .expect(400);
    });
  });

  describe('GET /api/v1/agency/proposals', () => {
    it('200: only this agency’s proposals, filterable by status', async () => {
      const b = await broker(t);
      const other = await broker(t);
      const { user } = await requester(t);
      const r1 = await dealRequest(t.prisma, user.id);
      const r2 = await dealRequest(t.prisma, user.id);
      const p1 = await proposal(t.prisma, r1.id, b.agency.id);
      const p2 = await proposal(t.prisma, r2.id, b.agency.id, { status: ProposalStatus.ACCEPTED });
      await proposal(t.prisma, r1.id, other.agency.id);
      const res = await withSession(t.http().get('/api/v1/agency/proposals'), b.s).expect(200);
      expect(ids(res.body).sort()).toEqual([p1.id, p2.id].sort());
      const accepted = await withSession(
        t.http().get('/api/v1/agency/proposals?status=ACCEPTED'),
        b.s,
      ).expect(200);
      expect(ids(accepted.body)).toEqual([p2.id]);
    });

    it('403 for a plain user; 400 for an invalid status', async () => {
      const { s } = await requester(t);
      await withSession(t.http().get('/api/v1/agency/proposals'), s).expect(403);
      const b = await broker(t);
      await withSession(t.http().get('/api/v1/agency/proposals?status=LOST'), b.s).expect(400);
    });
  });

  describe('POST /api/v1/agency/proposals/:id/withdraw', () => {
    it('200: withdraw a pending proposal (count decremented); second time 400', async () => {
      const b = await broker(t);
      const { user } = await requester(t);
      const req = await dealRequest(t.prisma, user.id);
      const p = await proposal(t.prisma, req.id, b.agency.id);
      const url = `/api/v1/agency/proposals/${p.id}/withdraw`;
      const res = await withSession(t.http().post(url), b.s).expect(200);
      expect(res.body.status).toBe('WITHDRAWN');
      expect(
        (await t.prisma.dealRequest.findUniqueOrThrow({ where: { id: req.id } })).proposalCount,
      ).toBe(0);
      const again = await withSession(t.http().post(url), b.s).expect(400);
      expect(again.body.code).toBe('PROPOSAL_STATE_INVALID');
    });

    it("404 for another agency's proposal; 403 for a plain user; 400 for a bad id", async () => {
      const b = await broker(t);
      const other = await broker(t);
      const { user, s } = await requester(t);
      const req = await dealRequest(t.prisma, user.id);
      const p = await proposal(t.prisma, req.id, other.agency.id);
      const res = await withSession(
        t.http().post(`/api/v1/agency/proposals/${p.id}/withdraw`),
        b.s,
      ).expect(404);
      expect(res.body.code).toBe('PROPOSAL_NOT_FOUND');
      await withSession(t.http().post(`/api/v1/agency/proposals/${p.id}/withdraw`), s).expect(403);
      await withSession(t.http().post('/api/v1/agency/proposals/bad/withdraw'), b.s).expect(400);
      expect((await t.prisma.proposal.findUniqueOrThrow({ where: { id: p.id } })).status).toBe(
        'SENT',
      );
    });
  });
});
