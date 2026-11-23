import { AdminRole, BANNER_SLOT_SPECS, MediaPurpose } from '@house/shared';
import { createMedia, createTestApp, resetAll, withSession, type TestApp } from '../../utils';
import { adminSession, inHours, isoIn, pluck, popupMedia, seedBanner, seedPopup } from './helpers';

const SLOTS = '/api/v1/admin/banner-slots';
const POPUPS = '/api/v1/admin/popups';

describe('ads: admin banner slots + popups (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  describe('GET /admin/banner-slots', () => {
    it('200 lists every slot with defaults, overrides and live counts', async () => {
      const s = await adminSession(t);
      await t.prisma.bannerSlotConfig.create({
        data: { slot: 'MAP_AD', maxActive: 2, isEnabled: false, note: '점검 중' },
      });
      await seedBanner(t.prisma, { slot: 'MAIN_HERO' });
      await seedBanner(t.prisma, { slot: 'MAIN_HERO', startAt: inHours(1), endAt: inHours(2) });
      const res = await withSession(t.http().get(SLOTS), s).expect(200);
      const bySlot = new Map(
        (res.body.items as { slot: string }[]).map((x) => [x.slot, x as Record<string, unknown>]),
      );
      expect(bySlot.size).toBe(Object.keys(BANNER_SLOT_SPECS).length);
      expect(bySlot.get('MAIN_HERO')).toMatchObject({
        maxActive: BANNER_SLOT_SPECS.MAIN_HERO.maxActive,
        isEnabled: true,
        activeCount: 1,
        upcomingCount: 2,
        label: BANNER_SLOT_SPECS.MAIN_HERO.label,
      });
      expect(bySlot.get('MAP_AD')).toMatchObject({
        maxActive: 2,
        defaultMaxActive: BANNER_SLOT_SPECS.MAP_AD.maxActive,
        isEnabled: false,
        note: '점검 중',
      });
    });

    it('401 anonymous', async () => {
      await t.http().get(SLOTS).expect(401);
    });
  });

  describe('GET /admin/banner-slots/:slot', () => {
    it('200 for a slot, 400 for an unknown slot', async () => {
      const s = await adminSession(t);
      const res = await withSession(t.http().get(`${SLOTS}/LISTING_SIDE`), s).expect(200);
      expect(res.body).toMatchObject({ slot: 'LISTING_SIDE', mobile: null });
      await withSession(t.http().get(`${SLOTS}/SIDEBAR`), s).expect(400);
    });

    it('401 without TOTP', async () => {
      const s = await adminSession(t, AdminRole.ADMIN, { mfaVerified: false });
      await withSession(t.http().get(`${SLOTS}/LISTING_SIDE`), s).expect(401);
    });
  });

  describe('PATCH /admin/banner-slots/:slot', () => {
    it('200 for ADMIN, audited', async () => {
      const s = await adminSession(t, AdminRole.ADMIN);
      const res = await withSession(t.http().patch(`${SLOTS}/MAIN_STRIP`), s)
        .send({ maxActive: 2, note: '이벤트 기간' })
        .expect(200);
      expect(res.body).toMatchObject({ slot: 'MAIN_STRIP', maxActive: 2, note: '이벤트 기간' });
      const audit = await t.prisma.auditLog.findFirst({ where: { action: 'banner-slot.update' } });
      expect(audit).toMatchObject({ resourceId: 'MAIN_STRIP' });
      expect(audit?.before).toMatchObject({ maxActive: BANNER_SLOT_SPECS.MAIN_STRIP.maxActive });
    });

    it('403 for OPERATOR', async () => {
      const s = await adminSession(t, AdminRole.OPERATOR);
      await withSession(t.http().patch(`${SLOTS}/MAIN_STRIP`), s)
        .send({ maxActive: 2 })
        .expect(403);
    });

    it('400 on invalid body', async () => {
      const s = await adminSession(t, AdminRole.SUPER_ADMIN);
      await withSession(t.http().patch(`${SLOTS}/MAIN_STRIP`), s)
        .send({})
        .expect(400);
      await withSession(t.http().patch(`${SLOTS}/MAIN_STRIP`), s)
        .send({ maxActive: -1 })
        .expect(400);
      await withSession(t.http().patch(`${SLOTS}/MAIN_STRIP`), s)
        .send({ extra: 1 })
        .expect(400);
    });
  });

  describe('popups CRUD', () => {
    async function validPopup(extra: Record<string, unknown> = {}) {
      const media = await popupMedia(t.prisma);
      return {
        title: '설 연휴 고객센터 안내',
        mediaId: media.id,
        targetPages: ['MAIN', 'MAP'],
        startAt: isoIn(-1),
        endAt: isoIn(24),
        dismissDays: 7,
        ...extra,
      };
    }

    it('POST 201 creates (audited), GET lists/reads, PATCH updates, DELETE soft-deletes', async () => {
      const s = await adminSession(t);
      const created = await withSession(t.http().post(POPUPS), s)
        .send(await validPopup({ linkUrl: '/notices/1' }))
        .expect(201);
      expect(created.body).toMatchObject({
        status: 'ACTIVE',
        dismissDays: 7,
        targetPages: ['MAIN', 'MAP'],
        linkUrl: '/notices/1',
        sortOrder: 0,
        createdByAdminId: s.adminId,
      });
      const id = created.body.id as string;
      expect(
        await t.prisma.auditLog.count({ where: { action: 'popup.create', resourceId: id } }),
      ).toBe(1);

      await seedPopup(t.prisma, { title: '지난 팝업', startAt: inHours(-5), endAt: inHours(-1) });
      let res = await withSession(t.http().get(`${POPUPS}?status=ACTIVE&targetPage=MAP`), s).expect(
        200,
      );
      expect(pluck(res)).toEqual([id]);
      res = await withSession(t.http().get(`${POPUPS}?status=ENDED`), s).expect(200);
      expect(res.body.total).toBe(1);

      res = await withSession(t.http().get(`${POPUPS}/${id}`), s).expect(200);
      expect(res.body.image.url).toMatch(/^\/media\//);

      res = await withSession(t.http().patch(`${POPUPS}/${id}`), s)
        .send({ paused: true, linkUrl: null, targetPages: ['ALL'] })
        .expect(200);
      expect(res.body).toMatchObject({ status: 'PAUSED', linkUrl: null, targetPages: ['ALL'] });

      await withSession(t.http().delete(`${POPUPS}/${id}`), s).expect(204);
      await withSession(t.http().get(`${POPUPS}/${id}`), s).expect(404);
      expect(await t.prisma.auditLog.count({ where: { action: { startsWith: 'popup.' } } })).toBe(
        3,
      );
    });

    it('PATCH replacing the image validates it and releases the old one; removed images are not served', async () => {
      const s = await adminSession(t);
      const p = await seedPopup(t.prisma);
      const old = await t.prisma.media.update({
        where: { id: p.mediaId },
        data: { updatedAt: new Date(Date.now() - 86_400_000) },
      });
      const deleted = await popupMedia(t.prisma);
      await t.prisma.media.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } });
      const bad = await withSession(t.http().patch(`${POPUPS}/${p.id}`), s)
        .send({ mediaId: deleted.id })
        .expect(400);
      expect(bad.body.code).toBe('POPUP_MEDIA_INVALID');

      const next = await popupMedia(t.prisma);
      const res = await withSession(t.http().patch(`${POPUPS}/${p.id}`), s)
        .send({ mediaId: next.id })
        .expect(200);
      expect(res.body.image.id).toBe(next.id);
      const after = await t.prisma.media.findUniqueOrThrow({ where: { id: old.id } });
      expect(after.updatedAt.getTime()).toBeGreaterThan(old.updatedAt.getTime());

      await t.prisma.media.update({ where: { id: next.id }, data: { deletedAt: new Date() } });
      await withSession(t.http().patch(`${POPUPS}/${p.id}`), s)
        .send({ title: '캐시 무효화' })
        .expect(200);
      const served = await t.http().get('/api/v1/popups?page=MAIN').expect(200);
      expect(served.body.items).toEqual([]);
    });

    it('401 anonymous on every popup route', async () => {
      const p = await seedPopup(t.prisma);
      const origin = 'http://localhost:3001';
      await t.http().get(POPUPS).expect(401);
      await t.http().get(`${POPUPS}/${p.id}`).expect(401);
      await t
        .http()
        .post(POPUPS)
        .set('Origin', origin)
        .send(await validPopup())
        .expect(401);
      await t
        .http()
        .patch(`${POPUPS}/${p.id}`)
        .set('Origin', origin)
        .send({ title: 'x' })
        .expect(401);
      await t.http().delete(`${POPUPS}/${p.id}`).set('Origin', origin).expect(401);
      await t
        .http()
        .put(`${POPUPS}/reorder`)
        .set('Origin', origin)
        .send({ ids: [p.id] })
        .expect(401);
    });

    it('400 on validation failures and unusable media', async () => {
      const s = await adminSession(t);
      await withSession(t.http().post(POPUPS), s)
        .send(await validPopup({ targetPages: [], dismissDays: 99 }))
        .expect(400);
      await withSession(t.http().post(POPUPS), s)
        .send(await validPopup({ linkUrl: '//evil.example' }))
        .expect(400);
      const banner = await createMedia(t.prisma, { purpose: MediaPurpose.BANNER });
      const res = await withSession(t.http().post(POPUPS), s)
        .send(await validPopup({ mediaId: banner.id }))
        .expect(400);
      expect(res.body.code).toBe('POPUP_MEDIA_INVALID');

      const p = await seedPopup(t.prisma);
      await withSession(t.http().patch(`${POPUPS}/${p.id}`), s)
        .send({})
        .expect(400);
      await withSession(t.http().patch(`${POPUPS}/${p.id}`), s)
        .send({ startAt: isoIn(48) })
        .expect(400);
      await withSession(t.http().get(`${POPUPS}?targetPage=HOME`), s).expect(400);
      await withSession(t.http().get(`${POPUPS}/123`), s).expect(400);
      await withSession(t.http().delete(`${POPUPS}/123`), s).expect(400);
    });

    it('404 for unknown popups', async () => {
      const s = await adminSession(t);
      const id = '01937a2b-0000-7000-8000-00000000abcd';
      const res = await withSession(t.http().get(`${POPUPS}/${id}`), s).expect(404);
      expect(res.body.code).toBe('POPUP_NOT_FOUND');
      await withSession(t.http().patch(`${POPUPS}/${id}`), s)
        .send({ title: 'x' })
        .expect(404);
      await withSession(t.http().delete(`${POPUPS}/${id}`), s).expect(404);
    });

    it('PUT /reorder 200 reorders; 400 for unknown ids or bad body', async () => {
      const s = await adminSession(t);
      const a = await seedPopup(t.prisma, { sortOrder: 0 });
      const b = await seedPopup(t.prisma, { sortOrder: 1 });
      const res = await withSession(t.http().put(`${POPUPS}/reorder`), s)
        .send({ ids: [b.id] })
        .expect(200);
      expect(pluck(res)).toEqual([b.id, a.id]);
      expect(await t.prisma.auditLog.count({ where: { action: 'popup.reorder' } })).toBe(1);

      const bad = await withSession(t.http().put(`${POPUPS}/reorder`), s)
        .send({ ids: ['01937a2b-0000-7000-8000-00000000abcd'] })
        .expect(400);
      expect(bad.body.code).toBe('POPUP_REORDER_INVALID');
      await withSession(t.http().put(`${POPUPS}/reorder`), s)
        .send({ ids: 'x' })
        .expect(400);
    });
  });
});
