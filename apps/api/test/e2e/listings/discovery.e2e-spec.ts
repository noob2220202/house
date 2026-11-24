import {
  AgencyStatus,
  AssetType,
  DealType,
  ErrorCode,
  FloorDisplay,
  ListingStatus,
  RecentViewTarget,
  TermsType,
  kstDayKey,
} from '@house/shared';
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
import {
  addCoBroker,
  agencyWithOwner,
  agentOf,
  EMD_CODE,
  NIL_UUID,
  OTHER_EMD_CODE,
  seedListing,
} from './helpers';

const DAY_MS = 24 * 60 * 60 * 1000;
const UA = 'Mozilla/5.0 (Macintosh) e2e';

describe('listings: similar, view beacon, broker console (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  describe('GET /listings/:id/similar', () => {
    it('groups 같은 단지 / 같은 지역 같은 평형 / 같은 가격대 with totals and criteria', async () => {
      const a = await agencyWithOwner(t);
      const complex = await createComplex(t.prisma);
      const other = await createComplex(t.prisma);
      const base = await seedListing(t, a.agency.id, {
        property: { complexId: complex.id, supplyArea: '112.40' },
        listing: { complexId: complex.id, salePrice: 30_000, priceSort: 30_000 },
      });
      // Same complex (any deal type).
      const sameComplex = await seedListing(t, a.agency.id, {
        property: { complexId: complex.id },
        listing: {
          complexId: complex.id,
          dealType: DealType.JEONSE,
          salePrice: null,
          deposit: 20_000,
          priceSort: 20_000,
        },
      });
      // Same region + area (other complex), but far cheaper → not 같은 가격대.
      const sameArea = await seedListing(t, a.agency.id, {
        property: { complexId: other.id, exclusiveArea: '80.00' },
        listing: {
          complexId: other.id,
          exclusiveArea: '80.00',
          salePrice: 10_000,
          priceSort: 10_000,
        },
      });
      // Other region, same price band.
      const samePrice = await seedListing(t, a.agency.id, {
        property: { emdCode: OTHER_EMD_CODE, exclusiveArea: '150.00' },
        listing: {
          emdCode: OTHER_EMD_CODE,
          exclusiveArea: '150.00',
          salePrice: 33_000,
          priceSort: 33_000,
        },
      });
      // Never similar: other asset type, a draft, a suspended office's ad.
      await seedListing(t, a.agency.id, {
        property: { assetType: AssetType.OFFICETEL },
        listing: { assetType: AssetType.OFFICETEL },
      });
      await seedListing(t, a.agency.id, { listing: { status: ListingStatus.DRAFT } });
      const suspended = await agencyWithOwner(t, { status: AgencyStatus.SUSPENDED });
      await seedListing(t, suspended.agency.id);

      const res = await t.http().get(`/api/v1/listings/${base.listing.id}/similar`).expect(200);
      expect(res.body).toMatchObject({
        criteria: '매매 · 34평 · 2.4억~3.6억',
        regionName: null,
        regionListingCount: 4,
      });
      const groups = res.body.groups as {
        key: string;
        label: string;
        total: number;
        items: { id: string }[];
      }[];
      expect(groups.map((g) => [g.key, g.label, g.total, g.items.map((i) => i.id)])).toEqual([
        ['SAME_COMPLEX', '같은 단지', 1, [sameComplex.listing.id]],
        ['SAME_AREA', '같은 평형', 1, [sameArea.listing.id]],
        ['SAME_PRICE', '같은 가격대', 1, [samePrice.listing.id]],
      ]);
      // Cards are the shared public summary (never 호).
      expect(groups[0]?.items[0]).toMatchObject({ id: sameComplex.listing.id, dealType: 'JEONSE' });
      expect(JSON.stringify(res.body)).not.toContain('"ho"');
    });

    it('drops empty groups; 404 for hidden / unknown listings', async () => {
      const a = await agencyWithOwner(t);
      const lone = await seedListing(t, a.agency.id);
      const res = await t.http().get(`/api/v1/listings/${lone.listing.id}/similar`).expect(200);
      expect(res.body.groups).toEqual([]);
      const draft = await seedListing(t, a.agency.id, { listing: { status: ListingStatus.DRAFT } });
      await t.http().get(`/api/v1/listings/${draft.listing.id}/similar`).expect(404);
      await t.http().get(`/api/v1/listings/${NIL_UUID}/similar`).expect(404);
    });
  });

  describe('POST /listings/:id/view', () => {
    it('counts once per viewer (shared with the detail read) and records the recent view', async () => {
      const a = await agencyWithOwner(t);
      const { listing } = await seedListing(t, a.agency.id);
      const user = await createUser(t.prisma);
      const s = await loginUser(t.app, user);

      await withSession(t.http().get(`/api/v1/listings/${listing.id}`), s)
        .set('User-Agent', UA)
        .expect(200);
      const res = await withSession(t.http().post(`/api/v1/listings/${listing.id}/view`), s)
        .set('User-Agent', UA)
        .expect(204);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(await t.redis.hget('listings:views:totals', listing.id)).toBe('1');
      expect(
        await t.prisma.recentView.count({
          where: { userId: user.id, targetType: RecentViewTarget.LISTING, targetId: listing.id },
        }),
      ).toBe(1);

      // Anonymous visitors are deduped by address + agent; the region ZSET gets one per counted view.
      for (let i = 0; i < 2; i++) {
        await t
          .http()
          .post(`/api/v1/listings/${listing.id}/view`)
          .set('X-Forwarded-For', '198.51.100.20')
          .set('User-Agent', UA)
          .expect(204);
      }
      expect(await t.redis.hget('listings:views:totals', listing.id)).toBe('2');
      const day = `listings:views:region-daily:${kstDayKey(new Date())}`;
      expect(await t.redis.zscore(day, `APT|${EMD_CODE.slice(0, 8)}`)).toBe('2');
    });

    it('the Next.js SSR read (loopback + x-house-ssr: 1) counts nothing; the beacon counts', async () => {
      const a = await agencyWithOwner(t);
      const { listing } = await seedListing(t, a.agency.id, { listing: { viewCount: 7 } });
      const user = await createUser(t.prisma);
      const s = await loginUser(t.app, user);

      // SSR forwarding the visitor (session cookie + X-Forwarded-For) and a cached SSR read.
      const forwarded = await withSession(t.http().get(`/api/v1/listings/${listing.id}`), s)
        .set('x-house-ssr', '1')
        .set('X-Forwarded-For', '198.51.100.30')
        .set('User-Agent', UA)
        .expect(200);
      expect(forwarded.body.viewCount).toBe(7);
      await t.http().get(`/api/v1/listings/${listing.id}`).set('x-house-ssr', '1').expect(200);
      expect(await t.redis.hget('listings:views:totals', listing.id)).toBeNull();
      expect(await t.redis.zcard(`listings:views:region-daily:${kstDayKey(new Date())}`)).toBe(0);
      expect(
        await t.prisma.recentView.count({ where: { userId: user.id, targetId: listing.id } }),
      ).toBe(0);

      // The browser beacon counts the view and records the recent view …
      await withSession(t.http().post(`/api/v1/listings/${listing.id}/view`), s)
        .set('X-Forwarded-For', '198.51.100.30')
        .set('User-Agent', UA)
        .expect(204);
      expect(await t.redis.hget('listings:views:totals', listing.id)).toBe('8');
      expect(
        await t.prisma.recentView.count({ where: { userId: user.id, targetId: listing.id } }),
      ).toBe(1);
      // … and the next SSR read shows the new total without counting again.
      const again = await withSession(t.http().get(`/api/v1/listings/${listing.id}`), s)
        .set('x-house-ssr', '1')
        .expect(200);
      expect(again.body.viewCount).toBe(8);
      expect(await t.redis.hget('listings:views:totals', listing.id)).toBe('8');
    });

    it('bots count on the listing but not in the region ranking; 404 for non-public', async () => {
      const a = await agencyWithOwner(t);
      const { listing } = await seedListing(t, a.agency.id);
      await t
        .http()
        .post(`/api/v1/listings/${listing.id}/view`)
        .set('User-Agent', 'Googlebot/2.1 (+http://www.google.com/bot.html)')
        .expect(204);
      expect(await t.redis.zcard(`listings:views:region-daily:${kstDayKey(new Date())}`)).toBe(0);
      const draft = await seedListing(t, a.agency.id, { listing: { status: ListingStatus.DRAFT } });
      await t.http().post(`/api/v1/listings/${draft.listing.id}/view`).expect(404);
      await t.http().post('/api/v1/listings/not-a-uuid/view').expect(400);
    });

    it('still counts for a member whose required terms are pending (@SkipTermsCheck)', async () => {
      const a = await agencyWithOwner(t);
      const { listing } = await seedListing(t, a.agency.id);
      const past = new Date(Date.now() - DAY_MS);
      await t.prisma.termsDocument.create({
        data: {
          type: TermsType.SERVICE,
          version: '9.0',
          title: '이용약관',
          content: '본문',
          isRequired: true,
          effectiveAt: past,
          publishedAt: past,
        },
      });
      const user = await createUser(t.prisma);
      const s = await loginUser(t.app, user);
      // The guard is active for this member: a real write is refused …
      const blocked = await withSession(
        t.http().put(`/api/v1/me/favorites/listings/${listing.id}`),
        s,
      ).expect(403);
      expect(blocked.body.code).toBe(ErrorCode.AUTH_TERMS_REQUIRED);
      // … but the view beacon counts and records the recent view.
      await withSession(t.http().post(`/api/v1/listings/${listing.id}/view`), s)
        .set('User-Agent', UA)
        .expect(204);
      expect(await t.redis.hget('listings:views:totals', listing.id)).toBe('1');
      expect(
        await t.prisma.recentView.count({
          where: { userId: user.id, targetType: RecentViewTarget.LISTING, targetId: listing.id },
        }),
      ).toBe(1);
    });
  });

  describe('GET /agency/listings/summary', () => {
    it('counts the agency’s listings by status plus reminder and co-brokerage counters', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const now = Date.now();
      await seedListing(t, a.agency.id, {
        listing: { verifiedAt: new Date(now - 2 * DAY_MS), expiresAt: new Date(now + 28 * DAY_MS) },
      });
      // Verified 25 days ago → re-verification due; ad ends in 3 days → expiring soon.
      await seedListing(t, a.agency.id, {
        listing: { verifiedAt: new Date(now - 25 * DAY_MS), expiresAt: new Date(now + 3 * DAY_MS) },
      });
      // Never verified, RESERVED → due.
      await seedListing(t, a.agency.id, { listing: { status: ListingStatus.RESERVED } });
      await seedListing(t, a.agency.id, { listing: { status: ListingStatus.DRAFT } });
      await seedListing(t, a.agency.id, { listing: { status: ListingStatus.CLOSED } });
      await seedListing(t, a.agency.id, { listing: { deletedAt: new Date() } });
      // b's listing that a co-brokers (counts for a), and one a has no part in.
      const shared = await seedListing(t, b.agency.id, { listing: { verifiedAt: new Date() } });
      await addCoBroker(t, shared.listing.id, b, a);
      await seedListing(t, b.agency.id);

      const res = await withSession(
        t.http().get('/api/v1/agency/listings/summary'),
        a.ownerSession,
      ).expect(200);
      expect(res.body).toEqual({
        total: 6,
        byStatus: { DRAFT: 1, ACTIVE: 3, RESERVED: 1, CLOSED: 1, HIDDEN: 0 },
        verificationDue: 2,
        expiringSoon: 1,
        coBrokered: 1,
      });

      const agent = await agentOf(t, a.agency.id);
      await withSession(t.http().get('/api/v1/agency/listings/summary'), agent.session).expect(200);
      const plain = await loginUser(t.app, await createUser(t.prisma));
      await withSession(t.http().get('/api/v1/agency/listings/summary'), plain).expect(403);
      await t.http().get('/api/v1/agency/listings/summary').expect(401);
    });
  });

  describe('GET /agency/listings/co-broker-candidates', () => {
    it("lists other offices' public listings in a 단지 with joined flags, hiding exact floors", async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t, { name: '연향공인중개사사무소' });
      const complex = await createComplex(t.prisma, { name: '연향파크' });
      const media = await createMedia(t.prisma);
      const inComplex = (opts: Parameters<typeof seedListing>[2] = {}) =>
        seedListing(t, b.agency.id, {
          ...opts,
          property: { complexId: complex.id, ...opts.property },
          listing: { complexId: complex.id, ...opts.listing },
        });
      const exact = await inComplex({
        property: { dong: '101동', floor: 7, totalFloors: 20 },
        listing: { verifiedAt: new Date() },
      });
      await t.prisma.listingPhoto.create({
        data: { listingId: exact.listing.id, mediaId: media.id, isCover: true },
      });
      const classOnly = await inComplex({
        property: { dong: '102', floor: 15, totalFloors: 20 },
        listing: { floorDisplay: FloorDisplay.CLASS, floorClass: 'HIGH' },
      });
      await addCoBroker(t, classOnly.listing.id, b, a);
      // Excluded: a's own listing, a draft, another complex.
      await seedListing(t, a.agency.id, {
        property: { complexId: complex.id },
        listing: { complexId: complex.id },
      });
      await inComplex({ listing: { status: ListingStatus.DRAFT } });
      await seedListing(t, b.agency.id);

      const res = await withSession(
        t
          .http()
          .get('/api/v1/agency/listings/co-broker-candidates')
          .query({ complexId: complex.id }),
        a.ownerSession,
      ).expect(200);
      expect(res.body).toMatchObject({ page: 1, pageSize: 20, total: 2, totalPages: 1 });
      expect(res.body.items).toEqual([
        {
          id: exact.listing.id,
          listingNo: String(exact.listing.listingNo),
          status: 'ACTIVE',
          dealType: 'SALE',
          assetType: 'APT',
          name: '연향파크',
          dong: '101동',
          salePrice: 30_000,
          deposit: null,
          monthlyRent: null,
          presalePrice: null,
          premium: null,
          exclusiveArea: 84.97,
          supplyArea: null,
          floor: 7,
          totalFloors: 20,
          floorClass: null,
          direction: null,
          coverPhotoUrl: expect.stringContaining(media.storageKey.replace(/\.webp$/, '')),
          verifiedAt: expect.any(String),
          publishedAt: expect.any(String),
          agencyCount: 1,
          primaryAgencyName: '연향공인중개사사무소',
          joined: false,
        },
        expect.objectContaining({
          id: classOnly.listing.id,
          dong: '102',
          floor: null,
          floorClass: 'HIGH',
          agencyCount: 2,
          joined: true,
        }),
      ]);
      expect(JSON.stringify(res.body)).not.toContain('"ho"');

      const byDong = await withSession(
        t
          .http()
          .get('/api/v1/agency/listings/co-broker-candidates')
          .query({ complexId: complex.id, dong: '101' }),
        a.ownerSession,
      ).expect(200);
      expect((byDong.body.items as { id: string }[]).map((i) => i.id)).toEqual([exact.listing.id]);
      // 매물번호 finds the listing exactly.
      const byNo = await withSession(
        t
          .http()
          .get('/api/v1/agency/listings/co-broker-candidates')
          .query({ complexId: complex.id, q: `매물번호 ${classOnly.listing.listingNo}` }),
        a.ownerSession,
      ).expect(200);
      expect((byNo.body.items as { id: string }[]).map((i) => i.id)).toEqual([
        classOnly.listing.id,
      ]);
      const byQ = await withSession(
        t
          .http()
          .get('/api/v1/agency/listings/co-broker-candidates')
          .query({ complexId: complex.id, q: '102' }),
        a.ownerSession,
      ).expect(200);
      expect((byQ.body.items as { id: string }[]).map((i) => i.id)).toEqual([classOnly.listing.id]);
    });

    it('400 without a 단지, empty for an unknown one, 403 for non-members', async () => {
      const a = await agencyWithOwner(t);
      const bad = await withSession(
        t.http().get('/api/v1/agency/listings/co-broker-candidates'),
        a.ownerSession,
      ).expect(400);
      expect(bad.body.details[0]).toMatchObject({
        path: 'complexId',
        message: '단지를 선택해 주세요.',
      });
      const empty = await withSession(
        t.http().get('/api/v1/agency/listings/co-broker-candidates').query({ complexId: NIL_UUID }),
        a.ownerSession,
      ).expect(200);
      expect(empty.body).toMatchObject({ items: [], total: 0 });
      const plain = await loginUser(t.app, await createUser(t.prisma));
      await withSession(
        t.http().get('/api/v1/agency/listings/co-broker-candidates').query({ complexId: NIL_UUID }),
        plain,
      ).expect(403);
    });
  });
});
