import { AdminRole, ErrorCode, FaqCategory, SiteSettingKey } from '@house/shared';
import {
  createComplex,
  createTestApp,
  createUser,
  loginUser,
  resetAll,
  type TestApp,
  type TestSession,
} from '../../utils';
import {
  adminActor,
  api,
  as,
  auditRows,
  BROWSER_UA,
  expectAdminAuthz,
  expectCode,
  pluck,
} from './helpers';

const VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

describe('content: notices / FAQ / videos / site settings (e2e)', () => {
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

  it('runs against its own database and Redis index', async () => {
    expect(process.env.DATABASE_URL).toContain('/house_test_admin?');
    const [row] = await t.prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    expect(row?.db).toBe('house_test_admin');
    expect(t.redis.options.db).toBe(8);
  });

  describe('notices', () => {
    it('admin CRUD + public list/detail (published only, pinned first, view count)', async () => {
      const { admin, session } = await adminActor(t, AdminRole.OPERATOR);
      const draft = await as(t, session, 'post', '/admin/notices')
        .send({ title: '초안', content: '내용' })
        .expect(201);
      expect(draft.body).toMatchObject({ isPublished: false, publishedAt: null });
      const normal = await as(t, session, 'post', '/admin/notices')
        .send({ title: '일반 공지', content: '본문', isPublished: true })
        .expect(201);
      const pinned = await as(t, session, 'post', '/admin/notices')
        .send({ title: '중요 공지', content: '본문', isPublished: true, isPinned: true })
        .expect(201);
      expect((await auditRows(t, 'notice.create'))[0]).toMatchObject({ adminUserId: admin.id });

      const list = await t.http().get(api('/notices')).expect(200);
      expect(pluck(list.body.items, 'id')).toEqual([pinned.body.id, normal.body.id]);
      expect(list.body.items[0]).not.toHaveProperty('content');

      await t
        .http()
        .get(api(`/notices/${draft.body.id}`))
        .expect(404);
      const seen = await t
        .http()
        .get(api(`/notices/${normal.body.id}`))
        .set('User-Agent', BROWSER_UA)
        .expect(200);
      expect(seen.body).toMatchObject({ content: '본문', viewCount: 1 });
      const bot = await t
        .http()
        .get(api(`/notices/${normal.body.id}`))
        .set('User-Agent', 'Googlebot/2.1 (+http://www.google.com/bot.html)')
        .expect(200);
      expect(bot.body.viewCount).toBe(1);

      // Publishing the draft shows up despite the cached first page (cache version bump).
      const updated = await as(t, session, 'patch', `/admin/notices/${draft.body.id}`)
        .send({ isPublished: true, title: '게시됨' })
        .expect(200);
      expect(updated.body.publishedAt).not.toBeNull();
      const [audit] = await auditRows(t, 'notice.update');
      expect(audit?.before).toMatchObject({ title: '초안', isPublished: false });
      expect((await t.http().get(api('/notices')).expect(200)).body.total).toBe(3);

      const adminList = await as(
        t,
        session,
        'get',
        '/admin/notices?isPublished=true&q=공지',
      ).expect(200);
      expect(adminList.body.total).toBe(2);
      await as(t, session, 'get', `/admin/notices/${draft.body.id}`).expect(200);

      await as(t, session, 'delete', `/admin/notices/${normal.body.id}`).expect(204);
      await t
        .http()
        .get(api(`/notices/${normal.body.id}`))
        .expect(404);
      await as(t, session, 'get', `/admin/notices/${normal.body.id}`).expect(404);
      expect(await auditRows(t, 'notice.delete')).toHaveLength(1);
    });

    it('validation failures (400)', async () => {
      const { session } = await adminActor(t, AdminRole.OPERATOR);
      expectCode(
        await as(t, session, 'post', '/admin/notices')
          .send({ title: '', content: 'x' })
          .expect(400),
        ErrorCode.VALIDATION_FAILED,
      );
      const { body } = await as(t, session, 'post', '/admin/notices')
        .send({ title: 'a', content: 'b' })
        .expect(201);
      await as(t, session, 'patch', `/admin/notices/${body.id}`).send({}).expect(400);
      // Content is Markdown without raw HTML: markup and script links are refused on write.
      for (const content of [
        '<script>alert(1)</script>',
        '안내 <img src=x onerror=alert(document.cookie)>',
        '[바로가기](javascript:alert(1))',
        '[바로가기](java&#115;cript&colon;alert(1))',
      ]) {
        expectCode(
          await as(t, session, 'post', '/admin/notices').send({ title: 'x', content }).expect(400),
          ErrorCode.VALIDATION_FAILED,
        );
        await as(t, session, 'patch', `/admin/notices/${body.id}`).send({ content }).expect(400);
      }
      const markdown =
        '## 점검 안내\n\n- 일시: 3시 < 5시\n- [공지](https://example.com/a) · [FAQ](/faqs)';
      await as(t, session, 'patch', `/admin/notices/${body.id}`)
        .send({ content: markdown })
        .expect(200);
      await as(t, session, 'get', '/admin/notices?page=0').expect(400);
      await t.http().get(api('/notices?pageSize=1000')).expect(400);
      await t.http().get(api('/notices/not-an-id')).expect(400);
    });

    it('authz: every admin notice route needs an admin with TOTP', async () => {
      await expectAdminAuthz(t, 'get', '/admin/notices', { userSession });
      await expectAdminAuthz(t, 'post', '/admin/notices', {
        userSession,
        body: { title: 'x', content: 'y' },
      });
      const { session } = await adminActor(t);
      const { body } = await as(t, session, 'post', '/admin/notices')
        .send({ title: 'x', content: 'y' })
        .expect(201);
      await expectAdminAuthz(t, 'get', `/admin/notices/${body.id}`, { userSession });
      await expectAdminAuthz(t, 'patch', `/admin/notices/${body.id}`, {
        userSession,
        body: { title: 'z' },
      });
      await expectAdminAuthz(t, 'delete', `/admin/notices/${body.id}`, { userSession });
    });
  });

  describe('FAQ', () => {
    it('admin CRUD, ordering and public list by category', async () => {
      const { session } = await adminActor(t, AdminRole.OPERATOR);
      const make = (question: string, category: FaqCategory = FaqCategory.LISTING) =>
        as(t, session, 'post', '/admin/faqs')
          .send({ category, question, answer: `${question} 답변` })
          .expect(201);
      const a = await make('매물은 어떻게 등록하나요?');
      const b = await make('허위매물은 어떻게 신고하나요?');
      const c = await make('회원 탈퇴는?', FaqCategory.ACCOUNT);
      expect([a.body.sortOrder, b.body.sortOrder, c.body.sortOrder]).toEqual([0, 1, 0]);

      await as(t, session, 'put', '/admin/faqs/order')
        .send({ ids: [b.body.id, a.body.id] })
        .expect(200);
      const listing = await t.http().get(api('/faqs?category=LISTING')).expect(200);
      expect(pluck(listing.body.items, 'id')).toEqual([b.body.id, a.body.id]);
      expect(await auditRows(t, 'faq.reorder')).toHaveLength(1);

      await as(t, session, 'patch', `/admin/faqs/${c.body.id}`)
        .send({ isPublished: false })
        .expect(200);
      expect((await t.http().get(api('/faqs')).expect(200)).body.total).toBe(2);
      expect((await t.http().get(api('/faqs?q=신고')).expect(200)).body.total).toBe(1);
      expect(
        (await as(t, session, 'get', '/admin/faqs?isPublished=false').expect(200)).body.total,
      ).toBe(1);
      await as(t, session, 'get', `/admin/faqs/${c.body.id}`).expect(200);
      await as(t, session, 'delete', `/admin/faqs/${c.body.id}`).expect(204);
      await as(t, session, 'get', `/admin/faqs/${c.body.id}`).expect(404);
    });

    it('validation failures (400)', async () => {
      const { session } = await adminActor(t, AdminRole.OPERATOR);
      await as(t, session, 'post', '/admin/faqs')
        .send({ category: 'NOPE', question: 'q', answer: 'a' })
        .expect(400);
      await as(t, session, 'post', '/admin/faqs')
        .send({ category: FaqCategory.LISTING, question: 'q', answer: '<svg onload=alert(1)>' })
        .expect(400);
      const unknown = await as(t, session, 'put', '/admin/faqs/order')
        .send({ ids: ['01890a5d-ac96-774b-bcce-b302099a8057'] })
        .expect(400);
      expectCode(unknown, ErrorCode.FAQ_ORDER_INVALID);
      await as(t, session, 'put', '/admin/faqs/order').send({ ids: [] }).expect(400);
      await t.http().get(api('/faqs?category=NOPE')).expect(400);
    });

    it('authz', async () => {
      await expectAdminAuthz(t, 'get', '/admin/faqs', { userSession });
      await expectAdminAuthz(t, 'post', '/admin/faqs', {
        userSession,
        body: { category: 'GENERAL', question: 'q', answer: 'a' },
      });
      await expectAdminAuthz(t, 'put', '/admin/faqs/order', { userSession, body: { ids: [] } });
      const { session } = await adminActor(t);
      const { body } = await as(t, session, 'post', '/admin/faqs')
        .send({ category: 'GENERAL', question: 'q', answer: 'a' })
        .expect(201);
      await expectAdminAuthz(t, 'get', `/admin/faqs/${body.id}`, { userSession });
      await expectAdminAuthz(t, 'patch', `/admin/faqs/${body.id}`, {
        userSession,
        body: { answer: 'b' },
      });
      await expectAdminAuthz(t, 'delete', `/admin/faqs/${body.id}`, { userSession });
    });
  });

  describe('local videos', () => {
    it('admin CRUD with YouTube parsing + public list', async () => {
      const complex = await createComplex(t.prisma);
      const { session } = await adminActor(t, AdminRole.OPERATOR);
      const created = await as(t, session, 'post', '/admin/videos')
        .send({ title: '순천만 국가정원 산책', youtubeUrl: VIDEO_URL, complexId: complex.id })
        .expect(201);
      expect(created.body).toMatchObject({
        youtubeVideoId: 'dQw4w9WgXcQ',
        thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        complexId: complex.id,
        isPublished: true,
      });
      const pub = await t
        .http()
        .get(api(`/videos?complexId=${complex.id}`))
        .expect(200);
      expect(pub.body.items).toHaveLength(1);
      expect(pub.body.items[0]).not.toHaveProperty('isPublished');

      const updated = await as(t, session, 'patch', `/admin/videos/${created.body.id}`)
        .send({ youtubeUrl: 'https://youtu.be/9bZkp7q19f0', complexId: null })
        .expect(200);
      expect(updated.body).toMatchObject({ youtubeVideoId: '9bZkp7q19f0', complexId: null });
      expect((await auditRows(t, 'video.update'))[0]?.before).toMatchObject({
        youtubeVideoId: 'dQw4w9WgXcQ',
      });
      await as(t, session, 'get', `/admin/videos/${created.body.id}`).expect(200);
      expect((await as(t, session, 'get', '/admin/videos?q=정원').expect(200)).body.total).toBe(1);
      await as(t, session, 'delete', `/admin/videos/${created.body.id}`).expect(204);
      expect((await t.http().get(api('/videos')).expect(200)).body.total).toBe(0);
    });

    it('validation failures (400)', async () => {
      const { session } = await adminActor(t, AdminRole.OPERATOR);
      for (const youtubeUrl of [
        'https://vimeo.com/123',
        'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'javascript:alert(1)',
        'https://www.youtube.com/watch?v=short',
      ]) {
        await as(t, session, 'post', '/admin/videos').send({ title: 'x', youtubeUrl }).expect(400);
      }
      const res = await as(t, session, 'post', '/admin/videos')
        .send({
          title: 'x',
          youtubeUrl: VIDEO_URL,
          complexId: '01890a5d-ac96-774b-bcce-b302099a8057',
        })
        .expect(400);
      expectCode(res, ErrorCode.VIDEO_COMPLEX_NOT_FOUND);
      await t.http().get(api('/videos?regionCode=abc')).expect(400);
    });

    it('authz', async () => {
      await expectAdminAuthz(t, 'get', '/admin/videos', { userSession });
      await expectAdminAuthz(t, 'post', '/admin/videos', {
        userSession,
        body: { title: 'x', youtubeUrl: VIDEO_URL },
      });
      const { session } = await adminActor(t);
      const { body } = await as(t, session, 'post', '/admin/videos')
        .send({ title: 'x', youtubeUrl: VIDEO_URL })
        .expect(201);
      await expectAdminAuthz(t, 'get', `/admin/videos/${body.id}`, { userSession });
      await expectAdminAuthz(t, 'patch', `/admin/videos/${body.id}`, {
        userSession,
        body: { title: 'y' },
      });
      await expectAdminAuthz(t, 'delete', `/admin/videos/${body.id}`, { userSession });
    });
  });

  describe('site settings', () => {
    const businessInfo = {
      companyName: '순천부동산(주)',
      ceoName: '홍길동',
      businessNumber: '123-45-67890',
      mailOrderNumber: '제2026-전남순천-0001호',
      address: '전남광주통합특별시 순천시 중앙로 1',
      privacyOfficer: '김개인',
      phone: '061-123-4567',
      email: 'help@example.com',
      // 전자상거래법 시행령 제7조 표시사항, rendered in the user-site footer.
      hostingProvider: '테스트클라우드 주식회사',
    };

    it('ADMIN reads/writes settings; public bundle is cached and invalidated', async () => {
      const { admin, session } = await adminActor(t, AdminRole.ADMIN);
      const empty = await as(t, session, 'get', '/admin/site-settings').expect(200);
      expect(pluck(empty.body, 'key')).toEqual(Object.values(SiteSettingKey));
      expect(empty.body[0]).toMatchObject({ value: null, updatedAt: null });

      expect((await t.http().get(api('/site-settings/public')).expect(200)).body).toEqual({});
      const put = await as(
        t,
        session,
        'put',
        `/admin/site-settings/${SiteSettingKey.BUSINESS_INFO}`,
      )
        .send(businessInfo)
        .expect(200);
      expect(put.body).toMatchObject({ value: businessInfo, updatedBy: { id: admin.id } });
      const pub = await t.http().get(api('/site-settings/public')).expect(200);
      expect(pub.body).toEqual({ BUSINESS_INFO: businessInfo });

      await as(t, session, 'put', '/admin/site-settings/FOOTER')
        .send({ links: [{ label: '이용약관', url: '/terms/SERVICE' }], copyright: '© 2026' })
        .expect(200);
      const again = await t.http().get(api('/site-settings/public')).expect(200);
      expect(again.body.FOOTER).toEqual({
        links: [{ label: '이용약관', url: '/terms/SERVICE', newWindow: false }],
        copyright: '© 2026',
      });
      const one = await as(t, session, 'get', '/admin/site-settings/FOOTER').expect(200);
      expect(one.body.key).toBe('FOOTER');

      const audits = await auditRows(t, 'site-setting.update');
      expect(audits.map((a) => a.resourceId)).toEqual(['BUSINESS_INFO', 'FOOTER']);
      expect(audits[0]?.before).toMatchObject({ value: null });
    });

    it('HOME_LAYOUT and APP_LINKS (D9) are validated and served publicly', async () => {
      const { session } = await adminActor(t, AdminRole.ADMIN);
      const layout = {
        sections: [
          { key: 'HERO_SEARCH', visible: true },
          { key: 'MAIN_BANNER', visible: true },
          { key: 'CATEGORY_TILES', visible: true },
          { key: 'POPULAR_COMPLEXES', visible: false },
          { key: 'NEW_LISTINGS', visible: true },
          { key: 'DEAL_REQUEST_CTA', visible: true },
          { key: 'FEATURED_AGENCIES', visible: true },
          { key: 'LOCAL_VIDEOS', visible: true },
          { key: 'NOTICES', visible: true },
          { key: 'APP_BAND', visible: true },
        ],
      };
      await as(t, session, 'put', '/admin/site-settings/HOME_LAYOUT').send(layout).expect(200);
      const links = {
        iosUrl: 'https://apps.apple.com/kr/app/id0000000000',
        androidUrl: null,
      };
      const put = await as(t, session, 'put', '/admin/site-settings/APP_LINKS')
        .send(links)
        .expect(200);
      // null clears a link (stored without the key).
      expect(put.body.value).toEqual({ iosUrl: links.iosUrl });
      const pub = await t.http().get(api('/site-settings/public')).expect(200);
      expect(pub.body).toEqual({ HOME_LAYOUT: layout, APP_LINKS: { iosUrl: links.iosUrl } });

      for (const bad of [
        { sections: [] },
        { sections: [{ key: 'UNKNOWN', visible: true }] },
        {
          sections: [
            { key: 'NOTICES', visible: true },
            { key: 'NOTICES', visible: false },
          ],
        },
        { sections: [{ key: 'NOTICES', visible: 'yes' }] },
      ]) {
        const res = await as(t, session, 'put', '/admin/site-settings/HOME_LAYOUT')
          .send(bad)
          .expect(400);
        expectCode(res, ErrorCode.SETTING_INVALID);
      }
      for (const iosUrl of [
        'http://apps.apple.com/app',
        'javascript:alert(1)',
        '/relative/path',
        'https://user:pw@apps.apple.com/app',
        'https://apps.apple.com\\@evil.example/app',
      ]) {
        const res = await as(t, session, 'put', '/admin/site-settings/APP_LINKS')
          .send({ iosUrl })
          .expect(400);
        expectCode(res, ErrorCode.SETTING_INVALID);
        expect(res.body.details[0].path).toBe('iosUrl');
      }
    });

    it('validation failures (400)', async () => {
      const { session } = await adminActor(t, AdminRole.ADMIN);
      const bad = await as(t, session, 'put', '/admin/site-settings/BUSINESS_INFO')
        .send({ ...businessInfo, businessNumber: '12-34' })
        .expect(400);
      expectCode(bad, ErrorCode.SETTING_INVALID);
      expect(bad.body.details[0].path).toBe('businessNumber');
      await as(t, session, 'put', '/admin/site-settings/NOPE').send({}).expect(400);
      await as(t, session, 'get', '/admin/site-settings/NOPE').expect(400);
      await as(t, session, 'put', '/admin/site-settings/CONTACT')
        .send({ phone: '1588-0000', email: 'a@b.co', kakaoChannelUrl: 'javascript:x' })
        .expect(400);
      // Backslashes / control characters would turn a site path into an off-site link.
      for (const url of ['/\\evil.example', '/\t/evil.example']) {
        const footer = await as(t, session, 'put', '/admin/site-settings/FOOTER')
          .send({ links: [{ label: '이용약관', url }] })
          .expect(400);
        expectCode(footer, ErrorCode.SETTING_INVALID);
      }
    });

    it('authz: ADMIN+ only (operators get 403)', async () => {
      await expectAdminAuthz(t, 'get', '/admin/site-settings', {
        userSession,
        lowRole: AdminRole.OPERATOR,
      });
      await expectAdminAuthz(t, 'get', '/admin/site-settings/SEO', {
        userSession,
        lowRole: AdminRole.OPERATOR,
      });
      await expectAdminAuthz(t, 'put', '/admin/site-settings/SEO', {
        userSession,
        lowRole: AdminRole.OPERATOR,
        body: { title: 't', description: 'd' },
      });
    });
  });
});
