import { AgencyStatus, ErrorCode, ListingStatus, MediaVisibility, UserRole } from '@house/shared';
import {
  createComplex,
  createMedia,
  createTestApp,
  createUser,
  loginUser,
  resetAll,
  withSession,
  type TestApp,
} from '../../utils';
import { LISTING_AD_TTL_DAYS } from '../../../src/modules/listings/constants';
import { AgencyListingsService } from '../../../src/modules/listings/services/agency-listings.service';
import { ListingsModerationService } from '../../../src/modules/listings/services/listings-moderation.service';
import {
  addCoBroker,
  agencyWithOwner,
  agentOf,
  createDraft,
  createPublished,
  NIL_UUID,
  EMD_CODE,
  EMD_CODE_8,
  OTHER_EMD_CODE,
  OTHER_EMD_CODE_8,
  ownerMemberId,
  publishablePayload,
} from './helpers';

const BASE = '/api/v1/agency/listings';

describe('agency listings (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  describe('POST /agency/listings', () => {
    it('creates a DRAFT with property, primary agency row and denormalized search columns', async () => {
      const a = await agencyWithOwner(t);
      const complex = await createComplex(t.prisma, { builtYear: 2015 });
      const res = await withSession(t.http().post(BASE), a.ownerSession)
        .send(publishablePayload({ property: { complexId: complex.id } }))
        .expect(201);
      expect(res.body).toMatchObject({
        status: ListingStatus.DRAFT,
        dealType: 'SALE',
        priceSort: 35_000,
        floorClass: 'MID',
        floorLabel: '12/20층',
        builtYear: 2015,
        isPrimaryAgency: true,
        property: { ho: '1203', dong: '101', emdCode: EMD_CODE_8, complexId: complex.id },
        complex: { id: complex.id },
      });
      expect(res.body.agencies).toHaveLength(1);
      expect(res.body.agencies[0]).toMatchObject({
        agencyId: a.agency.id,
        isPrimary: true,
        registrationNumber: a.agency.registrationNumber,
        contactName: a.agency.representativeName,
      });
      const row = await t.prisma.listing.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(row).toMatchObject({ sggCode: '12150', emdCode: EMD_CODE_8, lat: 34.95, rooms: 3 });
      const [loc] = await t.prisma.$queryRaw<{ ok: boolean }[]>`
        SELECT location IS NOT NULL AS ok FROM listings WHERE id = ${row.id}::uuid`;
      expect(loc?.ok).toBe(true);
    });

    it('stores a legacy 46150… 법정동 code (old Kakao bcode) as the current 8-digit 12150… code', async () => {
      const a = await agencyWithOwner(t);
      const res = await withSession(t.http().post(BASE), a.ownerSession)
        .send(publishablePayload({ property: { emdCode: '4615010400' } }))
        .expect(201);
      expect(res.body.property.emdCode).toBe('12150104');
      const row = await t.prisma.listing.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(row).toMatchObject({ sggCode: '12150', emdCode: '12150104' });
    });

    it('accepts the stored 8-digit form and keeps 리 codes; both spellings store one code', async () => {
      const a = await agencyWithOwner(t);
      for (const [sent, stored] of [
        [EMD_CODE_8, EMD_CODE_8],
        [EMD_CODE, EMD_CODE_8],
        ['1215031022', '1215031022'],
      ] as const) {
        const res = await withSession(t.http().post(BASE), a.ownerSession)
          .send(publishablePayload({ property: { emdCode: sent } }))
          .expect(201);
        expect(res.body.property.emdCode).toBe(stored);
      }
      await withSession(t.http().post(BASE), a.ownerSession)
        .send(publishablePayload({ property: { emdCode: '121501200' } }))
        .expect(400);
    });

    it('a licensed AGENT member can create; contact defaults to the member', async () => {
      const a = await agencyWithOwner(t);
      const agent = await agentOf(t, a.agency.id);
      const res = await withSession(t.http().post(BASE), agent.session)
        .send(publishablePayload())
        .expect(201);
      expect(res.body.agencies[0]).toMatchObject({
        contactMemberId: agent.memberId,
        contactName: '김중개',
        contactPhone: '01022223333',
      });
    });

    it('a 중개보조원 may create, but the ad contact falls back to the 대표 (제18조의2①)', async () => {
      const a = await agencyWithOwner(t);
      const assistant = await agentOf(t, a.agency.id, { isLicensed: false });
      const res = await withSession(t.http().post(BASE), assistant.session)
        .send(publishablePayload())
        .expect(201);
      expect(res.body.agencies[0]).toMatchObject({
        contactMemberId: await ownerMemberId(t, a.agency.id),
        contactName: a.agency.representativeName,
      });
      expect(JSON.stringify(res.body.agencies)).not.toContain('김중개');
      await withSession(t.http().post(`${BASE}/${res.body.id}/publish`), a.ownerSession).expect(
        200,
      );
      const pub = await t.http().get(`/api/v1/listings/${res.body.id}`).expect(200);
      expect(pub.body.agencies[0].contactName).toBe(a.agency.representativeName);
      expect(pub.body.agencies[0].contactPhone).not.toBe('01022223333');

      // An assistant cannot publish its own phone number as the contact either.
      const phone = await withSession(t.http().post(BASE), assistant.session)
        .send(publishablePayload({ contact: { contactPhone: '010-2222-3333' } }))
        .expect(400);
      expect(phone.body.code).toBe(ErrorCode.LISTING_CONTACT_MEMBER_INVALID);
    });

    it('400 when an unlicensed member is chosen explicitly as the contact', async () => {
      const a = await agencyWithOwner(t);
      const assistant = await agentOf(t, a.agency.id, { isLicensed: false });
      const res = await withSession(t.http().post(BASE), a.ownerSession)
        .send(publishablePayload({ contact: { contactMemberId: assistant.memberId } }))
        .expect(400);
      expect(res.body.code).toBe(ErrorCode.LISTING_CONTACT_MEMBER_INVALID);
      const id = await createDraft(t, a.ownerSession);
      const patch = await withSession(t.http().patch(`${BASE}/${id}`), a.ownerSession)
        .send({ contact: { contactMemberId: assistant.memberId } })
        .expect(400);
      expect(patch.body.code).toBe(ErrorCode.LISTING_CONTACT_MEMBER_INVALID);
    });

    it('401 anonymous, 403 plain user, 403 removed member, 403 unapproved agency', async () => {
      await t.http().post(BASE).send(publishablePayload()).expect(401);
      const user = await createUser(t.prisma);
      const us = await loginUser(t.app, user);
      await withSession(t.http().post(BASE), us).send(publishablePayload()).expect(403);

      const a = await agencyWithOwner(t);
      const removed = await agentOf(t, a.agency.id, { status: 'REMOVED' });
      const r1 = await withSession(t.http().post(BASE), removed.session)
        .send(publishablePayload())
        .expect(403);
      expect(r1.body.code).toBe(ErrorCode.LISTING_NOT_AGENCY_MEMBER);

      const pending = await agencyWithOwner(t, { status: AgencyStatus.PENDING });
      const r2 = await withSession(t.http().post(BASE), pending.ownerSession)
        .send(publishablePayload())
        .expect(403);
      expect(r2.body.code).toBe(ErrorCode.LISTING_AGENCY_NOT_ACTIVE);

      // Session claims an agency the user is not a member of.
      const other = await agencyWithOwner(t);
      const forged = await loginUser(
        t.app,
        { id: other.owner.id, role: UserRole.AGENCY_OWNER },
        { agencyId: a.agency.id },
      );
      await withSession(t.http().post(BASE), forged).send(publishablePayload()).expect(403);
    });

    it('400 on invalid payload, foreign region, unknown complex and foreign contact member', async () => {
      const a = await agencyWithOwner(t);
      const bad = await withSession(t.http().post(BASE), a.ownerSession)
        .send({ dealType: 'RENT', property: { assetType: 'APT', lat: 10 } })
        .expect(400);
      expect(bad.body.code).toBe(ErrorCode.VALIDATION_FAILED);
      const paths = (bad.body.details as { path: string }[]).map((d) => d.path);
      expect(paths).toEqual(expect.arrayContaining(['dealType', 'property.lat']));

      const region = await withSession(t.http().post(BASE), a.ownerSession)
        .send(publishablePayload({ property: { emdCode: '1111010100' } }))
        .expect(400);
      expect(region.body.code).toBe(ErrorCode.LISTING_REGION_NOT_SUPPORTED);
      // A 순천 법정동 code with a map position in Seoul.
      const seoul = await withSession(t.http().post(BASE), a.ownerSession)
        .send(publishablePayload({ property: { lat: 37.5665, lng: 126.978 } }))
        .expect(400);
      expect(seoul.body.code).toBe(ErrorCode.LISTING_REGION_NOT_SUPPORTED);
      const floor = await withSession(t.http().post(BASE), a.ownerSession)
        .send(publishablePayload({ property: { floor: 21 } }))
        .expect(400);
      expect(floor.body.code).toBe(ErrorCode.VALIDATION_FAILED);

      const complex = await withSession(t.http().post(BASE), a.ownerSession)
        .send(publishablePayload({ property: { complexId: NIL_UUID } }))
        .expect(400);
      expect(complex.body.code).toBe(ErrorCode.LISTING_COMPLEX_INVALID);

      const other = await agencyWithOwner(t);
      const foreignAgent = await agentOf(t, other.agency.id);
      const contact = await withSession(t.http().post(BASE), a.ownerSession)
        .send(publishablePayload({ contact: { contactMemberId: foreignAgent.memberId } }))
        .expect(400);
      expect(contact.body.code).toBe(ErrorCode.LISTING_CONTACT_MEMBER_INVALID);

      const moveIn = await withSession(t.http().post(BASE), a.ownerSession)
        .send(publishablePayload({ moveInType: 'DATE' }))
        .expect(400);
      expect(moveIn.body.details[0].path).toBe('moveInDate');
    });
  });

  describe('GET /agency/listings and /:id', () => {
    it('lists only listings of the acting agency, with filters', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const draft = await createDraft(t, a.ownerSession);
      const live = await createPublished(t, a.ownerSession);
      await createDraft(t, b.ownerSession);

      const all = await withSession(t.http().get(BASE), a.ownerSession).expect(200);
      expect(all.body.total).toBe(2);
      expect((all.body.items as { id: string }[]).map((i) => i.id).sort()).toEqual(
        [draft, live].sort(),
      );

      const active = await withSession(
        t.http().get(`${BASE}?statuses=ACTIVE&pageSize=1`),
        a.ownerSession,
      ).expect(200);
      expect(active.body).toMatchObject({ total: 1, pageSize: 1, items: [{ id: live }] });
    });

    it('detail includes private fields for members; other agencies get 404', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const id = await createDraft(t, a.ownerSession);
      const res = await withSession(t.http().get(`${BASE}/${id}`), a.ownerSession).expect(200);
      expect(res.body.property.ho).toBe('1203');
      expect(res.body.property.floor).toBe(12);

      const r = await withSession(t.http().get(`${BASE}/${id}`), b.ownerSession).expect(404);
      expect(r.body.code).toBe(ErrorCode.LISTING_NOT_FOUND);
      await t.http().get(`${BASE}/${id}`).expect(401);
    });

    it('400 on invalid id and query', async () => {
      const a = await agencyWithOwner(t);
      await withSession(t.http().get(`${BASE}/not-a-uuid`), a.ownerSession).expect(400);
      await withSession(t.http().get(`${BASE}?statuses=NOPE`), a.ownerSession).expect(400);
    });
  });

  describe('PATCH /agency/listings/:id', () => {
    it('updates listing + property and keeps search columns in sync', async () => {
      const a = await agencyWithOwner(t);
      const id = await createDraft(t, a.ownerSession);
      const res = await withSession(t.http().patch(`${BASE}/${id}`), a.ownerSession)
        .send({
          dealType: 'MONTHLY',
          salePrice: null,
          deposit: 1000,
          monthlyRent: 50,
          floorDisplay: 'CLASS',
          property: { floor: 2, emdCode: OTHER_EMD_CODE, lat: 34.96 },
          contact: { contactPhone: '061-700-1234' },
        })
        .expect(200);
      expect(res.body).toMatchObject({
        dealType: 'MONTHLY',
        salePrice: null,
        version: 1,
        priceSort: 1000,
        floorClass: 'LOW',
        floorLabel: '저/20층',
        emdCode: OTHER_EMD_CODE_8, // the 10-digit 읍면동 b_code is stored as 8 digits
      });
      expect(res.body.agencies[0]).toMatchObject({
        contactName: a.agency.representativeName,
        contactPhone: '0617001234',
      });
      const row = await t.prisma.listing.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({ lat: 34.96, emdCode: OTHER_EMD_CODE_8, priceSort: 1000 });
    });

    it('a deal-type change drops prices that no longer apply', async () => {
      const a = await agencyWithOwner(t);
      const id = await createDraft(t, a.ownerSession, {
        dealType: 'MONTHLY',
        salePrice: undefined,
        deposit: 1000,
        monthlyRent: 50,
      });
      const res = await withSession(t.http().patch(`${BASE}/${id}`), a.ownerSession)
        .send({ dealType: 'SALE', salePrice: 30_000 })
        .expect(200);
      expect(res.body).toMatchObject({ salePrice: 30_000, deposit: null, monthlyRent: null });
      const row = await t.prisma.listing.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({ deposit: null, monthlyRent: null, priceSort: 30_000 });
    });

    it('409 when the client edited an outdated version; 400 for a floor above the building', async () => {
      const a = await agencyWithOwner(t);
      const id = await createDraft(t, a.ownerSession);
      await withSession(t.http().patch(`${BASE}/${id}`), a.ownerSession)
        .send({ title: '첫 수정', version: 0 })
        .expect(200);
      const stale = await withSession(t.http().patch(`${BASE}/${id}`), a.ownerSession)
        .send({ title: '늦은 수정', version: 0 })
        .expect(409);
      expect(stale.body.code).toBe(ErrorCode.LISTING_CONCURRENT_MODIFICATION);
      const floor = await withSession(t.http().patch(`${BASE}/${id}`), a.ownerSession)
        .send({ property: { totalFloors: 10 } })
        .expect(400);
      expect(floor.body.code).toBe(ErrorCode.LISTING_FLOOR_INVALID);
      const zero = await withSession(t.http().patch(`${BASE}/${id}`), a.ownerSession)
        .send({ property: { floor: 0 } })
        .expect(400);
      expect(zero.body.code).toBe(ErrorCode.VALIDATION_FAILED);
    });

    it('concurrent writes: a stale merge never lands (publish vs. edit race)', async () => {
      const a = await agencyWithOwner(t);
      const id = await createDraft(t, a.ownerSession);
      const svc = t.app.get(AgencyListingsService);
      // Simulate a PATCH that loaded the row, then lost the race to another write.
      const original = svc.loadForActor.bind(svc);
      const spy = jest.spyOn(svc, 'loadForActor').mockImplementationOnce(async (...args) => {
        const row = await original(...args);
        await t.prisma.listing.update({ where: { id }, data: { version: { increment: 1 } } });
        return row;
      });
      const r = await withSession(t.http().patch(`${BASE}/${id}`), a.ownerSession)
        .send({ maintenanceFeeWon: null })
        .expect(409);
      expect(r.body.code).toBe(ErrorCode.LISTING_CONCURRENT_MODIFICATION);
      spy.mockRestore();
      const row = await t.prisma.listing.findUniqueOrThrow({ where: { id } });
      expect(row.maintenanceFeeWon).toBe(150_000);
    });

    it('an edit that breaks 명시사항 on a public listing is rejected', async () => {
      const a = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      const res = await withSession(t.http().patch(`${BASE}/${id}`), a.ownerSession)
        .send({ maintenanceFeeWon: null, property: { direction: null } })
        .expect(400);
      expect(res.body.code).toBe(ErrorCode.LISTING_PUBLISH_REQUIREMENTS);
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          { field: 'maintenanceFeeWon', label: '관리비' },
          { field: 'property.direction', label: '방향' },
        ]),
      );
    });

    it('404 for non-member agency, 401 anonymous, 400 empty/invalid body, 400 when CLOSED', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      await withSession(t.http().patch(`${BASE}/${id}`), b.ownerSession)
        .send({ title: 'x' })
        .expect(404);
      await t.http().patch(`${BASE}/${id}`).send({ title: 'x' }).expect(401);
      await withSession(t.http().patch(`${BASE}/${id}`), a.ownerSession)
        .send({})
        .expect(400);
      await withSession(t.http().patch(`${BASE}/${id}`), a.ownerSession)
        .send({ salePrice: -1 })
        .expect(400);

      await withSession(t.http().post(`${BASE}/${id}/status`), a.ownerSession)
        .send({ status: 'CLOSED' })
        .expect(200);
      const closed = await withSession(t.http().patch(`${BASE}/${id}`), a.ownerSession)
        .send({ title: '변경' })
        .expect(400);
      expect(closed.body.code).toBe(ErrorCode.LISTING_NOT_EDITABLE);
    });
  });

  describe('POST /agency/listings/:id/publish', () => {
    it('publishes a complete draft and updates counters', async () => {
      const a = await agencyWithOwner(t);
      const complex = await createComplex(t.prisma);
      const id = await createDraft(t, a.ownerSession, { property: { complexId: complex.id } });
      const res = await withSession(t.http().post(`${BASE}/${id}/publish`), a.ownerSession).expect(
        200,
      );
      expect(res.body.status).toBe(ListingStatus.ACTIVE);
      expect(res.body.publishedAt).toEqual(expect.any(String));
      const [c, ag] = await Promise.all([
        t.prisma.complex.findUniqueOrThrow({ where: { id: complex.id } }),
        t.prisma.agency.findUniqueOrThrow({ where: { id: a.agency.id } }),
      ]);
      expect(c.activeListingCount).toBe(1);
      expect(ag.activeListingCount).toBe(1);
    });

    it('lists every missing 표시·광고 명시사항 in Korean', async () => {
      const a = await agencyWithOwner(t);
      const res = await withSession(t.http().post(BASE), a.ownerSession)
        .send({
          dealType: 'SALE',
          property: {
            assetType: 'APT',
            roadAddress: '전남광주통합특별시 순천시 연향로 1',
            lat: 34.95,
            lng: 127.49,
          },
        })
        .expect(201);
      const r = await withSession(
        t.http().post(`${BASE}/${res.body.id}/publish`),
        a.ownerSession,
      ).expect(400);
      expect(r.body.code).toBe(ErrorCode.LISTING_PUBLISH_REQUIREMENTS);
      expect(r.body.message).toBe('광고 게시에 필요한 필수 표시사항이 누락되었습니다.');
      const labels = (r.body.details as { label: string }[]).map((d) => d.label);
      expect(labels).toEqual([
        '소재지(법정동)',
        '면적',
        '가격',
        '총 층수',
        '해당 층',
        '사용승인일',
        '방향',
        '방향 기준',
        '방 수',
        '욕실 수',
        '입주가능일',
        '주차대수',
        '관리비',
      ]);
    });

    it('원룸 정액관리비 ≥ 10만원 needs 건축물 용도 and an itemized breakdown (세부기준)', async () => {
      const a = await agencyWithOwner(t);
      const id = await createDraft(t, a.ownerSession, {
        dealType: 'MONTHLY',
        salePrice: undefined,
        deposit: 500,
        monthlyRent: 40,
        maintenanceFee: { billingType: 'FIXED', items: [] },
        property: { assetType: 'ONEROOM', complexId: undefined, dong: undefined },
      });
      const r = await withSession(t.http().post(`${BASE}/${id}/publish`), a.ownerSession).expect(
        400,
      );
      expect(r.body.code).toBe(ErrorCode.LISTING_PUBLISH_REQUIREMENTS);
      expect(r.body.details).toEqual([
        { field: 'property.buildingUse', label: '중개대상물 종류(건축물 용도)' },
        { field: 'maintenanceFee.breakdown', label: '관리비 세부내역' },
      ]);
      // Clearing the billing type is reported as such.
      await withSession(t.http().patch(`${BASE}/${id}`), a.ownerSession)
        .send({ maintenanceFee: null, property: { buildingUse: 'MULTI_FAMILY_HOUSE' } })
        .expect(200);
      const r2 = await withSession(t.http().post(`${BASE}/${id}/publish`), a.ownerSession).expect(
        400,
      );
      expect(r2.body.details).toEqual([
        { field: 'maintenanceFee.billingType', label: '관리비 부과방식' },
      ]);
      const fee = {
        billingType: 'FIXED',
        items: [
          { kind: 'GENERAL', included: true, amountWon: 120_000 },
          { kind: 'INTERNET', included: true, amountWon: 30_000 },
          { kind: 'ELECTRICITY', included: false },
        ],
      };
      await withSession(t.http().patch(`${BASE}/${id}`), a.ownerSession)
        .send({ maintenanceFee: fee })
        .expect(200);
      await withSession(t.http().post(`${BASE}/${id}/publish`), a.ownerSession).expect(200);
      const pub = await t.http().get(`/api/v1/listings/${id}`).expect(200);
      expect(pub.body.maintenanceFee).toEqual(fee);
      expect(pub.body.property.buildingUse).toBe('MULTI_FAMILY_HOUSE');
    });

    it('rejects free-text 건축물 용도 and malformed 관리비 내역 (400)', async () => {
      const a = await agencyWithOwner(t);
      const bad = [
        { property: { buildingUse: '원룸' } },
        { maintenanceFee: { billingType: 'MONTHLY' } },
        { maintenanceFee: { billingType: 'UNKNOWN', items: [] } },
        {
          maintenanceFee: {
            billingType: 'FIXED',
            items: [
              { kind: 'WATER', included: true },
              { kind: 'WATER', included: false },
            ],
          },
        },
      ];
      for (const overrides of bad) {
        const res = await withSession(t.http().post(BASE), a.ownerSession)
          .send(publishablePayload(overrides))
          .expect(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
      }
    });

    it('republishing keeps the first publication time and starts a new ad period', async () => {
      const a = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      const first = await t.prisma.listing.findUniqueOrThrow({ where: { id } });
      expect(first.expiresAt!.getTime() - first.publishedAt!.getTime()).toBe(
        LISTING_AD_TTL_DAYS * 86_400_000,
      );
      await withSession(t.http().post(`${BASE}/${id}/status`), a.ownerSession)
        .send({ status: 'DRAFT' })
        .expect(200);
      const res = await withSession(t.http().post(`${BASE}/${id}/publish`), a.ownerSession).expect(
        200,
      );
      expect(res.body.publishedAt).toBe(first.publishedAt!.toISOString());
      expect(new Date(res.body.expiresAt as string).getTime()).toBeGreaterThanOrEqual(
        first.expiresAt!.getTime(),
      );
    });

    it('a listing placed outside the service region cannot be published', async () => {
      const a = await agencyWithOwner(t);
      const id = await createDraft(t, a.ownerSession);
      // A draft written before the region guard existed.
      await t.prisma.listing.update({ where: { id }, data: { lat: 37.5665, lng: 126.978 } });
      const row = await t.prisma.listing.findUniqueOrThrow({ where: { id } });
      await t.prisma.property.update({
        where: { id: row.propertyId },
        data: { lat: 37.5665, lng: 126.978 },
      });
      const r = await withSession(t.http().post(`${BASE}/${id}/publish`), a.ownerSession).expect(
        400,
      );
      expect(r.body.code).toBe(ErrorCode.LISTING_REGION_NOT_SUPPORTED);
    });

    it('403 for a co-broker (primary only), 404 for outsiders, 400 when already ACTIVE / bad id', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const c = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      await addCoBroker(t, id, a, b);
      const r = await withSession(t.http().post(`${BASE}/${id}/publish`), b.ownerSession).expect(
        403,
      );
      expect(r.body.code).toBe(ErrorCode.LISTING_PRIMARY_AGENCY_ONLY);
      await withSession(t.http().post(`${BASE}/${id}/publish`), c.ownerSession).expect(404);
      const again = await withSession(
        t.http().post(`${BASE}/${id}/publish`),
        a.ownerSession,
      ).expect(400);
      expect(again.body.code).toBe(ErrorCode.LISTING_INVALID_STATUS_TRANSITION);
      await withSession(t.http().post(`${BASE}/xyz/publish`), a.ownerSession).expect(400);
    });
  });

  describe('POST /agency/listings/:id/status', () => {
    it('ACTIVE → RESERVED → ACTIVE → CLOSED → DRAFT', async () => {
      const a = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      for (const status of ['RESERVED', 'ACTIVE', 'CLOSED', 'DRAFT'] as const) {
        const res = await withSession(t.http().post(`${BASE}/${id}/status`), a.ownerSession)
          .send({ status })
          .expect(200);
        expect(res.body.status).toBe(status);
        if (status === 'CLOSED') expect(res.body.closedAt).toEqual(expect.any(String));
      }
      const ag = await t.prisma.agency.findUniqueOrThrow({ where: { id: a.agency.id } });
      expect(ag.activeListingCount).toBe(0);
    });

    it('rejects invalid transitions and non-agency statuses', async () => {
      const a = await agencyWithOwner(t);
      const id = await createDraft(t, a.ownerSession);
      const r = await withSession(t.http().post(`${BASE}/${id}/status`), a.ownerSession)
        .send({ status: 'ACTIVE' })
        .expect(400);
      expect(r.body).toMatchObject({
        code: ErrorCode.LISTING_INVALID_STATUS_TRANSITION,
        details: { from: 'DRAFT', to: 'ACTIVE' },
      });
      const v = await withSession(t.http().post(`${BASE}/${id}/status`), a.ownerSession)
        .send({ status: 'HIDDEN' })
        .expect(400);
      expect(v.body.code).toBe(ErrorCode.VALIDATION_FAILED);
    });

    it('agents of other agencies get 404; a co-broker agent gets 403', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      await withSession(t.http().post(`${BASE}/${id}/status`), b.ownerSession)
        .send({ status: 'CLOSED' })
        .expect(404);
      await addCoBroker(t, id, a, b);
      const agentB = await agentOf(t, b.agency.id);
      await withSession(t.http().post(`${BASE}/${id}/status`), agentB.session)
        .send({ status: 'CLOSED' })
        .expect(403);
    });
  });

  describe('POST /agency/listings/:id/verifications', () => {
    it('records 실매물 확인 and keeps the latest date on listings.verified_at', async () => {
      const a = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      await withSession(t.http().post(`${BASE}/${id}/verifications`), a.ownerSession)
        .send({ method: 'SITE_VISIT', verifiedAt: '2026-01-10', note: '현장 방문' })
        .expect(201);
      const res = await withSession(t.http().post(`${BASE}/${id}/verifications`), a.ownerSession)
        .send({ method: 'OWNER_CALL', verifiedAt: '2025-12-01' })
        .expect(201);
      expect(res.body.verifications).toHaveLength(2);
      expect(res.body.verifiedAt).toBe('2026-01-09T15:00:00.000Z');
      expect(res.body.latestVerification).toEqual({
        method: 'SITE_VISIT',
        verifiedAt: '2026-01-09T15:00:00.000Z',
      });
    });

    it('a 실매물 확인 today extends the ad period; co-brokers cannot add one (403)', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      const shortExpiry = new Date(Date.now() + 86_400_000);
      await t.prisma.listing.update({ where: { id }, data: { expiresAt: shortExpiry } });
      const today = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
      const res = await withSession(t.http().post(`${BASE}/${id}/verifications`), a.ownerSession)
        .send({ method: 'OWNER_CALL', verifiedAt: today })
        .expect(201);
      expect(new Date(res.body.expiresAt as string).getTime()).toBeGreaterThan(
        shortExpiry.getTime() + 20 * 86_400_000,
      );
      await addCoBroker(t, id, a, b);
      const r = await withSession(t.http().post(`${BASE}/${id}/verifications`), b.ownerSession)
        .send({ method: 'OWNER_CALL', verifiedAt: today })
        .expect(403);
      expect(r.body.code).toBe(ErrorCode.LISTING_PRIMARY_AGENCY_ONLY);
    });

    it('400 for future dates / bad method, 404 for outsiders, 401 anonymous', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      const future = await withSession(t.http().post(`${BASE}/${id}/verifications`), a.ownerSession)
        .send({ method: 'SITE_VISIT', verifiedAt: '2999-01-01' })
        .expect(400);
      expect(future.body.code).toBe(ErrorCode.LISTING_VERIFICATION_FUTURE_DATE);
      await withSession(t.http().post(`${BASE}/${id}/verifications`), a.ownerSession)
        .send({ method: 'GUESS', verifiedAt: '2026-01-01' })
        .expect(400);
      await withSession(t.http().post(`${BASE}/${id}/verifications`), b.ownerSession)
        .send({ method: 'SITE_VISIT', verifiedAt: '2026-01-01' })
        .expect(404);
      await t
        .http()
        .post(`${BASE}/${id}/verifications`)
        .send({ method: 'SITE_VISIT', verifiedAt: '2026-01-01' })
        .expect(401);
    });
  });

  describe('PUT /agency/listings/:id/photos', () => {
    it('replaces photos in order with a cover and updates photoCount', async () => {
      const a = await agencyWithOwner(t);
      const id = await createDraft(t, a.ownerSession);
      const m1 = await createMedia(t.prisma, {
        ownerUserId: a.owner.id,
        variants: { thumb: { key: 'v/t1.webp' }, medium: { key: 'v/m1.webp' } },
      });
      const m2 = await createMedia(t.prisma, { ownerUserId: a.owner.id });
      const res = await withSession(t.http().put(`${BASE}/${id}/photos`), a.ownerSession)
        .send({
          photos: [{ mediaId: m2.id }, { mediaId: m1.id, caption: '거실' }],
          coverMediaId: m1.id,
        })
        .expect(200);
      expect((res.body as { mediaId: string }[]).map((p) => p.mediaId)).toEqual([m2.id, m1.id]);
      expect(res.body[1]).toMatchObject({
        isCover: true,
        caption: '거실',
        thumbUrl: '/media/v/t1.webp',
        mediumUrl: '/media/v/m1.webp',
        largeUrl: `/media/${m1.storageKey}`,
      });
      const row = await t.prisma.listing.findUniqueOrThrow({ where: { id } });
      expect(row.photoCount).toBe(2);

      // Photos belong to the primary agency's ad: a co-broker cannot replace or delete them.
      const b = await agencyWithOwner(t);
      await withSession(t.http().post(`${BASE}/${id}/publish`), a.ownerSession).expect(200);
      await addCoBroker(t, id, a, b);
      const co = await withSession(t.http().put(`${BASE}/${id}/photos`), b.ownerSession)
        .send({ photos: [] })
        .expect(403);
      expect(co.body.code).toBe(ErrorCode.LISTING_PRIMARY_AGENCY_ONLY);
      const after = await t.prisma.listing.findUniqueOrThrow({ where: { id } });
      expect(after.photoCount).toBe(2);
    });

    it('rejects foreign / private / non-ready media, duplicates and over-limit sets', async () => {
      const a = await agencyWithOwner(t);
      const id = await createDraft(t, a.ownerSession);
      const stranger = await createUser(t.prisma);
      const foreign = await createMedia(t.prisma, { ownerUserId: stranger.id });
      const priv = await createMedia(t.prisma, {
        ownerUserId: a.owner.id,
        visibility: MediaVisibility.PRIVATE,
      });
      const pending = await createMedia(t.prisma, { ownerUserId: a.owner.id, status: 'PENDING' });
      for (const m of [foreign, priv, pending]) {
        const r = await withSession(t.http().put(`${BASE}/${id}/photos`), a.ownerSession)
          .send({ photos: [{ mediaId: m.id }] })
          .expect(400);
        expect(r.body.code).toBe(ErrorCode.LISTING_MEDIA_INVALID);
      }
      await withSession(t.http().put(`${BASE}/${id}/photos`), a.ownerSession)
        .send({ photos: [{ mediaId: foreign.id }, { mediaId: foreign.id }] })
        .expect(400);
      await withSession(t.http().put(`${BASE}/${id}/photos`), a.ownerSession)
        .send({ photos: Array.from({ length: 31 }, () => ({ mediaId: NIL_UUID })) })
        .expect(400);
    });

    it('404 for outsiders, 401 anonymous', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const id = await createDraft(t, a.ownerSession);
      await withSession(t.http().put(`${BASE}/${id}/photos`), b.ownerSession)
        .send({ photos: [] })
        .expect(404);
      await t.http().put(`${BASE}/${id}/photos`).send({ photos: [] }).expect(401);
    });
  });

  describe('DELETE /agency/listings/:id', () => {
    it('soft-deletes (primary only) and hides it everywhere', async () => {
      const a = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      await withSession(t.http().delete(`${BASE}/${id}`), a.ownerSession).expect(204);
      const row = await t.prisma.listing.findUniqueOrThrow({ where: { id } });
      expect(row.deletedAt).not.toBeNull();
      await withSession(t.http().get(`${BASE}/${id}`), a.ownerSession).expect(404);
      await t.http().get(`/api/v1/listings/${id}`).expect(404);
      const ag = await t.prisma.agency.findUniqueOrThrow({ where: { id: a.agency.id } });
      expect(ag.activeListingCount).toBe(0);
    });

    it('403 for co-brokers, 404 for outsiders, 401 anonymous, 400 bad id', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const c = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      await addCoBroker(t, id, a, b);
      await withSession(t.http().delete(`${BASE}/${id}`), b.ownerSession).expect(403);
      await withSession(t.http().delete(`${BASE}/${id}`), c.ownerSession).expect(404);
      await t.http().delete(`${BASE}/${id}`).expect(401);
      await withSession(t.http().delete(`${BASE}/1`), a.ownerSession).expect(400);
    });

    it('hidden listings and listings under report review cannot be deleted or edited', async () => {
      const a = await agencyWithOwner(t);
      const hidden = await createPublished(t, a.ownerSession);
      await t.app.get(ListingsModerationService).hide(hidden, '허위매물 신고');
      const h1 = await withSession(t.http().delete(`${BASE}/${hidden}`), a.ownerSession).expect(
        400,
      );
      expect(h1.body.code).toBe(ErrorCode.LISTING_NOT_EDITABLE);
      const h2 = await withSession(t.http().patch(`${BASE}/${hidden}`), a.ownerSession)
        .send({ description: '증거 인멸' })
        .expect(400);
      expect(h2.body.code).toBe(ErrorCode.LISTING_NOT_EDITABLE);
      const m = await createMedia(t.prisma, { ownerUserId: a.owner.id });
      await withSession(t.http().put(`${BASE}/${hidden}/photos`), a.ownerSession)
        .send({ photos: [{ mediaId: m.id }] })
        .expect(400);

      const reported = await createPublished(t, a.ownerSession);
      await t.prisma.report.create({
        data: { targetType: 'LISTING', listingId: reported, reason: 'ALREADY_DEALT' },
      });
      const r = await withSession(t.http().delete(`${BASE}/${reported}`), a.ownerSession).expect(
        400,
      );
      expect(r.body.code).toBe(ErrorCode.LISTING_UNDER_REVIEW);
      const row = await t.prisma.listing.findUniqueOrThrow({ where: { id: reported } });
      expect(row.deletedAt).toBeNull();
    });

    it('CSRF: a session request without the token is refused', async () => {
      const a = await agencyWithOwner(t);
      const id = await createDraft(t, a.ownerSession);
      await t
        .http()
        .delete(`${BASE}/${id}`)
        .set('Cookie', a.ownerSession.cookie)
        .set('Origin', a.ownerSession.origin)
        .expect(403);
    });
  });
});
