import { AdminRole } from '@house/shared';
import {
  createUser,
  loginUser,
  resetAll,
  withSession,
  type TestApp,
  type TestSession,
} from '../../utils';
import { adminSession, createHomeApp, FakeGeocoder, GeocoderUnavailableError } from './helpers';

describe('home: GET /geo/geocode + policies (e2e)', () => {
  const geocoder = new FakeGeocoder();
  let t: TestApp;
  let user: TestSession;

  beforeAll(async () => {
    t = await createHomeApp(geocoder);
  });
  beforeEach(async () => {
    await resetAll(t);
    geocoder.reset();
    user = await loginUser(t.app, await createUser(t.prisma));
  });
  afterAll(() => t?.close());

  describe('GET /geo/geocode', () => {
    const get = (query: string, s: TestSession | null = user) => {
      const req = t.http().get('/api/v1/geo/geocode').query({ query });
      return s ? withSession(req, s) : req;
    };

    it('anchors the query to 순천시, maps 법정동 codes canonically and keeps the service region', async () => {
      geocoder.hits.set('순천시 신대1로 18', [
        {
          roadAddress: '전라남도 순천시 해룡면 신대1로 18',
          jibunAddress: '전라남도 순천시 해룡면 신대리 1978',
          zipCode: '58027',
          buildingName: '신대프라자',
          lat: 34.9362,
          lng: 127.5551,
        },
        {
          roadAddress: '전라남도 여수시 신대1로 18',
          jibunAddress: null,
          zipCode: null,
          buildingName: null,
          lat: 34.76,
          lng: 127.66,
        },
      ]);
      // The geocoder may still answer the legacy 46150 code for 신대리; 여수 is outside the region.
      geocoder.codes.set('34.9362,127.5551', '4615031022');
      geocoder.codes.set('34.76,127.66', '4613010100');

      const res = await get('  신대1로   18 ').expect(200);
      expect(res.body).toEqual({
        items: [
          {
            roadAddress: '전라남도 순천시 해룡면 신대1로 18',
            jibunAddress: '전라남도 순천시 해룡면 신대리 1978',
            zipCode: '58027',
            buildingName: '신대프라자',
            lat: 34.9362,
            lng: 127.5551,
            emdCode: '1215031022',
          },
        ],
      });
      // Cached: a repeat does not call the geocoder again.
      await get('신대1로 18').expect(200);
      expect(geocoder.queries).toEqual(['순천시 신대1로 18']);
    });

    it('uses the 법정동 code of the address answer (Kakao b_code) without a reverse lookup', async () => {
      geocoder.hits.set('순천시 연향3로 41', [
        {
          roadAddress: '전남 순천시 연향3로 41',
          jibunAddress: '전남 순천시 연향동 1350',
          zipCode: '57990',
          buildingName: null,
          lat: 34.9466,
          lng: 127.5161,
          legalCode: '4615011400',
        },
      ]);
      const res = await get('연향3로 41').expect(200);
      expect(res.body.items).toEqual([
        {
          roadAddress: '전남 순천시 연향3로 41',
          jibunAddress: '전남 순천시 연향동 1350',
          zipCode: '57990',
          buildingName: null,
          lat: 34.9466,
          lng: 127.5161,
          // b_code 1215011400 is stored as the 8-digit 읍면동 code.
          emdCode: '12150114',
        },
      ]);
      expect(res.body.items[0]).not.toHaveProperty('legalCode');
      expect(geocoder.reverseLookups).toEqual([]);
    });

    it('400 for a too short / too long query, 401 anonymous', async () => {
      const short = await get(' 가 ').expect(400);
      expect(short.body.code).toBe('VALIDATION_FAILED');
      expect(short.body.details[0]).toMatchObject({
        path: 'query',
        message: '검색어를 2자 이상 입력해 주세요.',
      });
      await get('가'.repeat(101)).expect(400);
      await get('신대1로', null).expect(401);
      expect(geocoder.queries).toEqual([]);
    });

    it('503 GEOCODE_UNAVAILABLE without API keys or when the geocoder fails', async () => {
      geocoder.configured = false;
      const off = await get('신대1로').expect(503);
      expect(off.body.code).toBe('GEOCODE_UNAVAILABLE');
      expect(off.body.message).toContain('주소 검색');

      geocoder.configured = true;
      geocoder.failWith = new GeocoderUnavailableError('HTTP 500');
      const failed = await get('신대1로').expect(503);
      expect(failed.body.code).toBe('GEOCODE_UNAVAILABLE');
    });
  });

  describe('GET /policies/:slug + /admin/policies', () => {
    const body = {
      slug: 'false-listing',
      version: '1.0',
      title: '허위매물 신고 정책',
      content: '## 허위매물이란\n- 실제로 없는 매물',
      effectiveAt: '2026-01-01T00:00:00+09:00',
    };

    it('404 until published, then serves the version in force', async () => {
      const missing = await t.http().get('/api/v1/policies/false-listing').expect(404);
      expect(missing.body).toMatchObject({
        code: 'POLICY_NOT_FOUND',
        message: '정책 문서를 찾을 수 없습니다.',
      });

      const admin = await adminSession(t);
      const created = await withSession(t.http().post('/api/v1/admin/policies'), admin)
        .send(body)
        .expect(201);
      expect(created.body).toMatchObject({
        slug: 'false-listing',
        publishedAt: null,
        isCurrent: false,
      });
      await t.http().get('/api/v1/policies/false-listing').expect(404);

      await withSession(t.http().post(`/api/v1/admin/policies/${created.body.id}/publish`), admin)
        .send({})
        .expect(200);
      const res = await t.http().get('/api/v1/policies/false-listing').expect(200);
      expect(res.body).toEqual({
        slug: 'false-listing',
        title: '허위매물 신고 정책',
        version: '1.0',
        effectiveAt: '2025-12-31T15:00:00.000Z',
        content: body.content,
      });
      expect(
        await t.prisma.auditLog.count({ where: { action: { startsWith: 'policy.' } } }),
      ).toBeGreaterThanOrEqual(2);

      // Published versions are immutable; an announced (future) version is not served yet.
      await withSession(t.http().patch(`/api/v1/admin/policies/${created.body.id}`), admin)
        .send({ title: '바꿈' })
        .expect(409);
      const next = await withSession(t.http().post('/api/v1/admin/policies'), admin)
        .send({ ...body, version: '2.0', effectiveAt: '2099-01-01T00:00:00+09:00' })
        .expect(201);
      await withSession(t.http().post(`/api/v1/admin/policies/${next.body.id}/publish`), admin)
        .send({})
        .expect(200);
      expect((await t.http().get('/api/v1/policies/false-listing').expect(200)).body.version).toBe(
        '1.0',
      );
      const list = await withSession(
        t.http().get('/api/v1/admin/policies?slug=false-listing'),
        admin,
      ).expect(200);
      expect(
        (list.body.items as { version: string; isCurrent: boolean }[]).map((p) => [
          p.version,
          p.isCurrent,
        ]),
      ).toEqual([
        ['2.0', false],
        ['1.0', true],
      ]);
    });

    it('404 for unknown or malformed slugs; admin routes need TERMS_MANAGE', async () => {
      await t.http().get('/api/v1/policies/brokerage-fee').expect(404);
      await t.http().get('/api/v1/policies/..%2Fetc').expect(404);
      const operator = await adminSession(t, AdminRole.OPERATOR);
      await withSession(t.http().post('/api/v1/admin/policies'), operator).send(body).expect(403);
      await withSession(t.http().post('/api/v1/admin/policies'), user).send(body).expect(401);
    });

    it('drafts can be edited and deleted, duplicates are refused', async () => {
      const admin = await adminSession(t);
      const created = await withSession(t.http().post('/api/v1/admin/policies'), admin)
        .send(body)
        .expect(201);
      const edited = await withSession(
        t.http().patch(`/api/v1/admin/policies/${created.body.id}`),
        admin,
      )
        .send({ content: '새 내용' })
        .expect(200);
      expect(edited.body.content).toBe('새 내용');
      await withSession(t.http().post('/api/v1/admin/policies'), admin).send(body).expect(409);
      await withSession(t.http().delete(`/api/v1/admin/policies/${created.body.id}`), admin).expect(
        204,
      );
      expect(await t.prisma.policyDocument.count()).toBe(0);
    });
  });
});
