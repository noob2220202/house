import { AgencyStatus } from '@house/shared';
import {
  createAgency,
  createUser,
  loginUser,
  resetAll,
  withSession,
  type TestApp,
  type TestSession,
} from '../../utils';
import { HomeUserDataService } from '../../../src/modules/home/services/home-user-data.service';
import { createHomeApp, NIL_UUID, seedRegions, YEONHYANG } from './helpers';

describe('home: 관심 중개사무소 + 관심 지역 (e2e)', () => {
  let t: TestApp;
  let session: TestSession;
  let userId: string;

  beforeAll(async () => {
    t = await createHomeApp();
  });
  beforeEach(async () => {
    await resetAll(t);
    const user = await createUser(t.prisma);
    userId = user.id;
    session = await loginUser(t.app, user);
  });
  afterAll(() => t?.close());

  describe('/me/favorites/agencies', () => {
    const url = (id: string) => `/api/v1/me/favorites/agencies/${id}`;

    it('PUT / DELETE are idempotent 204s; GET lists office cards newest first', async () => {
      await seedRegions(t);
      const { agency: a } = await createAgency(t.prisma, {
        emdCode: YEONHYANG,
        activeListingCount: 3,
      });
      const { agency: b } = await createAgency(t.prisma);
      await withSession(t.http().put(url(a.id)), session).expect(204);
      await withSession(t.http().put(url(a.id)), session).expect(204);
      await withSession(t.http().put(url(b.id)), session).expect(204);
      expect(await t.prisma.favoriteAgency.count({ where: { userId } })).toBe(2);

      const res = await withSession(t.http().get('/api/v1/me/favorites/agencies'), session).expect(
        200,
      );
      expect(res.body).toMatchObject({ page: 1, pageSize: 20, total: 2, totalPages: 1 });
      expect((res.body.items as { id: string }[]).map((i) => i.id)).toEqual([b.id, a.id]);
      expect(res.body.items[1]).toEqual({
        id: a.id,
        name: a.name,
        representativeName: a.representativeName,
        registrationNumber: a.registrationNumber,
        phone: a.phone,
        roadAddress: a.roadAddress,
        addressDetail: null,
        emdCode: YEONHYANG,
        emdName: '연향동',
        lat: a.lat,
        lng: a.lng,
        specialties: [],
        logoUrl: null,
        activeListingCount: 3,
        favoritedAt: expect.any(String),
      });

      await withSession(t.http().delete(url(a.id)), session).expect(204);
      await withSession(t.http().delete(url(a.id)), session).expect(204);
      const after = await withSession(
        t.http().get('/api/v1/me/favorites/agencies?pageSize=1'),
        session,
      ).expect(200);
      expect(after.body).toMatchObject({ total: 1, totalPages: 1, items: [{ id: b.id }] });
    });

    it('hides offices that stop being disclosable; refuses unknown / non-approved ones', async () => {
      const { agency } = await createAgency(t.prisma);
      await withSession(t.http().put(url(agency.id)), session).expect(204);
      await t.prisma.agency.update({
        where: { id: agency.id },
        data: { status: AgencyStatus.SUSPENDED },
      });
      const res = await withSession(t.http().get('/api/v1/me/favorites/agencies'), session).expect(
        200,
      );
      expect(res.body).toMatchObject({ items: [], total: 0 });

      const notFound = await withSession(t.http().put(url(agency.id)), session).expect(404);
      expect(notFound.body.code).toBe('AGENCY_NOT_FOUND');
      await withSession(t.http().put(url(NIL_UUID)), session).expect(404);
      await withSession(t.http().put(url('not-a-uuid')), session).expect(400);
    });

    it("401 anonymous, 403 without CSRF, never touches another user's rows", async () => {
      const { agency } = await createAgency(t.prisma);
      await t.http().get('/api/v1/me/favorites/agencies').expect(401);
      await t
        .http()
        .put(url(agency.id))
        .set('Cookie', session.cookie)
        .set('Origin', session.origin)
        .expect(403);
      const other = await createUser(t.prisma);
      await t.prisma.favoriteAgency.create({ data: { userId: other.id, agencyId: agency.id } });
      await withSession(t.http().delete(url(agency.id)), session).expect(204);
      expect(await t.prisma.favoriteAgency.count({ where: { userId: other.id } })).toBe(1);
      const mine = await withSession(t.http().get('/api/v1/me/favorites/agencies'), session).expect(
        200,
      );
      expect(mine.body.total).toBe(0);
    });
  });

  describe('/me/interest-regions', () => {
    const path = '/api/v1/me/interest-regions';

    it('GET defaults to nothing; PUT replaces, dedupes and canonicalizes codes', async () => {
      const empty = await withSession(t.http().get(path), session).expect(200);
      expect(empty.body).toEqual({ regionKeys: [], notify: false });

      const put = await withSession(t.http().put(path), session)
        .send({ regionKeys: ['sindae', 'yeonhyang', 'sindae', '4615031022'], notify: true })
        .expect(200);
      expect(put.body).toEqual({ regionKeys: ['sindae', 'yeonhyang', '1215031022'], notify: true });
      const got = await withSession(t.http().get(path), session).expect(200);
      expect(got.body).toEqual(put.body);

      const cleared = await withSession(t.http().put(path), session)
        .send({ regionKeys: [], notify: false })
        .expect(200);
      expect(cleared.body).toEqual({ regionKeys: [], notify: false });
    });

    it('400 for more than 5 keys, bad keys or a missing flag; 401 anonymous', async () => {
      const tooMany = await withSession(t.http().put(path), session)
        .send({ regionKeys: ['a', 'b', 'c', 'd', 'e', 'f'], notify: false })
        .expect(400);
      expect(tooMany.body.code).toBe('VALIDATION_FAILED');
      await withSession(t.http().put(path), session)
        .send({ regionKeys: ['<script>'], notify: false })
        .expect(400);
      await withSession(t.http().put(path), session)
        .send({ regionKeys: ['x'.repeat(41)], notify: false })
        .expect(400);
      await withSession(t.http().put(path), session).send({ regionKeys: [] }).expect(400);
      await t.http().get(path).expect(401);
    });

    it('HomeUserDataService.purge removes both kinds of rows for withdrawn users', async () => {
      const { agency } = await createAgency(t.prisma);
      await withSession(t.http().put(`/api/v1/me/favorites/agencies/${agency.id}`), session).expect(
        204,
      );
      await withSession(t.http().put(path), session)
        .send({ regionKeys: ['sindae'], notify: true })
        .expect(200);
      await t.app.get(HomeUserDataService).purge([userId]);
      expect(await t.prisma.favoriteAgency.count()).toBe(0);
      expect(await t.prisma.userInterestRegion.count()).toBe(0);
    });
  });
});
