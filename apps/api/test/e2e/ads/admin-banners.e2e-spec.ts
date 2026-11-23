import { AdminRole, BannerSlot, MediaPurpose, UserRole } from '@house/shared';
import {
  createAgency,
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
  adminSession,
  bannerMedia,
  createRegion,
  inHours,
  isoIn,
  pluck,
  seedBanner,
} from './helpers';

const BASE = '/api/v1/admin/banners';

describe('ads: admin banners (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  async function validBody(extra: Record<string, unknown> = {}) {
    const pc = await bannerMedia(t.prisma);
    return {
      slot: BannerSlot.MAIN_HERO,
      title: '순천 신축 분양',
      pcMediaId: pc.id,
      linkUrl: 'https://ad.example.com/landing',
      startAt: isoIn(-1),
      endAt: isoIn(48),
      ...extra,
    };
  }

  it('runs against its own database and Redis index', async () => {
    expect(process.env.DATABASE_URL).toContain('/house_test_ads?');
    expect(t.redis.options.db).toBe(6);
  });

  describe('POST /admin/banners', () => {
    it('201 creates a banner with targeting, image refs and an audit row', async () => {
      const s = await adminSession(t);
      const { agency } = await createAgency(t.prisma);
      const mobile = await bannerMedia(t.prisma);
      await createRegion(t.prisma, '46150101', '삼거동');
      const res = await withSession(t.http().post(BASE), s)
        .send(
          await validBody({
            advertiserName: '  순천부동산  ',
            agencyId: agency.id,
            mobileMediaId: mobile.id,
            targeting: 'REGIONS',
            targetRegionCodes: ['46150101'],
            priority: 5,
          }),
        )
        .expect(201);
      expect(res.body).toMatchObject({
        slot: 'MAIN_HERO',
        title: '순천 신축 분양',
        advertiserName: '순천부동산',
        agency: { id: agency.id, name: agency.name },
        status: 'ACTIVE',
        targeting: 'REGIONS',
        targetRegionCodes: ['46150101'],
        priority: 5,
        sortOrder: 0,
        createdByAdminId: s.adminId,
      });
      expect(res.body.pcImage.url).toMatch(/^\/media\/test\/.+\.webp$/);
      expect(res.body.mobileImage.id).toBe(mobile.id);

      const audit = await t.prisma.auditLog.findFirst({ where: { action: 'banner.create' } });
      expect(audit).toMatchObject({ resourceType: 'Banner', resourceId: res.body.id });
    });

    it('appends new banners to the end of the slot order and computes SCHEDULED', async () => {
      const s = await adminSession(t);
      await withSession(t.http().post(BASE), s)
        .send(await validBody())
        .expect(201);
      const res = await withSession(t.http().post(BASE), s)
        .send(await validBody({ startAt: isoIn(5), endAt: isoIn(10) }))
        .expect(201);
      expect(res.body).toMatchObject({ sortOrder: 1, status: 'SCHEDULED' });
    });

    it('401 without a session, with a user session, and without TOTP', async () => {
      const body = await validBody();
      await t.http().post(BASE).set('Origin', 'http://localhost:3001').send(body).expect(401);
      const user = await createUser(t.prisma, { role: UserRole.USER });
      const us = await loginUser(t.app, { id: user.id });
      await withSession(t.http().post(BASE), us).send(body).expect(401);
      const noMfa = await adminSession(t, AdminRole.ADMIN, { mfaVerified: false });
      const res = await withSession(t.http().post(BASE), noMfa).send(body).expect(401);
      expect(res.body.code).toBe('AUTH_TOTP_REQUIRED');
    });

    it('403 without the CSRF token', async () => {
      const s = await adminSession(t);
      await t
        .http()
        .post(BASE)
        .set('Cookie', s.cookie)
        .set('Origin', s.origin)
        .send(await validBody())
        .expect(403);
    });

    it('400 on schema violations (http link, inverted window, inconsistent targeting)', async () => {
      const s = await adminSession(t);
      const res = await withSession(t.http().post(BASE), s)
        .send(
          await validBody({
            linkUrl: 'http://insecure.example.com',
            startAt: isoIn(10),
            endAt: isoIn(1),
            targeting: 'COMPLEXES',
          }),
        )
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      const paths = (res.body.details as { path: string }[]).map((d) => d.path);
      expect(paths).toEqual(expect.arrayContaining(['linkUrl', 'endAt', 'targetComplexIds']));
      await withSession(t.http().post(BASE), s)
        .send(await validBody({ linkUrl: 'javascript:alert(1)' }))
        .expect(400);
    });

    it('400 on unusable references (media purpose, unknown region/complex/agency)', async () => {
      const s = await adminSession(t);
      const listingPhoto = await createMedia(t.prisma, { purpose: MediaPurpose.LISTING_PHOTO });
      let res = await withSession(t.http().post(BASE), s)
        .send(await validBody({ pcMediaId: listingPhoto.id }))
        .expect(400);
      expect(res.body.code).toBe('BANNER_MEDIA_INVALID');

      const pending = await createMedia(t.prisma, {
        purpose: MediaPurpose.BANNER,
        status: 'PENDING',
      });
      res = await withSession(t.http().post(BASE), s)
        .send(await validBody({ mobileMediaId: pending.id }))
        .expect(400);
      expect(res.body.code).toBe('BANNER_MEDIA_INVALID');

      res = await withSession(t.http().post(BASE), s)
        .send(await validBody({ targeting: 'REGIONS', targetRegionCodes: ['46150999'] }))
        .expect(400);
      expect(res.body).toMatchObject({
        code: 'BANNER_TARGET_INVALID',
        details: { missingRegionCodes: ['46150999'] },
      });

      res = await withSession(t.http().post(BASE), s)
        .send(
          await validBody({
            targeting: 'COMPLEXES',
            targetComplexIds: ['01937a2b-0000-7000-8000-00000000abcd'],
          }),
        )
        .expect(400);
      expect(res.body.code).toBe('BANNER_TARGET_INVALID');

      res = await withSession(t.http().post(BASE), s)
        .send(await validBody({ agencyId: '01937a2b-0000-7000-8000-00000000abcd' }))
        .expect(400);
      expect(res.body.code).toBe('BANNER_AGENCY_INVALID');
    });

    it('409 BANNER_SLOT_FULL when the simultaneous limit would be exceeded', async () => {
      const s = await adminSession(t);
      await t.prisma.bannerSlotConfig.create({ data: { slot: 'MAP_AD', maxActive: 1 } });
      await withSession(t.http().post(BASE), s)
        .send(await validBody({ slot: 'MAP_AD', startAt: isoIn(-1), endAt: isoIn(10) }))
        .expect(201);
      const res = await withSession(t.http().post(BASE), s)
        .send(await validBody({ slot: 'MAP_AD', startAt: isoIn(5), endAt: isoIn(20) }))
        .expect(409);
      expect(res.body).toMatchObject({
        code: 'BANNER_SLOT_FULL',
        details: { slot: 'MAP_AD', maxActive: 1, concurrent: 2 },
      });
      // Back-to-back windows and paused banners do not count.
      await withSession(t.http().post(BASE), s)
        .send(await validBody({ slot: 'MAP_AD', startAt: isoIn(10), endAt: isoIn(20) }))
        .expect(201);
      await withSession(t.http().post(BASE), s)
        .send(await validBody({ slot: 'MAP_AD', paused: true }))
        .expect(201);
    });
  });

  describe('GET /admin/banners', () => {
    it('200 lists with slot/status/q filters and pagination', async () => {
      const s = await adminSession(t);
      await seedBanner(t.prisma, { title: '진행중 A', sortOrder: 1 });
      await seedBanner(t.prisma, { title: '진행중 B', sortOrder: 0 });
      await seedBanner(t.prisma, { title: '예정', startAt: inHours(2), endAt: inHours(5) });
      await seedBanner(t.prisma, { title: '종료', startAt: inHours(-5), endAt: inHours(-1) });
      await seedBanner(t.prisma, { title: '일시중지', paused: true });
      await seedBanner(t.prisma, { title: '삭제됨', deletedAt: new Date() });
      await seedBanner(t.prisma, { title: '지도', slot: 'MAP_AD' });

      let res = await withSession(t.http().get(`${BASE}?slot=MAIN_HERO&status=ACTIVE`), s).expect(
        200,
      );
      expect(pluck(res, 'title')).toEqual(['진행중 B', '진행중 A']);

      res = await withSession(t.http().get(`${BASE}?status=ENDED`), s).expect(200);
      expect(pluck(res, 'status')).toEqual(['ENDED']);

      res = await withSession(t.http().get(`${BASE}?q=${encodeURIComponent('일시')}`), s).expect(
        200,
      );
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].status).toBe('PAUSED');

      res = await withSession(t.http().get(`${BASE}?pageSize=2&page=2`), s).expect(200);
      expect(res.body).toMatchObject({ page: 2, pageSize: 2, total: 6, totalPages: 3 });
    });

    it('401 without an admin session', async () => {
      await t.http().get(BASE).expect(401);
    });

    it('400 on an invalid filter', async () => {
      const s = await adminSession(t);
      await withSession(t.http().get(`${BASE}?status=LIVE`), s).expect(400);
      await withSession(t.http().get(`${BASE}?pageSize=1000`), s).expect(400);
    });
  });

  describe('GET /admin/banners/:id', () => {
    it('200 returns the banner incl. targeted complexes', async () => {
      const s = await adminSession(t);
      const complex = await createComplex(t.prisma);
      const b = await seedBanner(t.prisma, {
        targeting: 'COMPLEXES',
        targetComplexes: { create: [{ complexId: complex.id }] },
        memo: '내부 메모',
      });
      const res = await withSession(t.http().get(`${BASE}/${b.id}`), s).expect(200);
      expect(res.body).toMatchObject({
        id: b.id,
        targetComplexes: [{ id: complex.id, name: complex.name }],
        memo: '내부 메모',
      });
    });

    it('404 for unknown or deleted banners, 401 anonymous, 400 bad id', async () => {
      const s = await adminSession(t);
      const deleted = await seedBanner(t.prisma, { deletedAt: new Date() });
      const res = await withSession(t.http().get(`${BASE}/${deleted.id}`), s).expect(404);
      expect(res.body.code).toBe('BANNER_NOT_FOUND');
      await t.http().get(`${BASE}/${deleted.id}`).expect(401);
      await withSession(t.http().get(`${BASE}/not-a-uuid`), s).expect(400);
    });
  });

  describe('PATCH /admin/banners/:id', () => {
    it('200 updates fields and targeting, clears nullable fields, audits before/after', async () => {
      const s = await adminSession(t);
      await createRegion(t.prisma, '46150');
      const b = await seedBanner(t.prisma, { advertiserName: '광고주' });
      const res = await withSession(t.http().patch(`${BASE}/${b.id}`), s)
        .send({
          title: '수정된 제목',
          advertiserName: null,
          linkUrl: '/complexes',
          targeting: 'REGIONS',
          targetRegionCodes: ['46150'],
        })
        .expect(200);
      expect(res.body).toMatchObject({
        title: '수정된 제목',
        advertiserName: null,
        linkUrl: '/complexes',
        targeting: 'REGIONS',
        targetRegionCodes: ['46150'],
      });

      // Switching back to ALL drops the region targets.
      const back = await withSession(t.http().patch(`${BASE}/${b.id}`), s)
        .send({ targeting: 'ALL' })
        .expect(200);
      expect(back.body.targetRegionCodes).toEqual([]);

      const audit = await t.prisma.auditLog.findFirst({
        where: { action: 'banner.update', resourceId: b.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(audit?.before).toMatchObject({ title: '테스트 배너', advertiserName: '광고주' });
      expect(audit?.after).toMatchObject({ title: '수정된 제목' });
    });

    it('409 when un-pausing would exceed the slot limit; plain edits still work', async () => {
      const s = await adminSession(t);
      await t.prisma.bannerSlotConfig.create({ data: { slot: 'LISTING_SIDE', maxActive: 1 } });
      await seedBanner(t.prisma, { slot: 'LISTING_SIDE' });
      const paused = await seedBanner(t.prisma, { slot: 'LISTING_SIDE', paused: true });
      await withSession(t.http().patch(`${BASE}/${paused.id}`), s)
        .send({ paused: false })
        .expect(409);
      await withSession(t.http().patch(`${BASE}/${paused.id}`), s)
        .send({ title: '제목만 변경' })
        .expect(200);
    });

    it('400 on invalid patches (empty, immutable slot, merged window, targeting)', async () => {
      const s = await adminSession(t);
      const b = await seedBanner(t.prisma);
      await withSession(t.http().patch(`${BASE}/${b.id}`), s)
        .send({})
        .expect(400);
      await withSession(t.http().patch(`${BASE}/${b.id}`), s)
        .send({ slot: 'MAP_AD' })
        .expect(400);
      const res = await withSession(t.http().patch(`${BASE}/${b.id}`), s)
        .send({ endAt: isoIn(-3) })
        .expect(400);
      expect(res.body.details[0].path).toBe('endAt');
      await withSession(t.http().patch(`${BASE}/${b.id}`), s)
        .send({ targeting: 'REGIONS' })
        .expect(400);
    });

    it('401 anonymous and 404 unknown', async () => {
      const s = await adminSession(t);
      const b = await seedBanner(t.prisma);
      await t
        .http()
        .patch(`${BASE}/${b.id}`)
        .set('Origin', s.origin)
        .send({ title: 'x' })
        .expect(401);
      await withSession(t.http().patch(`${BASE}/01937a2b-0000-7000-8000-00000000abcd`), s)
        .send({ title: 'x' })
        .expect(404);
    });
  });

  describe('DELETE /admin/banners/:id', () => {
    it('204 soft-deletes and audits', async () => {
      const s = await adminSession(t);
      const b = await seedBanner(t.prisma);
      await withSession(t.http().delete(`${BASE}/${b.id}`), s).expect(204);
      const row = await t.prisma.banner.findUniqueOrThrow({ where: { id: b.id } });
      expect(row.deletedAt).not.toBeNull();
      await withSession(t.http().get(`${BASE}/${b.id}`), s).expect(404);
      expect(
        await t.prisma.auditLog.count({ where: { action: 'banner.delete', resourceId: b.id } }),
      ).toBe(1);
    });

    it('401 anonymous, 400 bad id, 404 already deleted', async () => {
      const s = await adminSession(t);
      const b = await seedBanner(t.prisma, { deletedAt: new Date() });
      await t.http().delete(`${BASE}/${b.id}`).set('Origin', s.origin).expect(401);
      await withSession(t.http().delete(`${BASE}/nope`), s).expect(400);
      await withSession(t.http().delete(`${BASE}/${b.id}`), s).expect(404);
    });
  });

  describe('PUT /admin/banners/reorder', () => {
    it('200 puts listed ids first and keeps the rest after them', async () => {
      const s = await adminSession(t);
      const a = await seedBanner(t.prisma, { sortOrder: 0 });
      const b = await seedBanner(t.prisma, { sortOrder: 1 });
      const c = await seedBanner(t.prisma, { sortOrder: 2 });
      const res = await withSession(t.http().put(`${BASE}/reorder`), s)
        .send({ slot: 'MAIN_HERO', ids: [c.id, a.id] })
        .expect(200);
      expect(pluck(res)).toEqual([c.id, a.id, b.id]);
      expect(pluck<number>(res, 'sortOrder')).toEqual([0, 1, 2]);
      expect(await t.prisma.auditLog.count({ where: { action: 'banner.reorder' } })).toBe(1);
    });

    it('400 for ids of another slot, duplicates-only empty list or bad body', async () => {
      const s = await adminSession(t);
      const other = await seedBanner(t.prisma, { slot: 'MAP_AD' });
      const res = await withSession(t.http().put(`${BASE}/reorder`), s)
        .send({ slot: 'MAIN_HERO', ids: [other.id] })
        .expect(400);
      expect(res.body).toMatchObject({
        code: 'BANNER_REORDER_INVALID',
        details: { unknownIds: [other.id] },
      });
      await withSession(t.http().put(`${BASE}/reorder`), s)
        .send({ slot: 'MAIN_HERO', ids: [] })
        .expect(400);
      await withSession(t.http().put(`${BASE}/reorder`), s)
        .send({ ids: [other.id] })
        .expect(400);
    });

    it('401 anonymous', async () => {
      await t
        .http()
        .put(`${BASE}/reorder`)
        .set('Origin', 'http://localhost:3001')
        .send({ slot: 'MAIN_HERO', ids: [] })
        .expect(401);
    });
  });
});
