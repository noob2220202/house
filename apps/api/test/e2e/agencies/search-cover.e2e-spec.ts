import {
  agencySearchQuerySchema,
  AgencyStatus,
  DealType,
  ErrorCode,
  ListingAgencyStatus,
  ListingStatus,
  MediaPurpose,
  MediaVisibility,
  UserRole,
  WEEKDAYS,
  type BusinessHours,
} from '@house/shared';
import { kstClock } from '../../../src/modules/agencies/agency-search.repository';
import { AgencyPublicService } from '../../../src/modules/agencies/services/agency-public.service';
import {
  createAgency,
  createListing,
  createMedia,
  createTestApp,
  loginUser,
  resetAll,
  withSession,
  type TestApp,
} from '../../utils';
import { pluck } from './helpers';

const WEEKDAY_HOURS = {
  mon: { open: '09:00', close: '18:00' },
  tue: { open: '09:00', close: '18:00' },
  wed: { open: '09:00', close: '18:00' },
  thu: { open: '09:00', close: '18:00' },
  fri: { open: '09:00', close: '18:00' },
  sat: { open: '10:00', close: '15:00' },
} satisfies BusinessHours;
const ALWAYS = Object.fromEntries(
  WEEKDAYS.map((d) => [d, { open: '00:00', close: '24:00' }]),
) satisfies BusinessHours;

