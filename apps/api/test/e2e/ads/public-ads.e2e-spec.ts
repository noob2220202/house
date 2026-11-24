import { AgencyStatus, ErrorCode, kstDate, MediaPurpose, TermsType, UserRole } from '@house/shared';
import { ADS_REDIS } from '../../../src/modules/ads/constants';
import { AdTrackingService } from '../../../src/modules/ads/services/ad-tracking.service';
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
import { adminSession, CHROME_UA, inHours, pluck, seedBanner, seedPopup } from './helpers';

const PUBLIC_ORIGIN = 'http://localhost:3000';
const SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';

describe('ads: public serving, tracking and stats (e2e)', () => {
  let t: TestApp;
  let tracking: AdTrackingService;

  beforeAll(async () => {
    t = await createTestApp();
    tracking = t.app.get(AdTrackingService);
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  /** Flush everything recorded so far (skips the in-flight grace window). */
  const flush = () => tracking.flush(new Date(Date.now() + 60_000));

  describe('GET /banners', () => {
    it('200 returns only live banners of the slot, in admin order, without private fields', async () => {
      const { agency } = await createAgency(t.prisma);
      const first = await seedBanner(t.prisma, { sortOrder: 0, agencyId: agency.id });
      const second = await seedBanner(t.prisma, { sortOrder: 1, linkUrl: null });
      await seedBanner(t.prisma, { paused: true });
      await seedBanner(t.prisma, { startAt: inHours(1), endAt: inHours(2) });
      await seedBanner(t.prisma, { startAt: inHours(-3), endAt: inHours(-1) });
      await seedBanner(t.prisma, { deletedAt: new Date() });
      await seedBanner(t.prisma, { slot: 'MAP_AD' });

      const res = await t.http().get('/api/v1/banners?slot=MAIN_HERO').expect(200);
      expect(pluck(res)).toEqual([first.id, second.id]);
      expect(res.headers['cache-control']).toContain('max-age=30');
      const [a, b] = res.body.items;
      expect(a).toMatchObject({
        agency: { id: agency.id, name: agency.name },
        clickUrl: `http://localhost:4000/api/v1/banners/${first.id}/click`,
        mobileImageUrl: null,
      });
      expect(a.imageUrl).toMatch(/^\/media\//);
      expect(b.clickUrl).toBeNull();
      expect(a).not.toHaveProperty('memo');
      expect(a).not.toHaveProperty('linkUrl');
    });

    it('applies region / complex targeting by 법정동 prefix', async () => {
      const complex = await createComplex(t.prisma, { emdCode: '12150250' });
      const all = await seedBanner(t.prisma, { sortOrder: 0 });
      const sgg = await seedBanner(t.prisma, {
        sortOrder: 1,
        targeting: 'REGIONS',
        targetRegions: { create: [{ regionCode: '12150' }] },
      });
      const otherEmd = await seedBanner(t.prisma, {
        sortOrder: 2,
        targeting: 'REGIONS',
        targetRegions: { create: [{ regionCode: '12150101' }] },
      });
      const byComplex = await seedBanner(t.prisma, {
        sortOrder: 3,
        targeting: 'COMPLEXES',
        targetComplexes: { create: [{ complexId: complex.id }] },
      });

      let res = await t.http().get('/api/v1/banners?slot=MAIN_HERO').expect(200);
      expect(pluck(res)).toEqual([all.id]);

      res = await t.http().get('/api/v1/banners?slot=MAIN_HERO&regionCode=1215010100').expect(200);
      expect(pluck(res)).toEqual([all.id, sgg.id, otherEmd.id]);

      res = await t
        .http()
        .get(`/api/v1/banners?slot=MAIN_HERO&complexId=${complex.id}`)
        .expect(200);
      expect(pluck(res)).toEqual([all.id, sgg.id, byComplex.id]);
    });

    it('caps to the slot limit by priority and hides disabled slots', async () => {
      await t.prisma.bannerSlotConfig.create({ data: { slot: 'MAIN_STRIP', maxActive: 2 } });
      const low = await seedBanner(t.prisma, { slot: 'MAIN_STRIP', priority: 0, sortOrder: 0 });
      const high = await seedBanner(t.prisma, { slot: 'MAIN_STRIP', priority: 9, sortOrder: 2 });
      const mid = await seedBanner(t.prisma, { slot: 'MAIN_STRIP', priority: 5, sortOrder: 1 });
      const res = await t.http().get('/api/v1/banners?slot=MAIN_STRIP').expect(200);
      expect(pluck(res)).toEqual([mid.id, high.id]);
      expect(pluck(res)).not.toContain(low.id);

      await t.prisma.bannerSlotConfig.create({
        data: { slot: 'MAP_AD', maxActive: 3, isEnabled: false },
      });
      await seedBanner(t.prisma, { slot: 'MAP_AD' });
      const off = await t.http().get('/api/v1/banners?slot=MAP_AD').expect(200);
      expect(off.body.items).toEqual([]);
    });

    it('does not serve banners of unapproved agencies or with a removed image', async () => {
      const { agency: suspended } = await createAgency(t.prisma, {
        status: AgencyStatus.SUSPENDED,
      });
      const { agency: approved } = await createAgency(t.prisma);
      const ok = await seedBanner(t.prisma, { sortOrder: 0, agencyId: approved.id });
      const noAgency = await seedBanner(t.prisma, { sortOrder: 1 });
      const sanctioned = await seedBanner(t.prisma, { agencyId: suspended.id });
      const brokenImage = await seedBanner(t.prisma);
      await t.prisma.media.update({
        where: { id: brokenImage.pcMediaId },
        data: { deletedAt: new Date() },
      });
      const withMobile = await seedBanner(t.prisma, { sortOrder: 2 });
      const mobile = await createMedia(t.prisma, { purpose: MediaPurpose.BANNER });
      await t.prisma.banner.update({
        where: { id: withMobile.id },
        data: { mobileMediaId: mobile.id },
      });
      await t.prisma.media.update({ where: { id: mobile.id }, data: { deletedAt: new Date() } });

      const res = await t.http().get('/api/v1/banners?slot=MAIN_HERO').expect(200);
      expect(pluck(res)).toEqual([ok.id, noAgency.id, withMobile.id]);
      expect(pluck(res)).not.toContain(sanctioned.id);
      expect(pluck(res)).not.toContain(brokenImage.id);
      expect(res.body.items[2].mobileImageUrl).toBeNull();

      // Not servable → impressions and clicks are not counted either.
      await t
        .http()
        .post('/api/v1/banners/impressions')
        .set('Origin', PUBLIC_ORIGIN)
        .set('User-Agent', CHROME_UA)
        .send({ ids: [sanctioned.id, brokenImage.id] })
        .expect(204);
      await t
        .http()
        .get(`/api/v1/banners/${sanctioned.id}/click`)
        .set('User-Agent', CHROME_UA)
        .redirects(0)
        .expect(302);
      await flush();
      expect(await t.prisma.bannerStatDaily.count()).toBe(0);
    });

    it('serves from cache and invalidates on admin writes', async () => {
      const b = await seedBanner(t.prisma);
      await t.http().get('/api/v1/banners?slot=MAIN_HERO').expect(200);
      // A direct DB change is invisible while cached…
      await t.prisma.banner.update({ where: { id: b.id }, data: { title: '직접 변경' } });
      let res = await t.http().get('/api/v1/banners?slot=MAIN_HERO').expect(200);
      expect(res.body.items[0].title).toBe('테스트 배너');
      // …an admin write bumps the cache version.
      const s = await adminSession(t);
      await withSession(t.http().patch(`/api/v1/admin/banners/${b.id}`), s)
        .send({ paused: true })
        .expect(200);
      res = await t.http().get('/api/v1/banners?slot=MAIN_HERO').expect(200);
      expect(res.body.items).toEqual([]);
    });

    it('400 on missing/invalid query', async () => {
      await t.http().get('/api/v1/banners').expect(400);
      await t.http().get('/api/v1/banners?slot=TOP').expect(400);
      await t.http().get('/api/v1/banners?slot=MAIN_HERO&regionCode=abc').expect(400);
      await t.http().get('/api/v1/banners?slot=MAIN_HERO&complexId=1').expect(400);
    });

    it('200 with a user session too (public route, no authz)', async () => {
      const user = await createUser(t.prisma);
      const s = await loginUser(t.app, { id: user.id });
      await withSession(t.http().get('/api/v1/banners?slot=MAIN_HERO'), s).expect(200);
    });
  });

  describe('GET /popups', () => {
    it('200 returns live popups for the page plus ALL-page popups', async () => {
      const main = await seedPopup(t.prisma, { targetPages: ['MAIN'], sortOrder: 1 });
      const everywhere = await seedPopup(t.prisma, { targetPages: ['ALL'], sortOrder: 0 });
      await seedPopup(t.prisma, { targetPages: ['MAP'] });
      await seedPopup(t.prisma, { targetPages: ['MAIN'], paused: true });
      await seedPopup(t.prisma, {
        targetPages: ['MAIN'],
        startAt: inHours(-5),
        endAt: inHours(-1),
      });
      const res = await t.http().get('/api/v1/popups?page=MAIN').expect(200);
      expect(pluck(res)).toEqual([everywhere.id, main.id]);
      expect(res.body.items[1]).toMatchObject({ dismissDays: 1, newWindow: false });
    });

    it('invalidates on admin popup writes', async () => {
      const p = await seedPopup(t.prisma);
      await t.http().get('/api/v1/popups?page=MAIN').expect(200);
      const s = await adminSession(t);
      await withSession(t.http().delete(`/api/v1/admin/popups/${p.id}`), s).expect(204);
      const res = await t.http().get('/api/v1/popups?page=MAIN').expect(200);
      expect(res.body.items).toEqual([]);
    });

    it('400 on invalid page', async () => {
      await t.http().get('/api/v1/popups').expect(400);
      await t.http().get('/api/v1/popups?page=HOME').expect(400);
    });
  });

  describe('POST /banners/:id/impression and /banners/impressions', () => {
    it('204 counts once per visitor per day, ignores bots and non-live banners', async () => {
      const live = await seedBanner(t.prisma);
      const ended = await seedBanner(t.prisma, { startAt: inHours(-3), endAt: inHours(-1) });
      const send = (id: string, ua: string, ip = '10.0.0.1') =>
        t
          .http()
          .post(`/api/v1/banners/${id}/impression`)
          .set('Origin', PUBLIC_ORIGIN)
          .set('User-Agent', ua)
          .set('X-Forwarded-For', ip)
          .expect(204);
      await send(live.id, CHROME_UA);
      await send(live.id, CHROME_UA); // same visitor → deduped
      // Anonymous visitors are their IP: rotating the User-Agent does not mint new visitors.
      await send(live.id, SAFARI_UA);
      await send(live.id, `${CHROME_UA} rotated/1`);
      await send(live.id, CHROME_UA, '10.0.0.2'); // another IP → another visitor
      await send(
        live.id,
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      );
      await send(ended.id, CHROME_UA);

      // Logged-in users are identified by session (CSRF header required with a session).
      const user = await createUser(t.prisma, { role: UserRole.USER });
      const us = await loginUser(t.app, { id: user.id });
      await withSession(t.http().post('/api/v1/banners/impressions'), us)
        .set('User-Agent', CHROME_UA)
        .send({ ids: [live.id, ended.id, live.id] })
        .expect(204);

      expect(await flush()).toBe(1);
      const row = await t.prisma.bannerStatDaily.findFirstOrThrow({ where: { bannerId: live.id } });
      expect(row).toMatchObject({ impressions: 3, clicks: 0 });
      expect(await t.prisma.bannerStatDaily.count({ where: { bannerId: ended.id } })).toBe(0);
    });

    it('beacons and the click still count for a member whose required terms are pending', async () => {
      const b = await seedBanner(t.prisma);
      const past = new Date(Date.now() - 86_400_000);
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
      const user = await createUser(t.prisma, { role: UserRole.USER });
      const us = await loginUser(t.app, { id: user.id });
      // TermsConsentGuard is active for this member (a write elsewhere is refused) …
      const blocked = await withSession(
        t.http().put('/api/v1/me/favorites/listings/00000000-0000-0000-0000-000000000000'),
        us,
      ).expect(403);
      expect(blocked.body.code).toBe(ErrorCode.AUTH_TERMS_REQUIRED);
      // … but the ad beacons are exempt (@SkipTermsCheck).
      await withSession(t.http().post(`/api/v1/banners/${b.id}/impression`), us)
        .set('User-Agent', CHROME_UA)
        .expect(204);
      await withSession(t.http().post('/api/v1/banners/impressions'), us)
        .set('User-Agent', CHROME_UA)
        .send({ ids: [b.id] })
        .expect(204);
      await withSession(t.http().get(`/api/v1/banners/${b.id}/click`), us)
        .set('User-Agent', CHROME_UA)
        .redirects(0)
        .expect(302);
      await flush();
      const row = await t.prisma.bannerStatDaily.findFirstOrThrow({ where: { bannerId: b.id } });
      expect(row).toMatchObject({ impressions: 1, clicks: 1 });
    });

    it('counts distinct visitors in a bounded HyperLogLog', async () => {
      const b = await seedBanner(t.prisma);
      const n = 300;
      for (let i = 0; i < n; i++) {
        await tracking.recordImpressions([b.id], {
          ip: `10.1.${Math.floor(i / 250)}.${i % 250}`,
          userAgent: CHROME_UA,
        });
      }
      // Repeat visits (any UA) do not add anything.
      for (let i = 0; i < 50; i++) {
        await tracking.recordImpressions([b.id], {
          ip: '10.1.0.7',
          userAgent: `${CHROME_UA} ${i}`,
        });
      }
      const key = ADS_REDIS.impressions(kstDate(), b.id);
      expect(await t.redis.type(key)).toBe('string'); // HLL, not a SET
      expect(await t.redis.pfcount(key)).toBeGreaterThan(n * 0.97);
      await flush();
      const row = await t.prisma.bannerStatDaily.findFirstOrThrow({ where: { bannerId: b.id } });
      expect(Math.abs(row.impressions - n)).toBeLessThanOrEqual(n * 0.03);
    });

    it('403 for a foreign Origin, or a session without the CSRF token', async () => {
      const b = await seedBanner(t.prisma);
      await t
        .http()
        .post(`/api/v1/banners/${b.id}/impression`)
        .set('Origin', 'https://evil.example')
        .expect(403);
      const user = await createUser(t.prisma);
      const us = await loginUser(t.app, { id: user.id });
      await t
        .http()
        .post('/api/v1/banners/impressions')
        .set('Cookie', us.cookie)
        .set('Origin', us.origin)
        .send({ ids: [b.id] })
        .expect(403);
    });

    it('400 on invalid ids / batch', async () => {
      await t
        .http()
        .post('/api/v1/banners/abc/impression')
        .set('Origin', PUBLIC_ORIGIN)
        .expect(400);
      await t
        .http()
        .post('/api/v1/banners/impressions')
        .set('Origin', PUBLIC_ORIGIN)
        .send({ ids: [] })
        .expect(400);
      const many = Array.from(
        { length: 21 },
        (_, i) => `01937a2b-0000-7000-8000-${String(i).padStart(12, '0')}`,
      );
      await t
        .http()
        .post('/api/v1/banners/impressions')
        .set('Origin', PUBLIC_ORIGIN)
        .send({ ids: many })
        .expect(400);
    });

    it('400 fast and small for a ~1 MB batch of junk ids (zod max short-circuits; SEC-04)', async () => {
      // 500k elements ≈ BODY_LIMIT. zod < 4.6.6 validated every element past .max() (~600 MB heap).
      const junk = `{"ids":[${new Array(500_000).fill('0').join(',')}]}`;
      const started = Date.now();
      const res = await t
        .http()
        .post('/api/v1/banners/impressions')
        .set('Origin', PUBLIC_ORIGIN)
        .set('Content-Type', 'application/json')
        .send(junk)
        .expect(400);
      expect(Date.now() - started).toBeLessThan(2_000);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(res.body.details.length).toBeLessThanOrEqual(20);
      expect(JSON.stringify(res.body).length).toBeLessThan(10_000);
    });
  });

  describe('GET /banners/:id/click', () => {
    it('302 to the https link (counted once per visitor) and to the site for relative links', async () => {
      const ext = await seedBanner(t.prisma, {
        linkUrl: 'https://ad.example.com/landing?utm=house',
      });
      const rel = await seedBanner(t.prisma, { linkUrl: '/complexes/abc?tab=trade' });
      const click = (id: string, ua = CHROME_UA) =>
        t.http().get(`/api/v1/banners/${id}/click`).set('User-Agent', ua).redirects(0);

      let res = await click(ext.id).expect(302);
      expect(res.headers.location).toBe('https://ad.example.com/landing?utm=house');
      expect(res.headers['cache-control']).toBe('no-store');
      await click(ext.id).expect(302);
      await click(ext.id, 'curl/8.5.0').expect(302); // bots are redirected but not counted

      res = await click(rel.id).expect(302);
      expect(res.headers.location).toBe('http://localhost:3000/complexes/abc?tab=trade');

      await flush();
      const row = await t.prisma.bannerStatDaily.findFirstOrThrow({ where: { bannerId: ext.id } });
      expect(row.clicks).toBe(1);
    });

    it('302 but no count for embedded (non-navigation) requests', async () => {
      const b = await seedBanner(t.prisma);
      const req = () =>
        t.http().get(`/api/v1/banners/${b.id}/click`).set('User-Agent', CHROME_UA).redirects(0);
      // <img src=".../click"> on a third-party page.
      await req().set('Sec-Fetch-Dest', 'image').set('Sec-Fetch-Mode', 'no-cors').expect(302);
      await req().set('Sec-Fetch-Dest', 'image').expect(302);
      await req().set('Sec-Fetch-Mode', 'cors').expect(302);
      await flush();
      expect(await t.prisma.bannerStatDaily.count()).toBe(0);

      await req().set('Sec-Fetch-Dest', 'document').set('Sec-Fetch-Mode', 'navigate').expect(302);
      await flush();
      const row = await t.prisma.bannerStatDaily.findFirstOrThrow({ where: { bannerId: b.id } });
      expect(row.clicks).toBe(1);
    });

    it('does not count clicks on banners that are not live', async () => {
      const paused = await seedBanner(t.prisma, { paused: true });
      await t
        .http()
        .get(`/api/v1/banners/${paused.id}/click`)
        .set('User-Agent', CHROME_UA)
        .redirects(0)
        .expect(302);
      await flush();
      expect(await t.prisma.bannerStatDaily.count()).toBe(0);
    });

    it('404 without a link / deleted, 400 for a stored unsafe link or bad id', async () => {
      const noLink = await seedBanner(t.prisma, { linkUrl: null });
      const deleted = await seedBanner(t.prisma, { deletedAt: new Date() });
      // Rows written before validation existed (or by hand) are re-checked on every click.
      const unsafe = await seedBanner(t.prisma, { linkUrl: 'javascript:alert(1)' });
      await t.http().get(`/api/v1/banners/${noLink.id}/click`).redirects(0).expect(404);
      await t.http().get(`/api/v1/banners/${deleted.id}/click`).redirects(0).expect(404);
      const res = await t.http().get(`/api/v1/banners/${unsafe.id}/click`).redirects(0).expect(400);
      expect(res.body.code).toBe('BANNER_INVALID_LINK');
      await t.http().get('/api/v1/banners/x/click').redirects(0).expect(400);
    });
  });

  describe('banner-stats flush + GET /admin/banners/:id/stats', () => {
    it('flush is idempotent and stats merge DB rows with live Redis counts', async () => {
      const b = await seedBanner(t.prisma);
      const day = (offset: number) =>
        new Date(`${kstDate(new Date(Date.now() + offset * 86_400_000))}T00:00:00Z`);
      // An older day that only exists in the DB.
      await t.prisma.bannerStatDaily.create({
        data: { bannerId: b.id, date: day(-10), impressions: 200, clicks: 4 },
      });

      await tracking.recordImpressions([b.id], { ip: '1.1.1.1', userAgent: CHROME_UA });
      await tracking.recordImpressions([b.id], { ip: '2.2.2.2', userAgent: CHROME_UA });
      await tracking.click(b.id, { ip: '1.1.1.1', userAgent: CHROME_UA });

      const s = await adminSession(t);
      // Before any flush the live Redis counts already show up.
      let res = await withSession(t.http().get(`/api/v1/admin/banners/${b.id}/stats`), s).expect(
        200,
      );
      const today = kstDate();
      expect(res.body.daily).toHaveLength(30);
      expect(res.body.to).toBe(today);
      expect((res.body as { daily: unknown[] }).daily.at(-1)).toEqual({
        date: today,
        impressions: 2,
        clicks: 1,
        ctr: 50,
      });
      expect(res.body.totals).toEqual({ impressions: 202, clicks: 5, ctr: 2.48 });

      expect(await flush()).toBe(1);
      expect(await flush()).toBe(0); // nothing dirty any more
      await tracking.recordImpressions([b.id], { ip: '1.1.1.1', userAgent: CHROME_UA }); // dup
      await flush();
      const row = await t.prisma.bannerStatDaily.findFirstOrThrow({
        where: { bannerId: b.id, date: day(0) },
      });
      expect(row).toMatchObject({ impressions: 2, clicks: 1 });

      const from = kstDate(new Date(Date.now() - 10 * 86_400_000));
      res = await withSession(
        t.http().get(`/api/v1/admin/banners/${b.id}/stats?from=${from}&to=${from}`),
        s,
      ).expect(200);
      expect(res.body.daily).toEqual([{ date: from, impressions: 200, clicks: 4, ctr: 2 }]);
    });

    it('400 for invalid or too long ranges, 401 anonymous, 404 unknown banner', async () => {
      const b = await seedBanner(t.prisma);
      const s = await adminSession(t);
      const url = `/api/v1/admin/banners/${b.id}/stats`;
      await withSession(t.http().get(`${url}?from=2026-02-30`), s).expect(400);
      await withSession(t.http().get(`${url}?from=2026-05-02&to=2026-05-01`), s).expect(400);
      const res = await withSession(t.http().get(`${url}?from=2024-01-01&to=2026-01-01`), s).expect(
        400,
      );
      expect(res.body.code).toBe('BANNER_STATS_RANGE_INVALID');
      await t.http().get(url).expect(401);
      await withSession(
        t.http().get('/api/v1/admin/banners/01937a2b-0000-7000-8000-00000000abcd/stats'),
        s,
      ).expect(404);
    });
  });
});
