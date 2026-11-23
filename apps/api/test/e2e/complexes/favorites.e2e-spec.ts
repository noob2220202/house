import { ErrorCode } from '@house/shared';
import {
  createComplex,
  createUser,
  loginUser,
  resetAll,
  withSession,
  type TestApp,
  type TestSession,
} from '../../utils';
import { createComplexesApp, FakeTradeApi, NIL_UUID } from './helpers';

describe('complexes: 관심 단지 (e2e)', () => {
  let t: TestApp;
  let session: TestSession;
  let userId: string;

  beforeAll(async () => {
    t = await createComplexesApp(new FakeTradeApi());
  });
  beforeEach(async () => {
    await resetAll(t);
    const user = await createUser(t.prisma);
    userId = user.id;
    session = await loginUser(t.app, user);
  });
  afterAll(() => t?.close());

  const url = (id: string) => `/api/v1/me/favorites/complexes/${id}`;

  describe('PUT/DELETE /me/favorites/complexes/:id', () => {
    it('favorites idempotently and keeps favoriteCount exact', async () => {
      const c = await createComplex(t.prisma);
      const res = await withSession(t.http().put(url(c.id)), session).expect(200);
      expect(res.body).toEqual({ complexId: c.id, favorited: true });
      await withSession(t.http().put(url(c.id)), session).expect(200);
      expect(
        (await t.prisma.complex.findUniqueOrThrow({ where: { id: c.id } })).favoriteCount,
      ).toBe(1);

      await withSession(t.http().delete(url(c.id)), session).expect(204);
      await withSession(t.http().delete(url(c.id)), session).expect(204);
      expect(
        (await t.prisma.complex.findUniqueOrThrow({ where: { id: c.id } })).favoriteCount,
      ).toBe(0);
    });

    it("never touches another user's favorite", async () => {
      const c = await createComplex(t.prisma);
      const other = await createUser(t.prisma);
      await t.prisma.favoriteComplex.create({ data: { userId: other.id, complexId: c.id } });
      await t.prisma.complex.update({ where: { id: c.id }, data: { favoriteCount: 1 } });
      await withSession(t.http().delete(url(c.id)), session).expect(204);
      expect(await t.prisma.favoriteComplex.count({ where: { userId: other.id } })).toBe(1);
      expect(
        (await t.prisma.complex.findUniqueOrThrow({ where: { id: c.id } })).favoriteCount,
      ).toBe(1);
    });

    it('404 for deleted/unknown 단지, 401 anonymous, 400 bad id, 403 without CSRF', async () => {
      const gone = await createComplex(t.prisma, { deletedAt: new Date() });
      const r = await withSession(t.http().put(url(gone.id)), session).expect(404);
      expect(r.body.code).toBe(ErrorCode.COMPLEX_NOT_FOUND);
      await withSession(t.http().put(url(NIL_UUID)), session).expect(404);
      await t.http().put(url(gone.id)).expect(401);
      await t.http().delete(url(gone.id)).expect(401);
      await withSession(t.http().put(url('abc')), session).expect(400);
      await withSession(t.http().delete(url('abc')), session).expect(400);
      await t
        .http()
        .put(url(NIL_UUID))
        .set('Cookie', session.cookie)
        .set('Origin', session.origin)
        .expect(403);
    });
  });

  describe('GET /me/favorites/complexes', () => {
    it("lists only the caller's favorites, newest first, without deleted 단지", async () => {
      const a = await createComplex(t.prisma, { name: '먼저' });
      const b = await createComplex(t.prisma, { name: '나중' });
      const gone = await createComplex(t.prisma, { name: '삭제' });
      await withSession(t.http().put(url(a.id)), session).expect(200);
      await withSession(t.http().put(url(gone.id)), session).expect(200);
      await withSession(t.http().put(url(b.id)), session).expect(200);
      await t.prisma.complex.update({ where: { id: gone.id }, data: { deletedAt: new Date() } });
      const other = await createUser(t.prisma);
      await t.prisma.favoriteComplex.create({ data: { userId: other.id, complexId: a.id } });

      const r = await withSession(t.http().get('/api/v1/me/favorites/complexes'), session).expect(
        200,
      );
      expect(r.body).toMatchObject({ total: 2, page: 1 });
      expect((r.body.items as { complex: { name: string } }[]).map((i) => i.complex.name)).toEqual([
        '나중',
        '먼저',
      ]);
      expect(r.body.items[0].favoritedAt).toEqual(expect.any(String));
      expect(await t.prisma.favoriteComplex.count({ where: { userId } })).toBe(3);
    });

    it('401 anonymous, 400 bad pagination', async () => {
      await t.http().get('/api/v1/me/favorites/complexes').expect(401);
      await withSession(t.http().get('/api/v1/me/favorites/complexes?page=0'), session).expect(400);
    });
  });
});
