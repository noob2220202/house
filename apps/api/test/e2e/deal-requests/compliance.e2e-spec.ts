import {
  ACTION_CONSENT_TERMS,
  DEAL_REQUEST_LIMITS,
  DEAL_REQUEST_LOCATION_GRID_DEG,
  DealRequestStatus,
  DealRequestType,
  MediaPurpose,
  TermsType,
} from '@house/shared';
import {
  DEAL_REQUEST_PRIVACY_BODY,
  DEAL_REQUEST_PROVIDE_BODY,
  seedTerms,
} from '../../../prisma/seed/base';
import { DealRequestMaintenanceService } from '../../../src/modules/deal-requests/services/deal-request-maintenance.service';
import { createMedia, resetAll, withSession, type TestApp } from '../../utils';
import {
  agent,
  broker,
  createDealRequestsApp,
  dealRequest,
  proposal,
  requester,
} from './factories';

const DAY = 86_400_000;

/**
 * Compliance of 내놓기·구하기 with the consent notices (audit stage 3): retention + erasure of ended
 * requests, the reduced pre-grant agency view, the 중개보조원 disclosure on proposals, and the seeded
 * notice text stating exactly those rules.
 */
describe('deal-requests: privacy compliance (e2e)', () => {
  let t: TestApp;
  let jobs: DealRequestMaintenanceService;

  beforeAll(async () => {
    ({ t } = await createDealRequestsApp());
    jobs = t.app.get(DealRequestMaintenanceService);
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  const photoOf = async (dealRequestId: string, ownerUserId: string) => {
    const media = await createMedia(t.prisma, {
      purpose: MediaPurpose.DEAL_REQUEST_PHOTO,
      ownerUserId,
    });
    await t.prisma.dealRequestPhoto.create({ data: { dealRequestId, mediaId: media.id } });
    return media;
  };
  const identifying = {
    roadAddress: '전남광주통합특별시 순천시 중앙로 1',
    addressDetail: '101동 1001호',
    lat: 34.950123,
    lng: 127.487654,
    floor: 7,
    exclusiveArea: 84.97,
    description: '· 가격 협의 가능\n\n101동 남향, 올수리',
  };

  describe('retention: 30 days after a request ended', () => {
    it('scrubDue erases contact, address, position, floor, area, description and photos; keeps the request record; idempotent', async () => {
      expect(DEAL_REQUEST_LIMITS.CONTACT_RETENTION_DAYS).toBe(30);
      const b = await broker(t);
      const { user } = await requester(t);
      const now = new Date('2026-12-31T00:00:00.000Z');
      const endedAt = (days: number) => new Date(now.getTime() - days * DAY);
      const due = await Promise.all(
        [DealRequestStatus.CLOSED, DealRequestStatus.CANCELLED, DealRequestStatus.EXPIRED].map(
          (status) =>
            dealRequest(t.prisma, user.id, {
              ...identifying,
              emdCode: '1215010100',
              status,
              closedAt: endedAt(30),
            }),
        ),
      );
      const photos = await Promise.all(due.map((r) => photoOf(r.id, user.id)));
      await t.prisma.dealRequestContactGrant.create({
        data: { dealRequestId: due[0]!.id, agencyId: b.agency.id },
      });
      // Scrubbed under the old policy (contact only): the address etc. are still there.
      const legacy = await dealRequest(t.prisma, user.id, {
        ...identifying,
        status: DealRequestStatus.CLOSED,
        closedAt: endedAt(120),
        contactName: '',
        contactPhone: '',
        addressDetail: null,
        contactScrubbedAt: endedAt(30),
      });
      const inside = await dealRequest(t.prisma, user.id, {
        ...identifying,
        status: DealRequestStatus.CLOSED,
        closedAt: endedAt(29),
      });
      const open = await dealRequest(t.prisma, user.id, identifying);

      expect(await jobs.scrubDue(now)).toBe(4);
      for (const r of [...due, legacy]) {
        const row = await t.prisma.dealRequest.findUniqueOrThrow({ where: { id: r.id } });
        expect(row).toMatchObject({
          contactName: '',
          contactPhone: '',
          addressDetail: null,
          roadAddress: null,
          lat: null,
          lng: null,
          floor: null,
          exclusiveArea: null,
          description: null,
          // The request record the notice says is kept.
          type: DealRequestType.SELL_OR_LEASE,
          assetType: 'APT',
          dealTypes: ['SALE'],
          desiredSalePrice: 30000,
        });
        expect(row.contactScrubbedAt).not.toBeNull();
      }
      expect(
        (await t.prisma.dealRequest.findUniqueOrThrow({ where: { id: due[0]!.id } })).emdCode,
      ).toBe('1215010100');
      const [loc] = await t.prisma.$queryRaw<{ location: string | null }[]>`
        SELECT location::text AS location FROM deal_requests WHERE id = ${due[0]!.id}::uuid`;
      expect(loc?.location).toBeNull();
      expect(
        await t.prisma.dealRequestPhoto.count({
          where: { dealRequestId: { in: due.map((r) => r.id) } },
        }),
      ).toBe(0);
      for (const m of photos) {
        expect(
          (await t.prisma.media.findUniqueOrThrow({ where: { id: m.id } })).deletedAt,
        ).not.toBeNull();
      }
      expect((await t.prisma.dealRequestContactGrant.findFirstOrThrow()).revokedAt).not.toBeNull();
      // Inside the period and live requests are untouched.
      for (const id of [inside.id, open.id]) {
        expect(await t.prisma.dealRequest.findUniqueOrThrow({ where: { id } })).toMatchObject({
          contactPhone: '01012345678',
          roadAddress: identifying.roadAddress,
          description: identifying.description,
        });
      }
      // Idempotent: a second run (or a concurrent one) finds nothing.
      expect(await jobs.scrubDue(now)).toBe(0);
      expect(await jobs.scrubDue(new Date(now.getTime() + DAY))).toBe(1); // `inside` is due now
    });

    it('a granted agency stops seeing contact and details at the cutoff, even before the job ran', async () => {
      const b = await broker(t);
      const { user } = await requester(t);
      const req = await dealRequest(t.prisma, user.id, {
        ...identifying,
        status: DealRequestStatus.CLOSED,
        closedAt: new Date(Date.now() - 30 * DAY - 60_000),
      });
      await proposal(t.prisma, req.id, b.agency.id, { status: 'ACCEPTED' });
      await t.prisma.dealRequestContactGrant.create({
        data: { dealRequestId: req.id, agencyId: b.agency.id },
      });
      const url = `/api/v1/agency/deal-requests/${req.id}`;
      const late = await withSession(t.http().get(url), b.s).expect(200);
      expect(late.body).toMatchObject({ contact: null, detailsShared: false, roadAddress: null });
      // 29 days after closing it is still shared.
      await t.prisma.dealRequest.update({
        where: { id: req.id },
        data: { closedAt: new Date(Date.now() - 29 * DAY) },
      });
      const fresh = await withSession(t.http().get(url), b.s).expect(200);
      expect(fresh.body).toMatchObject({
        detailsShared: true,
        contact: { name: '홍길동', phone: '01012345678', addressDetail: '101동 1001호' },
      });
    });
  });

  describe('agency view before a contact grant', () => {
    it('내놓기: 읍면동, area band, ~200 m grid point, flags only — exact details after the grant', async () => {
      const b = await broker(t);
      const { user, s } = await requester(t);
      const req = await dealRequest(t.prisma, user.id, { ...identifying, emdCode: '1215010100' });
      await photoOf(req.id, user.id);
      await proposal(t.prisma, req.id, b.agency.id);
      const url = `/api/v1/agency/deal-requests/${req.id}`;

      const list = await withSession(t.http().get('/api/v1/agency/deal-requests'), b.s).expect(200);
      const before = await withSession(t.http().get(url), b.s).expect(200);
      for (const view of [list.body.items[0], before.body]) {
        expect(view).toMatchObject({
          id: req.id,
          emdCode: '1215010100',
          assetType: 'APT',
          desiredSalePrice: 30000,
          roadAddress: null,
          floor: null,
          exclusiveArea: null,
          areaRange: { min: 60, max: 85 },
          description: '· 가격 협의 가능',
          photos: [],
          photoCount: 1,
          contact: null,
          detailsShared: false,
          lat: 34.951,
          lng: 127.487,
        });
        expect(JSON.stringify(view)).not.toMatch(/중앙로|1001호|올수리/);
        // The grid point is within half a cell of the real point and never the point itself.
        expect(Math.abs(view.lat - identifying.lat)).toBeLessThanOrEqual(
          DEAL_REQUEST_LOCATION_GRID_DEG / 2,
        );
      }

      // The requester shares contact + details with this office.
      await withSession(t.http().post(`/api/v1/me/deal-requests/${req.id}/contact-grants`), s)
        .send({ agencyId: b.agency.id })
        .expect(201);
      const after = await withSession(t.http().get(url), b.s).expect(200);
      expect(after.body).toMatchObject({
        detailsShared: true,
        roadAddress: identifying.roadAddress,
        lat: identifying.lat,
        lng: identifying.lng,
        floor: 7,
        exclusiveArea: 84.97,
        description: identifying.description,
        photoCount: 1,
        contact: { name: '홍길동', addressDetail: '101동 1001호' },
      });
      expect(after.body.photos).toHaveLength(1);
      // Another office still gets the reduced view.
      const other = await broker(t);
      expect((await withSession(t.http().get(url), other.s).expect(200)).body).toMatchObject({
        detailsShared: false,
        roadAddress: null,
        photos: [],
      });
    });

    it('구하기: the conditions and description are the 제공 항목, nothing is reduced', async () => {
      const b = await broker(t);
      const { user } = await requester(t);
      const req = await dealRequest(t.prisma, user.id, {
        type: DealRequestType.WANTED,
        roadAddress: null,
        addressDetail: null,
        regionCodes: ['1215010100'],
        description: '역세권 원룸 찾아요',
      });
      const res = await withSession(
        t.http().get(`/api/v1/agency/deal-requests/${req.id}`),
        b.s,
      ).expect(200);
      expect(res.body).toMatchObject({
        description: '역세권 원룸 찾아요',
        regionCodes: ['1215010100'],
        detailsShared: false,
        contact: null,
      });
    });
  });

  describe('proposals of a 중개보조원', () => {
    it('are labelled 중개보조원 without the assistant’s phone; a 공인중개사 keeps “담당” + phone', async () => {
      const b = await broker(t);
      const assistant = await agent(t, b.agency); // joined members are 중개보조원 (isLicensed false)
      await t.prisma.agencyMember.updateMany({
        where: { userId: assistant.user.id },
        data: { phone: '01055556666' },
      });
      const { user, s } = await requester(t);
      const req = await dealRequest(t.prisma, user.id);
      await withSession(
        t.http().post(`/api/v1/agency/deal-requests/${req.id}/proposals`),
        assistant.s,
      )
        .send({ message: '조건에 맞는 매물을 찾아 드릴게요.' })
        .expect(201);

      const mine = await withSession(t.http().get(`/api/v1/me/deal-requests/${req.id}`), s).expect(
        200,
      );
      expect(mine.body.proposals).toHaveLength(1);
      expect(mine.body.proposals[0].agent).toEqual({
        displayName: '김중개',
        isAssistant: true,
        phone: null,
      });
      expect(JSON.stringify(mine.body)).not.toContain('01055556666');
      // The office number of the disclosure stays the contact.
      expect(mine.body.proposals[0].agency).toMatchObject({ phone: b.agency.phone });

      // Once the owner records a license the same member is shown as a 공인중개사.
      await t.prisma.agencyMember.updateMany({
        where: { userId: assistant.user.id },
        data: { isLicensed: true, licenseNumber: '전남-2026-00001' },
      });
      const licensed = await withSession(
        t.http().get(`/api/v1/me/deal-requests/${req.id}`),
        s,
      ).expect(200);
      expect(licensed.body.proposals[0].agent).toEqual({
        displayName: '김중개',
        isAssistant: false,
        phone: '01055556666',
      });
    });
  });

  describe('seeded consent notices state what the code does', () => {
    it('retention period, erased items, pre-grant items and the location grid', () => {
      const days = `${DEAL_REQUEST_LIMITS.CONTACT_RETENTION_DAYS}일`;
      expect(DEAL_REQUEST_PRIVACY_BODY).toContain(
        `요청이 끝난 날(거래 완료·취소·기간 만료)부터 ${days}`,
      );
      for (const item of [
        '이름',
        '휴대폰 번호',
        '동·호수',
        '도로명 주소',
        '위치',
        '층',
        '면적',
        '사진',
        '설명',
      ]) {
        expect(DEAL_REQUEST_PRIVACY_BODY).toContain(item);
      }
      expect(DEAL_REQUEST_PROVIDE_BODY).toContain(`요청이 끝난 날부터 ${days}까지`);
      expect(DEAL_REQUEST_PROVIDE_BODY).toContain('전용면적 구간');
      expect(DEAL_REQUEST_PROVIDE_BODY).toContain('사진 장수');
      expect(DEAL_REQUEST_PROVIDE_BODY).toMatch(
        /연락처를 공개한 중개사무소에만 제공하는 항목: .*도로명 주소·동·호수·정확한 위치·층·전용면적·사진·설명/,
      );
      // "약 200m": one grid cell is ~222 m north–south (1° latitude ≈ 111 km).
      expect(DEAL_REQUEST_PROVIDE_BODY).toContain('약 200m');
      expect(Math.round(DEAL_REQUEST_LOCATION_GRID_DEG * 111_000)).toBe(222);
      expect(DEAL_REQUEST_PROVIDE_BODY + DEAL_REQUEST_PRIVACY_BODY).not.toMatch(/90일|1년/);
    });

    it('seedTerms publishes the corrected sample over an outdated unreviewed one, never over the operator’s text', async () => {
      const past = new Date(Date.now() - DAY);
      const now = new Date();
      await t.prisma.termsDocument.create({
        data: {
          type: TermsType.DEAL_REQUEST_PRIVACY,
          version: '1.0',
          title: '옛 견본',
          content: '# 옛 견본\n\n> 견본입니다.\n\n- 보유·이용 기간: 요청 종료 후 30일까지',
          isRequired: true,
          effectiveAt: past,
          publishedAt: past,
        },
      });
      await t.prisma.termsDocument.create({
        data: {
          type: TermsType.DEAL_REQUEST_PROVIDE,
          version: '2.0',
          title: '검토 완료본',
          content: '운영자가 작성한 제공 동의',
          isRequired: true,
          effectiveAt: past,
          publishedAt: past,
        },
      });
      await seedTerms(t.prisma, now);
      const privacy = await t.prisma.termsDocument.findMany({
        where: { type: TermsType.DEAL_REQUEST_PRIVACY },
        orderBy: { createdAt: 'asc' },
      });
      expect(privacy.map((d) => d.version)).toEqual(['1.0', '1.1']);
      expect(privacy[1]!.content).toContain(DEAL_REQUEST_PRIVACY_BODY);
      expect(
        (
          await t.prisma.termsDocument.findMany({ where: { type: TermsType.DEAL_REQUEST_PROVIDE } })
        ).map((d) => d.version),
      ).toEqual(['2.0']);
      // Idempotent.
      await seedTerms(t.prisma, now);
      expect(
        await t.prisma.termsDocument.count({ where: { type: TermsType.DEAL_REQUEST_PRIVACY } }),
      ).toBe(2);
      // The current deal-request version is the new sample: GET /terms/:type serves it.
      const current = await t
        .http()
        .get(`/api/v1/terms/${TermsType.DEAL_REQUEST_PRIVACY}`)
        .expect(200);
      expect(current.body).toMatchObject({ version: '1.1' });
      expect(ACTION_CONSENT_TERMS.DEAL_REQUEST).toContain(TermsType.DEAL_REQUEST_PRIVACY);
    });
  });
});