describe('agencies: openNow / handlesPresale search and the cover image (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  describe('GET /api/v1/agencies?openNow', () => {
    it('keeps offices open right now (KST); 휴무 today and offices without hours drop out', async () => {
      const today = kstClock(new Date()).day;
      const open = await createAgency(t.prisma, { name: '항상영업부동산', businessHours: ALWAYS });
      const closedToday = await createAgency(t.prisma, {
        name: '오늘휴무부동산',
        businessHours: { ...ALWAYS, [today]: null },
      });
      const noHours = await createAgency(t.prisma, { name: '시간미등록부동산' });

      const all = await t.http().get('/api/v1/agencies?sort=NAME').expect(200);
      expect(all.body.total).toBe(3);
      const res = await t.http().get('/api/v1/agencies?openNow=true').expect(200);
      expect(pluck(res.body.items, 'id')).toEqual([open.agency.id]);
      expect(res.body.items[0].businessHours).toEqual(ALWAYS);
      // false = no filter.
      const off = await t.http().get('/api/v1/agencies?openNow=false').expect(200);
      expect(off.body.total).toBe(3);
      expect(pluck(off.body.items, 'id')).toEqual(
        expect.arrayContaining([closedToday.agency.id, noHours.agency.id]),
      );
      await t.http().get('/api/v1/agencies?openNow=maybe').expect(400);
    });

    it('evaluates open ≤ now < close in Asia/Seoul', async () => {
      const office = await createAgency(t.prisma, { businessHours: WEEKDAY_HOURS });
      const search = t.app.get(AgencyPublicService);
      const q = agencySearchQuerySchema.parse({ openNow: 'true' });
      const found = async (iso: string) =>
        pluck((await search.search(q, new Date(iso))).items, 'id');
      // 2026-11-23 is a Monday. 09:00 KST = 00:00Z.
      expect(await found('2026-11-22T23:59:00Z')).toEqual([]);
      expect(await found('2026-11-23T00:00:00Z')).toEqual([office.agency.id]);
      expect(await found('2026-11-23T08:59:00Z')).toEqual([office.agency.id]);
      expect(await found('2026-11-23T09:00:00Z')).toEqual([]);
      // Saturday 10:00–15:00, Sunday closed.
      expect(await found('2026-11-28T02:00:00Z')).toEqual([office.agency.id]);
      expect(await found('2026-11-29T02:00:00Z')).toEqual([]);
    });
  });

  describe('GET /api/v1/agencies?handlesPresale', () => {
    it('keeps offices advertising a public 분양권 listing (own or co-brokered)', async () => {
      const own = await createAgency(t.prisma, { name: '분양권직접부동산' });
      const co = await createAgency(t.prisma, { name: '분양권공동부동산' });
      const draftOnly = await createAgency(t.prisma, { name: '분양권작성중부동산' });
      const saleOnly = await createAgency(t.prisma, { name: '매매만부동산' });
      const viaSuspended = await createAgency(t.prisma, { name: '정지사무소공동부동산' });
      const suspended = await createAgency(t.prisma, {
        name: '정지된부동산',
        status: AgencyStatus.SUSPENDED,
      });
      const presale = {
        dealType: DealType.PRESALE,
        salePrice: null,
        presalePrice: 30_000,
        premium: 2_000,
        priceSort: 32_000,
      };
      const { listing } = await createListing(t.prisma, {
        agencyId: own.agency.id,
        listing: presale,
      });
      await t.prisma.listingAgency.create({
        data: { listingId: listing.id, agencyId: co.agency.id, status: ListingAgencyStatus.ACTIVE },
      });
      await createListing(t.prisma, {
        agencyId: draftOnly.agency.id,
        listing: { ...presale, status: ListingStatus.DRAFT },
      });
      await createListing(t.prisma, { agencyId: saleOnly.agency.id });
      // Co-brokering a listing whose primary office is suspended: not public, so it does not count.
      const hidden = await createListing(t.prisma, {
        agencyId: suspended.agency.id,
        listing: presale,
      });
      await t.prisma.listingAgency.create({
        data: { listingId: hidden.listing.id, agencyId: viaSuspended.agency.id },
      });

      const res = await t.http().get('/api/v1/agencies?handlesPresale=true&sort=NAME').expect(200);
      expect(pluck(res.body.items, 'id')).toEqual([co.agency.id, own.agency.id]);
      expect(pluck(res.body.items, 'handlesPresale')).toEqual([true, true]);

      const all = await t.http().get('/api/v1/agencies?sort=NAME').expect(200);
      const flags = Object.fromEntries(
        (all.body.items as { id: string; handlesPresale: boolean }[]).map((i) => [
          i.id,
          i.handlesPresale,
        ]),
      );
      expect(flags).toEqual({
        [own.agency.id]: true,
        [co.agency.id]: true,
        [draftOnly.agency.id]: false,
        [saleOnly.agency.id]: false,
        [viaSuspended.agency.id]: false,
      });

      // Combined with openNow.
      await t.prisma.agency.update({
        where: { id: own.agency.id },
        data: { businessHours: ALWAYS },
      });
      const both = await t.http().get('/api/v1/agencies?handlesPresale=1&openNow=1').expect(200);
      expect(pluck(both.body.items, 'id')).toEqual([own.agency.id]);
    });
  });

  describe('cover image (PATCH /agencies/mine coverMediaId)', () => {
    it('sets, shows (mine + public profile) and removes the cover; only own public uploads', async () => {
      const { agency, owner } = await createAgency(t.prisma);
      const s = await loginUser(
        t.app,
        { id: owner.id, role: UserRole.AGENCY_OWNER },
        { agencyId: agency.id },
      );
      const cover = await createMedia(t.prisma, {
        ownerUserId: owner.id,
        purpose: MediaPurpose.AGENCY_COVER,
        storageKey: 'covers/a.webp',
        variants: { large: { key: 'covers/a.large.webp' } },
      });
      const res = await withSession(t.http().patch('/api/v1/agencies/mine'), s)
        .send({ coverMediaId: cover.id })
        .expect(200);
      expect(res.body).toMatchObject({
        coverMediaId: cover.id,
        coverUrl: '/media/covers/a.large.webp',
        logoMediaId: null,
      });
      const pub = await t.http().get(`/api/v1/agencies/${agency.id}`).expect(200);
      expect(pub.body.coverUrl).toBe('/media/covers/a.large.webp');
      const mine = await withSession(t.http().get('/api/v1/agencies/mine'), s).expect(200);
      expect(mine.body.coverUrl).toBe('/media/covers/a.large.webp');

      // A cover uploaded with the logo purpose (older consoles) is accepted too.
      const logoPurpose = await createMedia(t.prisma, {
        ownerUserId: owner.id,
        purpose: MediaPurpose.AGENCY_LOGO,
        storageKey: 'logos/as-cover.webp',
      });
      await withSession(t.http().patch('/api/v1/agencies/mine'), s)
        .send({ coverMediaId: logoPurpose.id })
        .expect(200);
      // The replaced cover restarts its orphan grace period.
      const replaced = await t.prisma.media.findUniqueOrThrow({ where: { id: cover.id } });
      expect(replaced.updatedAt.getTime()).toBeGreaterThan(cover.updatedAt.getTime());

      const foreign = await createMedia(t.prisma, { purpose: MediaPurpose.AGENCY_COVER });
      const document = await createMedia(t.prisma, {
        ownerUserId: owner.id,
        purpose: MediaPurpose.AGENCY_DOCUMENT,
        visibility: MediaVisibility.PRIVATE,
      });
      for (const id of [foreign.id, document.id]) {
        const bad = await withSession(t.http().patch('/api/v1/agencies/mine'), s)
          .send({ coverMediaId: id })
          .expect(400);
        expect(bad.body.code).toBe(ErrorCode.AGENCY_COVER_INVALID);
      }
      await withSession(t.http().patch('/api/v1/agencies/mine'), s)
        .send({ coverMediaId: 'cover.png' })
        .expect(400);

      const removed = await withSession(t.http().patch('/api/v1/agencies/mine'), s)
        .send({ coverMediaId: null })
        .expect(200);
      expect(removed.body).toMatchObject({ coverMediaId: null, coverUrl: null });
      const after = await t.http().get(`/api/v1/agencies/${agency.id}`).expect(200);
      expect(after.body.coverUrl).toBeNull();
    });

    it('a deleted cover file has no URL', async () => {
      const { agency, owner } = await createAgency(t.prisma);
      const cover = await createMedia(t.prisma, {
        ownerUserId: owner.id,
        purpose: MediaPurpose.AGENCY_COVER,
        storageKey: 'covers/b.webp',
      });
      await t.prisma.agency.update({ where: { id: agency.id }, data: { coverMediaId: cover.id } });
      const pub = await t.http().get(`/api/v1/agencies/${agency.id}`).expect(200);
      expect(pub.body.coverUrl).toBe('/media/covers/b.webp');

      await t.prisma.media.update({ where: { id: cover.id }, data: { deletedAt: new Date() } });
      const ownerSession = await loginUser(
        t.app,
        { id: owner.id, role: UserRole.AGENCY_OWNER },
        { agencyId: agency.id },
      );
      const mine = await withSession(t.http().get('/api/v1/agencies/mine'), ownerSession).expect(
        200,
      );
      expect(mine.body).toMatchObject({ coverMediaId: cover.id, coverUrl: null });
    });
  });
});
