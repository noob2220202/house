import { ErrorCode, ListingStatus } from '@house/shared';
import { RecentViewsService } from '../../../src/modules/listings/services/recent-views.service';
import {
  createComplex,
  createTestApp,
  createUser,
  loginUser,
  resetAll,
  withSession,
  type TestApp,
  type TestSession,
} from '../../utils';
import { agencyWithOwner, NIL_UUID, seedListing } from './helpers';

describe('me: favorites + recent views (e2e)', () => {
  let t: TestApp;
  let session: TestSession;
  let userId: string;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetAll(t);
    const user = await createUser(t.prisma);
    userId = user.id;
    session = await loginUser(t.app, user);
  });
  afterAll(() => t?.close());

  describe('PUT/DELETE /me/favorites/listings/:id', () => {
    it('favorites idempotently and keeps favoriteCount exact', async () => {
      const { agency } = await agencyWithOwner(t);
      const { listing } = await seedListing(t, agency.id);
      const url = `/api/v1/me/favorites/listings/${listing.id}`;
      const res = await withSession(t.http().put(url), session).expect(200);
      expect(res.body).toEqual({ listingId: listing.id, favorited: true });
      await withSession(t.http().put(url), session).expect(200);
      let row = await t.prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
      expect(row.favoriteCount).toBe(1);

      const detail = await withSession(
        t.http().get(`/api/v1/listings/${listing.id}`),
        session,
      ).expect(200);
      expect(detail.body.isFavorite).toBe(true);

      await withSession(t.http().delete(url), session).expect(204);
      await withSession(t.http().delete(url), session).expect(204);
      row = await t.prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
      expect(row.favoriteCount).toBe(0);
    });

    it('404 for non-public listings, 401 anonymous, 400 bad id, 403 without CSRF token', async () => {
      const { agency } = await agencyWithOwner(t);
      const { listing } = await seedListing(t, agency.id, {
        listing: { status: ListingStatus.DRAFT },
      });
      const r = await withSession(
        t.http().put(`/api/v1/me/favorites/listings/${listing.id}`),
        session,
      ).expect(404);
      expect(r.body.code).toBe(ErrorCode.LISTING_NOT_FOUND);
      await t.http().put(`/api/v1/me/favorites/listings/${listing.id}`).expect(401);
      await t.http().delete(`/api/v1/me/favorites/listings/${listing.id}`).expect(401);
      await withSession(t.http().put('/api/v1/me/favorites/listings/abc'), session).expect(400);
      await withSession(t.http().delete('/api/v1/me/favorites/listings/abc'), session).expect(400);
      await t
        .http()
        .put(`/api/v1/me/favorites/listings/${NIL_UUID}`)
        .set('Cookie', session.cookie)
        .set('Origin', session.origin)
        .expect(403);
    });
  });

  describe('GET /me/favorites/listings', () => {
    it("lists the user's favorites (newest first), keeps closed ones, drops hidden", async () => {
      const { agency } = await agencyWithOwner(t);
      const a = await seedListing(t, agency.id);
      const b = await seedListing(t, agency.id);
      const c = await seedListing(t, agency.id);
      for (const l of [a, b, c]) {
        await withSession(
          t.http().put(`/api/v1/me/favorites/listings/${l.listing.id}`),
          session,
        ).expect(200);
      }
      await t.prisma.listing.update({ where: { id: a.listing.id }, data: { status: 'CLOSED' } });
      await t.prisma.listing.update({ where: { id: b.listing.id }, data: { status: 'HIDDEN' } });

      // Someone else's favorites never show up.
      const other = await createUser(t.prisma);
      const os = await loginUser(t.app, other);
      await withSession(t.http().put(`/api/v1/me/favorites/listings/${c.listing.id}`), os).expect(
        200,
      );

      const res = await withSession(t.http().get('/api/v1/me/favorites/listings'), session).expect(
        200,
      );
      expect(res.body.total).toBe(2);
      expect((res.body.items as { listing: { id: string } }[]).map((i) => i.listing.id)).toEqual([
        c.listing.id,
        a.listing.id,
      ]);
      expect(res.body.items[1].listing.status).toBe('CLOSED');
    });

    it('401 anonymous, 400 invalid pagination', async () => {
      await t.http().get('/api/v1/me/favorites/listings').expect(401);
      await withSession(t.http().get('/api/v1/me/favorites/listings?page=0'), session).expect(400);
    });
  });

  describe('GET/DELETE /me/recent-views', () => {
    it('lists recently viewed listings (latest first) and other target types', async () => {
      const { agency } = await agencyWithOwner(t);
      const a = await seedListing(t, agency.id);
      const b = await seedListing(t, agency.id);
      await withSession(t.http().get(`/api/v1/listings/${a.listing.id}`), session).expect(200);
      await withSession(t.http().get(`/api/v1/listings/${b.listing.id}`), session).expect(200);
      await withSession(t.http().get(`/api/v1/listings/${a.listing.id}`), session).expect(200);

      const res = await withSession(t.http().get('/api/v1/me/recent-views'), session).expect(200);
      expect(res.body.total).toBe(2);
      expect((res.body.items as { targetId: string }[]).map((i) => i.targetId)).toEqual([
        a.listing.id,
        b.listing.id,
      ]);
      expect(res.body.items[0].listing).toMatchObject({ id: a.listing.id, dealType: 'SALE' });

      const complex = await createComplex(t.prisma);
      await t.app.get(RecentViewsService).record(userId, 'COMPLEX', complex.id);
      const cx = await withSession(
        t.http().get('/api/v1/me/recent-views?targetType=COMPLEX'),
        session,
      ).expect(200);
      expect(cx.body.items).toEqual([
        expect.objectContaining({
          targetId: complex.id,
          complex: expect.objectContaining({ name: complex.name }),
        }),
      ]);

      await withSession(
        t.http().delete('/api/v1/me/recent-views?targetType=LISTING'),
        session,
      ).expect(204);
      const after = await withSession(t.http().get('/api/v1/me/recent-views'), session).expect(200);
      expect(after.body.total).toBe(0);
      const left = await t.prisma.recentView.count({ where: { userId } });
      expect(left).toBe(1);
    });

    it('caps history per user and type', async () => {
      const recent = t.app.get(RecentViewsService);
      const { agency } = await agencyWithOwner(t);
      const { listing } = await seedListing(t, agency.id);
      await t.prisma.recentView.createMany({
        data: Array.from({ length: 100 }, (_, i) => ({
          userId,
          targetType: 'LISTING' as const,
          targetId: `00000000-0000-7000-8000-${String(i).padStart(12, '0')}`,
          viewedAt: new Date(Date.UTC(2026, 0, 1, 0, i)),
        })),
      });
      await recent.record(userId, 'LISTING', listing.id);
      const rows = await t.prisma.recentView.findMany({
        where: { userId },
        orderBy: { viewedAt: 'asc' },
      });
      expect(rows).toHaveLength(100);
      expect(rows.some((r) => r.targetId.endsWith('000000000000'))).toBe(false);
      expect(rows[rows.length - 1]?.targetId).toBe(listing.id);
    });

    it('401 anonymous, 400 invalid target type', async () => {
      await t.http().get('/api/v1/me/recent-views').expect(401);
      await t.http().delete('/api/v1/me/recent-views').expect(401);
      await withSession(t.http().get('/api/v1/me/recent-views?targetType=USER'), session).expect(
        400,
      );
      await withSession(t.http().delete('/api/v1/me/recent-views?targetType=USER'), session).expect(
        400,
      );
    });
  });
});
