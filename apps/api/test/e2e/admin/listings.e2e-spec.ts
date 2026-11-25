import {
  AdminRole,
  ErrorCode,
  ListingStatus,
  NotificationType,
  ReportReason,
  ReportTargetType,
  VerificationMethod,
} from '@house/shared';
import {
  createAgency,
  createComplex,
  createListing,
  createTestApp,
  createUser,
  loginUser,
  resetAll,
  type TestApp,
  type TestSession,
  withoutUuids,
} from '../../utils';
import { adminActor, api, as, auditRows, expectAdminAuthz, expectCode, pluck } from './helpers';

describe('admin listing moderation (e2e)', () => {
  let t: TestApp;
  let userSession: TestSession;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetAll(t);
    userSession = await loginUser(t.app, await createUser(t.prisma));
  });
  afterAll(() => t?.close());

  async function fixture() {
    const { agency, owner } = await createAgency(t.prisma);
    const complex = await createComplex(t.prisma);
    const { listing } = await createListing(t.prisma, {
      agencyId: agency.id,
      property: {
        complexId: complex.id,
        ho: '1203',
        roadAddress: '전남광주통합특별시 순천시 연향로 10',
      },
      listing: { complexId: complex.id, title: '연향동 역세권 아파트' },
    });
    await t.prisma.complex.update({ where: { id: complex.id }, data: { activeListingCount: 1 } });
    return { agency, owner, complex, listing };
  }

  it('lists and filters all agencies’ listings; detail never exposes 호수', async () => {
    const { listing, agency } = await fixture();
    const other = await createAgency(t.prisma);
    await createListing(t.prisma, {
      agencyId: other.agency.id,
      listing: { status: ListingStatus.DRAFT },
    });
    const { session } = await adminActor(t, AdminRole.OPERATOR);

    expect((await as(t, session, 'get', '/admin/listings').expect(200)).body.total).toBe(2);
    const filtered = await as(
      t,
      session,
      'get',
      `/admin/listings?status=ACTIVE&agencyId=${agency.id}&q=${encodeURIComponent('연향')}`,
    ).expect(200);
    expect(filtered.body.items).toEqual([
      expect.objectContaining({
        id: listing.id,
        primaryAgency: { id: agency.id, name: agency.name },
        roadAddress: '전남광주통합특별시 순천시 연향로 10',
        openReportCount: 0,
      }),
    ]);
    const detail = await as(t, session, 'get', `/admin/listings/${listing.id}`).expect(200);
    expect(detail.body.agencies).toEqual([
      {
        id: agency.id,
        name: agency.name,
        isPrimary: true,
        status: 'ACTIVE',
        contactName: null,
        phone: null,
        joinedAt: expect.any(String),
      },
    ]);
    // Random UUIDs can contain the digits 1203: check everything but the ids.
    expect(withoutUuids(detail.body)).not.toContain('1203');
    expectCode(
      await as(t, session, 'get', '/admin/listings/01890a5d-ac96-774b-bcce-b302099a8057').expect(
        404,
      ),
      ErrorCode.ADMIN_LISTING_NOT_FOUND,
    );
  });

  it('list/detail carry what the moderation screens render (co-brokers, verification, review queue, history)', async () => {
    const { listing, agency, complex } = await fixture();
    const co = await createAgency(t.prisma);
    await t.prisma.listingAgency.create({
      data: { listingId: listing.id, agencyId: co.agency.id, contactName: '김중개' },
    });
    await t.prisma.listing.update({
      where: { id: listing.id },
      data: { favoriteCount: 4, photoCount: 0, verifiedAt: null },
    });
    await t.prisma.report.create({
      data: {
        targetType: ReportTargetType.LISTING,
        listingId: listing.id,
        agencyId: agency.id,
        reason: ReportReason.NOT_EXIST,
      },
    });
    const verified = await createListing(t.prisma, {
      agencyId: co.agency.id,
      listing: { verifiedAt: new Date(), title: '확인된 매물' },
    });
    await t.prisma.listingVerification.create({
      data: {
        listingId: verified.listing.id,
        method: VerificationMethod.OWNER_CALL,
        verifiedAt: new Date(),
        note: '소유자 통화',
      },
    });
    const { session } = await adminActor(t, AdminRole.OPERATOR);

    const list = await as(t, session, 'get', '/admin/listings').expect(200);
    const items = list.body.items as { id: string }[];
    const row = items.find((i) => i.id === listing.id);
    expect(row).toMatchObject({
      complexName: complex.name,
      agencyCount: 2,
      favoriteCount: 4,
      verifiedAt: null,
      exclusiveArea: 84.97,
      floor: 5,
      totalFloors: 15,
      coverUrl: null,
      reviewFlags: ['REPORTED', 'UNVERIFIED'],
    });
    expect(items.find((i) => i.id === verified.listing.id)).toMatchObject({
      agencyCount: 1,
      reviewFlags: [],
      verifiedAt: expect.any(String),
    });

    const review = await as(t, session, 'get', '/admin/listings?needsReview=true').expect(200);
    expect(pluck(review.body.items, 'id')).toEqual([listing.id]);
    const byReports = await as(t, session, 'get', '/admin/listings?sort=REPORTS').expect(200);
    expect(byReports.body.items[0].id).toBe(listing.id);
    await as(t, session, 'get', '/admin/listings?sort=NOPE').expect(400);
    const verifiedDetail = await as(
      t,
      session,
      'get',
      `/admin/listings/${verified.listing.id}`,
    ).expect(200);
    expect(verifiedDetail.body.verifications).toEqual([
      expect.objectContaining({ method: 'OWNER_CALL', note: '소유자 통화', byName: null }),
    ]);

    await as(t, session, 'post', `/admin/listings/${listing.id}/hide`)
      .send({ reason: '사진 도용 확인' })
      .expect(200);
    const detail = await as(t, session, 'get', `/admin/listings/${listing.id}`).expect(200);
    expect(detail.body).toMatchObject({ rooms: 3, baths: 2, options: [], photos: [] });
    expect(pluck(detail.body.agencies, 'contactName')).toEqual([null, '김중개']);
    const actions = (detail.body.history as { action: string }[]).map((h) => h.action);
    expect(actions[0]).toBe('LISTING_HIDDEN');
    expect(actions).toEqual(
      expect.arrayContaining([
        'LISTING_CREATED',
        'LISTING_PUBLISHED',
        'LISTING_CO_BROKER_JOINED',
        'LISTING_REPORTED',
      ]),
    );
    expect(detail.body.history[0]).toMatchObject({
      actorType: 'ADMIN',
      actorName: expect.any(String),
      note: '사진 도용 확인',
    });
  });

  it('hide → unhide (to DRAFT) with counters, notification and audit', async () => {
    const { listing, owner, complex } = await fixture();
    const { admin, session } = await adminActor(t, AdminRole.OPERATOR);
    const hidden = await as(t, session, 'post', `/admin/listings/${listing.id}/hide`)
      .send({ reason: '사진 도용 확인' })
      .expect(200);
    expect(hidden.body).toMatchObject({
      status: ListingStatus.HIDDEN,
      hiddenReason: '사진 도용 확인',
    });
    expect(
      (await t.prisma.complex.findUniqueOrThrow({ where: { id: complex.id } })).activeListingCount,
    ).toBe(0);
    const notes = await t.prisma.notification.findMany({ where: { userId: owner.id } });
    expect(notes.map((n) => n.type)).toEqual([NotificationType.LISTING_HIDDEN]);
    const [audit] = await auditRows(t, 'listing.hide');
    expect(audit).toMatchObject({ adminUserId: admin.id, resourceId: listing.id });
    expect(audit?.before).toMatchObject({ status: ListingStatus.ACTIVE });
    expect(audit?.after).toMatchObject({ status: ListingStatus.HIDDEN });
    await t
      .http()
      .get(api(`/listings/${listing.id}`))
      .expect(404);

    expectCode(
      await as(t, session, 'post', `/admin/listings/${listing.id}/hide`)
        .send({ reason: '다시 숨김' })
        .expect(400),
      ErrorCode.ADMIN_LISTING_INVALID_STATUS,
    );
    const unhidden = await as(t, session, 'post', `/admin/listings/${listing.id}/unhide`).expect(
      200,
    );
    expect(unhidden.body).toMatchObject({ status: ListingStatus.DRAFT, hiddenReason: null });
    await as(t, session, 'post', `/admin/listings/${listing.id}/unhide`).expect(400);
  });

  it('force close', async () => {
    const { listing, complex } = await fixture();
    const { session } = await adminActor(t, AdminRole.OPERATOR);
    const closed = await as(t, session, 'post', `/admin/listings/${listing.id}/close`)
      .send({ reason: '거래 완료 확인' })
      .expect(200);
    expect(closed.body).toMatchObject({
      status: ListingStatus.CLOSED,
      closedAt: expect.any(String),
    });
    expect(
      (await t.prisma.complex.findUniqueOrThrow({ where: { id: complex.id } })).activeListingCount,
    ).toBe(0);
    expect(await auditRows(t, 'listing.force-close')).toHaveLength(1);
    await as(t, session, 'post', `/admin/listings/${listing.id}/close`)
      .send({ reason: '또' })
      .expect(400);
  });

  it('validation failures (400)', async () => {
    const { listing } = await fixture();
    const { session } = await adminActor(t, AdminRole.OPERATOR);
    await as(t, session, 'post', `/admin/listings/${listing.id}/hide`).send({}).expect(400);
    await as(t, session, 'post', `/admin/listings/${listing.id}/close`)
      .send({ reason: '' })
      .expect(400);
    await as(t, session, 'get', '/admin/listings?status=GONE').expect(400);
    await as(t, session, 'post', '/admin/listings/x/unhide').expect(400);
  });

  it('authz', async () => {
    const { listing } = await fixture();
    const body = { reason: '정책 위반' };
    await expectAdminAuthz(t, 'get', '/admin/listings', { userSession });
    await expectAdminAuthz(t, 'get', `/admin/listings/${listing.id}`, { userSession });
    await expectAdminAuthz(t, 'post', `/admin/listings/${listing.id}/hide`, { userSession, body });
    await expectAdminAuthz(t, 'post', `/admin/listings/${listing.id}/unhide`, { userSession });
    await expectAdminAuthz(t, 'post', `/admin/listings/${listing.id}/close`, { userSession, body });
    expect((await t.prisma.listing.findUniqueOrThrow({ where: { id: listing.id } })).status).toBe(
      ListingStatus.ACTIVE,
    );
  });
});
