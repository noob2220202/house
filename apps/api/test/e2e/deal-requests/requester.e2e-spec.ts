import {
  AgencyStatus,
  AssetType,
  DealRequestStatus,
  DealRequestVisibility,
  DealType,
  MediaPurpose,
  NotificationType,
  ProposalStatus,
} from '@house/shared';
import { DailyCapService } from '../../../src/common/throttle/daily-cap.service';
import {
  createAgency,
  createComplex,
  createMedia,
  resetAll,
  withSession,
  type TestApp,
} from '../../utils';
import {
  EMD,
  broker,
  dealRequest,
  errorCode,
  issuePaths,
  itemIds,
  proposal,
  requester,
  sellBody,
  wantedBody,
  createDealRequestsApp,
  type RecordingQueue,
} from './factories';

describe('deal-requests: requester (e2e)', () => {
  let t: TestApp;
  let queue: RecordingQueue;

  beforeAll(async () => {
    ({ t, queue } = await createDealRequestsApp());
  });
  beforeEach(async () => {
    queue.jobs.length = 0;
    await resetAll(t);
  });
  afterAll(() => t?.close());

  const MISSING = '0190a0b0-0000-7000-8000-00000000dead';

  describe('POST /api/v1/deal-requests', () => {
    it('201: 내놓기 with normalized (unverified) phone, 30-day expiry and private 동·호 kept', async () => {
      const { user, s } = await requester(t);
      const before = Date.now();
      const res = await withSession(t.http().post('/api/v1/deal-requests'), s)
        .send(sellBody())
        .expect(201);
      expect(res.body).toMatchObject({
        type: 'SELL_OR_LEASE',
        status: 'OPEN',
        assetType: 'APT',
        dealTypes: ['SALE'],
        sggCode: '46150',
        emdCode: EMD,
        contactName: '홍길동',
        contactPhone: '01012345678',
        addressDetail: '101동 1001호',
        exclusiveArea: 84.97,
        moveInDate: '2027-01-15',
        proposalCount: 0,
        targetAgencyIds: [],
        contactGrants: [],
      });
      const expires = new Date(res.body.expiresAt as string).getTime();
      expect(expires - before).toBeGreaterThanOrEqual(30 * 86_400_000 - 5_000);
      const row = await t.prisma.dealRequest.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(row.userId).toBe(user.id);
      expect(queue.jobs).toEqual([
        {
          name: 'deal-request.fanout',
          data: { dealRequestId: row.id },
          opts: { jobId: `fanout-${row.id}` },
        },
      ]);
      expect(row.contactPhone).toBe('01012345678');
      const [loc] = await t.prisma.$queryRaw<{ ok: boolean }[]>`
        SELECT location IS NOT NULL AS ok FROM deal_requests WHERE id = ${row.id}::uuid`;
      expect(loc?.ok).toBe(true);
    });

    it('201: 구하기 to selected agencies, complex + photos validated', async () => {
      const { s, user } = await requester(t);
      const a = await createAgency(t.prisma);
      const complex = await createComplex(t.prisma, { emdCode: EMD });
      const res = await withSession(t.http().post('/api/v1/deal-requests'), s)
        .send(
          wantedBody({
            assetType: AssetType.APT,
            dealTypes: [DealType.JEONSE],
            visibility: DealRequestVisibility.SELECTED_AGENCIES,
            targetAgencyIds: [a.agency.id],
            complexIds: [complex.id],
            rentMax: undefined,
            roomsMin: 2,
          }),
        )
        .expect(201);
      expect(res.body).toMatchObject({
        type: 'WANTED',
        visibility: 'SELECTED_AGENCIES',
        targetAgencyIds: [a.agency.id],
        complexIds: [complex.id],
        regionCodes: [EMD],
        roomsMin: 2,
      });

      const photo = await createMedia(t.prisma, {
        ownerUserId: user.id,
        purpose: MediaPurpose.DEAL_REQUEST_PHOTO,
      });
      const sell = await withSession(t.http().post('/api/v1/deal-requests'), s)
        .send(
          sellBody({
            complexId: complex.id,
            emdCode: undefined,
            lat: undefined,
            lng: undefined,
            photoMediaIds: [photo.id],
          }),
        )
        .expect(201);
      expect(sell.body.complex).toEqual({ id: complex.id, name: complex.name });
      expect(sell.body.emdCode).toBe(EMD);
      expect(sell.body.lat).toBe(complex.lat);
      expect(sell.body.photos).toHaveLength(1);
      expect(sell.body.photos[0].mediaId).toBe(photo.id);
    });

    it('401 without a session; 403 without the CSRF header', async () => {
      await t.http().post('/api/v1/deal-requests').send(sellBody()).expect(401);
      const { s } = await requester(t);
      const res = await t
        .http()
        .post('/api/v1/deal-requests')
        .set('Cookie', s.cookie)
        .set('Origin', s.origin)
        .send(sellBody())
        .expect(403);
      expect(errorCode(res)).toBe('CSRF_FAILED');
    });

    // The route allows 5 attempts per hour per client (THROTTLE.DEAL_REQUEST): ≤5 posts per test.
    it.each<[string, Record<string, unknown>[], string[]]>([
      [
        'phone and asset/deal-type rules',
        [
          sellBody({ contactPhone: '12345' }),
          sellBody({ assetType: AssetType.LAND, dealTypes: [DealType.PRESALE] }),
          sellBody({ desiredMonthlyRent: 50 }),
        ],
        ['contactPhone', 'dealTypes.0', 'desiredMonthlyRent'],
      ],
      [
        'targets, ranges and missing fields',
        [
          wantedBody({ visibility: DealRequestVisibility.SELECTED_AGENCIES }),
          wantedBody({ depositMin: 2000 }),
          { type: 'WANTED' },
        ],
        ['targetAgencyIds', 'depositMin', 'assetType'],
      ],
    ])('400 VALIDATION_FAILED: %s', async (_name, bodies, paths) => {
      const { s } = await requester(t);
      const cases = bodies.map((b, i) => [b, paths[i]] as const);
      for (const [body, path] of cases) {
        const res = await withSession(t.http().post('/api/v1/deal-requests'), s)
          .send(body)
          .expect(400);
        expect(res.body.code).toBe('VALIDATION_FAILED');
        expect(issuePaths(res.body)).toContain(path);
      }
      expect(await t.prisma.dealRequest.count()).toBe(0);
    });

    it('400 for out-of-region codes, mismatching complex, unapproved target, foreign photo', async () => {
      const { user, s } = await requester(t);
      const pending = await createAgency(t.prisma, { status: AgencyStatus.PENDING });
      const officetel = await createComplex(t.prisma, { assetType: AssetType.OFFICETEL });
      const otherPhoto = await createMedia(t.prisma, { purpose: MediaPurpose.DEAL_REQUEST_PHOTO });
      const cases: [Record<string, unknown>, string][] = [
        [wantedBody({ regionCodes: ['4611010100'] }), 'DEAL_REQUEST_REGION_INVALID'],
        [sellBody({ emdCode: '4611010100' }), 'DEAL_REQUEST_REGION_INVALID'],
        [sellBody({ complexId: officetel.id }), 'DEAL_REQUEST_COMPLEX_INVALID'],
        [
          wantedBody({
            visibility: DealRequestVisibility.SELECTED_AGENCIES,
            targetAgencyIds: [pending.agency.id],
          }),
          'DEAL_REQUEST_TARGET_INVALID',
        ],
        [sellBody({ photoMediaIds: [otherPhoto.id] }), 'DEAL_REQUEST_PHOTO_INVALID'],
      ];
      for (const [body, code] of cases) {
        const res = await withSession(t.http().post('/api/v1/deal-requests'), s)
          .send(body)
          .expect(400);
        expect(res.body.code).toBe(code);
      }
      // Rejected attempts are not counted against the daily cap.
      expect(await t.app.get(DailyCapService).used('DEAL_REQUEST_CREATE', user.id)).toBe(0);
    });

    it('429 once the per-user daily cap is used up; 400 at the active-request limit', async () => {
      const { user, s } = await requester(t);
      const caps = t.app.get(DailyCapService);
      for (let i = 0; i < 5; i++) await caps.consume('DEAL_REQUEST_CREATE', user.id);
      const capped = await withSession(t.http().post('/api/v1/deal-requests'), s)
        .send(sellBody())
        .expect(429);
      expect(capped.body).toMatchObject({
        code: 'RATE_LIMITED',
        details: { cap: 'DEAL_REQUEST_CREATE' },
      });

      const other = await requester(t);
      for (let i = 0; i < 10; i++) await dealRequest(t.prisma, other.user.id);
      const limited = await withSession(t.http().post('/api/v1/deal-requests'), other.s)
        .send(sellBody())
        .expect(400);
      expect(limited.body.code).toBe('DEAL_REQUEST_ACTIVE_LIMIT');
    });
  });

  describe('GET /api/v1/me/deal-requests', () => {
    it('200: only own, newest first, filterable by status', async () => {
      const { user, s } = await requester(t);
      const other = await requester(t);
      const a = await dealRequest(t.prisma, user.id);
      const b = await dealRequest(t.prisma, user.id, { status: DealRequestStatus.CLOSED });
      await dealRequest(t.prisma, other.user.id);
      await dealRequest(t.prisma, user.id, { deletedAt: new Date() });
      const res = await withSession(t.http().get('/api/v1/me/deal-requests'), s).expect(200);
      expect(res.body).toMatchObject({ total: 2, page: 1 });
      expect(itemIds(res.body)).toEqual([b.id, a.id]);
      const open = await withSession(
        t.http().get('/api/v1/me/deal-requests?status=OPEN'),
        s,
      ).expect(200);
      expect(itemIds(open.body)).toEqual([a.id]);
    });

    it('401 without a session', async () => {
      await t.http().get('/api/v1/me/deal-requests').expect(401);
    });

    it('400 for invalid query', async () => {
      const { s } = await requester(t);
      await withSession(t.http().get('/api/v1/me/deal-requests?pageSize=1000'), s).expect(400);
      await withSession(t.http().get('/api/v1/me/deal-requests?status=NOPE'), s).expect(400);
    });
  });

  describe('GET /api/v1/me/deal-requests/:id', () => {
    it('200: proposals with agency disclosure + agent; marks SENT as VIEWED; hides withdrawn', async () => {
      const { user, s } = await requester(t);
      const req = await dealRequest(t.prisma, user.id);
      const b1 = await broker(t);
      const b2 = await broker(t);
      const member = await t.prisma.agencyMember.findFirstOrThrow({
        where: { agencyId: b1.agency.id },
      });
      const p1 = await proposal(t.prisma, req.id, b1.agency.id, {
        memberId: member.id,
        suggestedPrice: 29500,
      });
      await proposal(t.prisma, req.id, b2.agency.id, { status: ProposalStatus.WITHDRAWN });
      const res = await withSession(t.http().get(`/api/v1/me/deal-requests/${req.id}`), s).expect(
        200,
      );
      expect(res.body.proposals).toHaveLength(1);
      expect(res.body.proposals[0]).toMatchObject({
        id: p1.id,
        status: 'VIEWED',
        suggestedPrice: 29500,
        contactShared: false,
        agency: {
          agencyId: b1.agency.id,
          name: b1.agency.name,
          registrationNumber: b1.agency.registrationNumber,
          representativeName: b1.agency.representativeName,
        },
        agent: { displayName: member.displayName },
      });
      const row = await t.prisma.proposal.findUniqueOrThrow({ where: { id: p1.id } });
      expect(row.viewedAt).not.toBeNull();
    });

    it("404 for another user's request (no IDOR)", async () => {
      const { s } = await requester(t);
      const other = await requester(t);
      const req = await dealRequest(t.prisma, other.user.id);
      const res = await withSession(t.http().get(`/api/v1/me/deal-requests/${req.id}`), s).expect(
        404,
      );
      expect(res.body.code).toBe('DEAL_REQUEST_NOT_FOUND');
    });

    it('400 for a malformed id; 401 anonymous', async () => {
      const { s } = await requester(t);
      await withSession(t.http().get('/api/v1/me/deal-requests/not-a-uuid'), s).expect(400);
      await t.http().get(`/api/v1/me/deal-requests/${MISSING}`).expect(401);
    });
  });

  describe('POST /api/v1/me/deal-requests/:id/cancel and /close', () => {
    it('200: cancel revokes grants and notifies proposing agencies; second cancel → 400', async () => {
      const { user, s } = await requester(t);
      const b = await broker(t);
      const req = await dealRequest(t.prisma, user.id);
      await proposal(t.prisma, req.id, b.agency.id);
      await t.prisma.dealRequestContactGrant.create({
        data: { dealRequestId: req.id, agencyId: b.agency.id },
      });
      const res = await withSession(
        t.http().post(`/api/v1/me/deal-requests/${req.id}/cancel`),
        s,
      ).expect(200);
      expect(res.body).toMatchObject({ status: 'CANCELLED', contactGrants: [] });
      expect(res.body.closedAt).not.toBeNull();
      const grant = await t.prisma.dealRequestContactGrant.findFirstOrThrow();
      expect(grant.revokedAt).not.toBeNull();
      expect(
        await t.prisma.notification.count({
          where: { userId: b.user.id, type: NotificationType.SYSTEM },
        }),
      ).toBe(1);
      const again = await withSession(
        t.http().post(`/api/v1/me/deal-requests/${req.id}/cancel`),
        s,
      ).expect(400);
      expect(again.body.code).toBe('DEAL_REQUEST_STATE_INVALID');
    });

    it('200: close keeps grants and records the reason', async () => {
      const { user, s } = await requester(t);
      const b = await broker(t);
      const req = await dealRequest(t.prisma, user.id, { status: DealRequestStatus.MATCHED });
      await t.prisma.dealRequestContactGrant.create({
        data: { dealRequestId: req.id, agencyId: b.agency.id },
      });
      const res = await withSession(t.http().post(`/api/v1/me/deal-requests/${req.id}/close`), s)
        .send({ reason: '거래 완료' })
        .expect(200);
      expect(res.body).toMatchObject({ status: 'CLOSED', closeReason: '거래 완료' });
      expect(res.body.contactGrants).toHaveLength(1);
      // Body is optional.
      const r2 = await dealRequest(t.prisma, user.id);
      await withSession(t.http().post(`/api/v1/me/deal-requests/${r2.id}/close`), s).expect(200);
    });

    it("404 for another user's request", async () => {
      const { s } = await requester(t);
      const other = await requester(t);
      const req = await dealRequest(t.prisma, other.user.id);
      await withSession(t.http().post(`/api/v1/me/deal-requests/${req.id}/cancel`), s).expect(404);
      await withSession(t.http().post(`/api/v1/me/deal-requests/${req.id}/close`), s)
        .send({})
        .expect(404);
      expect((await t.prisma.dealRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe(
        'OPEN',
      );
    });

    it('400 for a too-long reason or malformed id', async () => {
      const { user, s } = await requester(t);
      const req = await dealRequest(t.prisma, user.id);
      await withSession(t.http().post(`/api/v1/me/deal-requests/${req.id}/close`), s)
        .send({ reason: 'x'.repeat(501) })
        .expect(400);
      await withSession(t.http().post('/api/v1/me/deal-requests/xyz/cancel'), s).expect(400);
    });
  });

  describe('contact grants', () => {
    it('201: grant to a proposing agency (idempotent, notified once), 204 revoke', async () => {
      const { user, s } = await requester(t);
      const b = await broker(t);
      const req = await dealRequest(t.prisma, user.id);
      await proposal(t.prisma, req.id, b.agency.id);
      const url = `/api/v1/me/deal-requests/${req.id}/contact-grants`;
      const res = await withSession(t.http().post(url), s)
        .send({ agencyId: b.agency.id })
        .expect(201);
      expect(res.body).toMatchObject({ agencyId: b.agency.id, agencyName: b.agency.name });
      await withSession(t.http().post(url), s).send({ agencyId: b.agency.id }).expect(201);
      expect(
        await t.prisma.notification.count({
          where: { userId: b.user.id, type: NotificationType.CONTACT_GRANTED },
        }),
      ).toBe(1);
      await withSession(t.http().delete(`${url}/${b.agency.id}`), s).expect(204);
      const gone = await withSession(t.http().delete(`${url}/${b.agency.id}`), s).expect(404);
      expect(gone.body.code).toBe('DEAL_REQUEST_GRANT_NOT_FOUND');
    });

    it('400 for an unrelated agency; 400 for a closed request', async () => {
      const { user, s } = await requester(t);
      const b = await broker(t);
      const req = await dealRequest(t.prisma, user.id);
      const res = await withSession(
        t.http().post(`/api/v1/me/deal-requests/${req.id}/contact-grants`),
        s,
      )
        .send({ agencyId: b.agency.id })
        .expect(400);
      expect(res.body.code).toBe('DEAL_REQUEST_GRANT_INVALID');
      const closed = await dealRequest(t.prisma, user.id, { status: DealRequestStatus.EXPIRED });
      await proposal(t.prisma, closed.id, b.agency.id);
      const r2 = await withSession(
        t.http().post(`/api/v1/me/deal-requests/${closed.id}/contact-grants`),
        s,
      )
        .send({ agencyId: b.agency.id })
        .expect(400);
      expect(r2.body.code).toBe('DEAL_REQUEST_STATE_INVALID');
    });

    it("404 on another user's request; 400 for bad bodies/params", async () => {
      const { s } = await requester(t);
      const other = await requester(t);
      const b = await broker(t);
      const req = await dealRequest(t.prisma, other.user.id);
      await proposal(t.prisma, req.id, b.agency.id);
      await withSession(t.http().post(`/api/v1/me/deal-requests/${req.id}/contact-grants`), s)
        .send({ agencyId: b.agency.id })
        .expect(404);
      await withSession(
        t.http().delete(`/api/v1/me/deal-requests/${req.id}/contact-grants/${b.agency.id}`),
        s,
      ).expect(404);
      await withSession(t.http().post(`/api/v1/me/deal-requests/${req.id}/contact-grants`), s)
        .send({ agencyId: 'nope' })
        .expect(400);
      await withSession(
        t.http().delete(`/api/v1/me/deal-requests/${req.id}/contact-grants/nope`),
        s,
      ).expect(400);
      expect(await t.prisma.dealRequestContactGrant.count()).toBe(0);
    });
  });

  describe('POST /api/v1/me/proposals/:id/accept | decline', () => {
    it('200: accept → MATCHED + contact grant + agency notified; second accept → 400', async () => {
      const { user, s } = await requester(t);
      const b = await broker(t);
      const req = await dealRequest(t.prisma, user.id);
      const p = await proposal(t.prisma, req.id, b.agency.id);
      const res = await withSession(t.http().post(`/api/v1/me/proposals/${p.id}/accept`), s).expect(
        200,
      );
      expect(res.body).toMatchObject({ id: p.id, status: 'ACCEPTED', contactShared: true });
      expect((await t.prisma.dealRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe(
        'MATCHED',
      );
      expect(await t.prisma.dealRequestContactGrant.count({ where: { revokedAt: null } })).toBe(1);
      const n = await t.prisma.notification.findFirstOrThrow({
        where: { userId: b.user.id, type: NotificationType.PROPOSAL_ACCEPTED },
      });
      expect(n.data).toMatchObject({
        dealRequestId: req.id,
        proposalId: p.id,
        contactShared: true,
      });
      const again = await withSession(
        t.http().post(`/api/v1/me/proposals/${p.id}/accept`),
        s,
      ).expect(400);
      expect(again.body.code).toBe('PROPOSAL_STATE_INVALID');
    });

    it('200: accept without sharing contact creates no grant; decline', async () => {
      const { user, s } = await requester(t);
      const b1 = await broker(t);
      const b2 = await broker(t);
      const req = await dealRequest(t.prisma, user.id);
      const p1 = await proposal(t.prisma, req.id, b1.agency.id);
      const p2 = await proposal(t.prisma, req.id, b2.agency.id);
      const acc = await withSession(t.http().post(`/api/v1/me/proposals/${p1.id}/accept`), s)
        .send({ shareContact: false })
        .expect(200);
      expect(acc.body.contactShared).toBe(false);
      expect(await t.prisma.dealRequestContactGrant.count()).toBe(0);
      const dec = await withSession(
        t.http().post(`/api/v1/me/proposals/${p2.id}/decline`),
        s,
      ).expect(200);
      expect(dec.body.status).toBe('DECLINED');
      expect(await t.prisma.notification.count({ where: { userId: b2.user.id } })).toBe(1);
    });

    it("404 for proposals on another user's request or withdrawn ones", async () => {
      const { s } = await requester(t);
      const other = await requester(t);
      const b = await broker(t);
      const req = await dealRequest(t.prisma, other.user.id);
      const p = await proposal(t.prisma, req.id, b.agency.id);
      await withSession(t.http().post(`/api/v1/me/proposals/${p.id}/accept`), s).expect(404);
      await withSession(t.http().post(`/api/v1/me/proposals/${p.id}/decline`), s).expect(404);
      const w = await proposal(
        t.prisma,
        (await dealRequest(t.prisma, other.user.id)).id,
        b.agency.id,
        {
          status: ProposalStatus.WITHDRAWN,
        },
      );
      await withSession(t.http().post(`/api/v1/me/proposals/${w.id}/accept`), other.s).expect(404);
      expect((await t.prisma.proposal.findUniqueOrThrow({ where: { id: p.id } })).status).toBe(
        'SENT',
      );
    });

    it('400 for invalid body / id; 401 anonymous', async () => {
      const { user, s } = await requester(t);
      const b = await broker(t);
      const req = await dealRequest(t.prisma, user.id);
      const p = await proposal(t.prisma, req.id, b.agency.id);
      await withSession(t.http().post(`/api/v1/me/proposals/${p.id}/accept`), s)
        .send({ shareContact: 'yes' })
        .expect(400);
      await withSession(t.http().post('/api/v1/me/proposals/123/decline'), s).expect(400);
      await t.http().post(`/api/v1/me/proposals/${p.id}/accept`).expect(401);
    });
  });
});
