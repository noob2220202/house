import { AdminRole, ErrorCode, MediaPurpose } from '@house/shared';
import {
  createComplex,
  createMedia,
  createUser,
  loginUser,
  resetAll,
  withSession,
  type TestApp,
  type TestSession,
} from '../../utils';
import {
  adminSession,
  createComplexesApp,
  FakeTradeApi,
  insertTrade,
  NIL_UUID,
  seedBuyoung,
  seedRegions,
} from './helpers';

const BASE = '/api/v1/admin/complexes';

const validComplex = {
  name: '순천 신대 중흥S-클래스',
  assetType: 'APT',
  roadAddress: '전라남도 순천시 해룡면 향매로 100',
  jibunAddress: '전라남도 순천시 해룡면 신대리 2000',
  emdCode: '46150310',
  lat: 34.9312,
  lng: 127.5503,
  households: 1000,
  parkingTotal: 1450,
  approvalDate: '2016-11-30',
  externalCode: '46150-777',
  areaTypes: [
    { exclusiveArea: 84.99, supplyArea: 112.5, typeName: '84A', rooms: 3, baths: 2 },
    { exclusiveArea: 59.9, typeName: '59' },
  ],
};

describe('complexes: admin API (e2e)', () => {
  let t: TestApp;
  let admin: TestSession;
  let operator: TestSession;

  beforeAll(async () => {
    t = await createComplexesApp(new FakeTradeApi());
  });
  beforeEach(async () => {
    await resetAll(t);
    await seedRegions(t);
    admin = await adminSession(t, AdminRole.ADMIN);
    operator = await adminSession(t, AdminRole.OPERATOR);
  });
  afterAll(() => t?.close());

  async function expectAdminOnly(
    method: 'get' | 'post' | 'patch' | 'put' | 'delete',
    url: string,
    body: object = {},
  ) {
    await t.http()[method](url).send(body).expect(401);
    const user = await createUser(t.prisma);
    await withSession(t.http()[method](url), await loginUser(t.app, user))
      .send(body)
      .expect(401);
    const noMfa = await adminSession(t, AdminRole.SUPER_ADMIN, { mfaVerified: false });
    const r = await withSession(t.http()[method](url), noMfa).send(body).expect(401);
    expect(r.body.code).toBe(ErrorCode.AUTH_TOTP_REQUIRED);
  }

  describe('POST /admin/complexes', () => {
    it('creates a 단지 with 평형, derives 법정동/지번/준공년도/세대당 주차, audits, invalidates search cache', async () => {
      const before = await t
        .http()
        .get(`/api/v1/complexes/autocomplete?q=${encodeURIComponent('중흥')}`)
        .expect(200);
      expect(before.body.complexes).toEqual([]);

      const r = await withSession(t.http().post(BASE), operator).send(validComplex).expect(201);
      expect(r.body).toMatchObject({
        name: '순천 신대 중흥S-클래스',
        sggCode: '46150',
        emdCode: '46150310',
        emdName: '신대리',
        jibun: '2000',
        builtYear: 2016,
        approvalYear: 2016,
        approvalDate: '2016-11-30',
        parkingPerHousehold: 1.45,
        externalCode: '46150-777',
        region: { code: '46150310', name: '해룡면' },
        tradeCount: 0,
        deletedAt: null,
      });
      expect(r.body.areaTypes).toEqual([
        expect.objectContaining({
          exclusiveArea: 59.9,
          typeName: '59',
          pyeongLabel: '18평',
          supplyArea: null,
        }),
        expect.objectContaining({ exclusiveArea: 84.99, pyeongLabel: '34평', rooms: 3, baths: 2 }),
      ]);
      const audit = await t.prisma.auditLog.findFirstOrThrow({
        where: { action: 'complex.create' },
      });
      expect(audit).toMatchObject({
        resourceType: 'Complex',
        resourceId: r.body.id,
        actorType: 'ADMIN',
      });

      const after = await t
        .http()
        .get(`/api/v1/complexes/autocomplete?q=${encodeURIComponent('중흥')}`)
        .expect(200);
      expect((after.body.complexes as { id: string }[]).map((c) => c.id)).toEqual([r.body.id]);
    });

    it('400 for invalid input / regions outside the service area; 409 for duplicates', async () => {
      const post = (body: object) => withSession(t.http().post(BASE), admin).send(body);
      expect((await post({ ...validComplex, name: '' }).expect(400)).body.code).toBe(
        ErrorCode.VALIDATION_FAILED,
      );
      await post({ ...validComplex, lat: 10 }).expect(400);
      await post({ ...validComplex, assetType: 'LAND' }).expect(400);
      await post({ ...validComplex, approvalDate: '2016/11/30' }).expect(400);
      expect((await post({ ...validComplex, emdCode: '46130101' }).expect(400)).body.code).toBe(
        ErrorCode.COMPLEX_REGION_INVALID,
      );
      expect((await post({ ...validComplex, emdCode: '46150999' }).expect(400)).body.code).toBe(
        ErrorCode.COMPLEX_REGION_INVALID,
      );
      await post(validComplex).expect(201);
      expect((await post({ ...validComplex, name: '다른이름' }).expect(409)).body.code).toBe(
        ErrorCode.COMPLEX_EXTERNAL_CODE_DUPLICATE,
      );
      const dupAreas = {
        ...validComplex,
        externalCode: null,
        areaTypes: [{ exclusiveArea: 84.99 }, { exclusiveArea: 84.99 }],
      };
      expect((await post(dupAreas).expect(409)).body.code).toBe(
        ErrorCode.COMPLEX_AREA_TYPE_DUPLICATE,
      );
      expect(await t.prisma.complex.count()).toBe(1);
    });

    it('authz', async () => {
      await expectAdminOnly('post', BASE, validComplex);
      await t
        .http()
        .post(BASE)
        .set('Cookie', admin.cookie)
        .set('Origin', admin.origin)
        .send(validComplex)
        .expect(403);
      expect(await t.prisma.complex.count()).toBe(0);
    });
  });

  describe('GET /admin/complexes[/:id]', () => {
    it('lists (optionally with deleted / missing 국토교통부 code) and shows admin-only fields', async () => {
      const { complex } = await seedBuyoung(t, { externalCode: '46150-1001' });
      const gone = await createComplex(t.prisma, { name: '철거단지', deletedAt: new Date() });
      await insertTrade(t, { complexId: complex.id });

      const list = await withSession(t.http().get(BASE), operator).expect(200);
      expect((list.body.items as { id: string }[]).map((c) => c.id)).toEqual([complex.id]);
      const withDeleted = await withSession(
        t.http().get(`${BASE}?includeDeleted=true`),
        operator,
      ).expect(200);
      expect(withDeleted.body.total).toBe(2);
      const missing = await withSession(
        t.http().get(`${BASE}?missingExternalCode=true&includeDeleted=true`),
        operator,
      ).expect(200);
      expect((missing.body.items as { id: string }[]).map((c) => c.id)).toEqual([gone.id]);
      const q = await withSession(
        t.http().get(`${BASE}?q=${encodeURIComponent('연향')}`),
        operator,
      ).expect(200);
      expect(q.body.total).toBe(1);

      const one = await withSession(t.http().get(`${BASE}/${complex.id}`), operator).expect(200);
      expect(one.body).toMatchObject({
        jibun: '1234-5',
        externalCode: '46150-1001',
        tradeCount: 1,
      });
      const deleted = await withSession(t.http().get(`${BASE}/${gone.id}`), operator).expect(200);
      expect(deleted.body.deletedAt).not.toBeNull();
    });

    it('authz, 404 and validation', async () => {
      await expectAdminOnly('get', BASE);
      await expectAdminOnly('get', `${BASE}/${NIL_UUID}`);
      await withSession(t.http().get(`${BASE}/${NIL_UUID}`), operator).expect(404);
      await withSession(t.http().get(`${BASE}/nope`), operator).expect(400);
      await withSession(t.http().get(`${BASE}?includeDeleted=maybe`), operator).expect(400);
    });
  });

  describe('PATCH /admin/complexes/:id', () => {
    it('updates fields, re-derives 지번 from a new 지번주소 and audits before/after', async () => {
      const { complex } = await seedBuyoung(t);
      const r = await withSession(t.http().patch(`${BASE}/${complex.id}`), operator)
        .send({
          name: '연향 부영 3차',
          approvalDate: '1999-01-15',
          jibunAddress: '전라남도 순천시 연향동 1240',
        })
        .expect(200);
      expect(r.body).toMatchObject({
        name: '연향 부영 3차',
        builtYear: 1999,
        jibun: '1240',
        emdName: '연향동',
      });
      const audit = await t.prisma.auditLog.findFirstOrThrow({
        where: { action: 'complex.update' },
      });
      expect(audit.resourceId).toBe(complex.id);
      expect(audit.before).toMatchObject({ name: '연향부영3차' });
      expect(audit.after).toMatchObject({ name: '연향 부영 3차' });
    });

    it('400 for empty/invalid patches, 404 for deleted 단지, authz', async () => {
      const { complex } = await seedBuyoung(t);
      await withSession(t.http().patch(`${BASE}/${complex.id}`), operator)
        .send({})
        .expect(400);
      await withSession(t.http().patch(`${BASE}/${complex.id}`), operator)
        .send({ floorsMin: 20, floorsMax: 3 })
        .expect(400);
      await withSession(t.http().patch(`${BASE}/${complex.id}`), operator)
        .send({ jibun: '12-34-5' })
        .expect(400);
      const gone = await createComplex(t.prisma, { deletedAt: new Date() });
      await withSession(t.http().patch(`${BASE}/${gone.id}`), operator)
        .send({ name: 'x' })
        .expect(404);
      await expectAdminOnly('patch', `${BASE}/${complex.id}`, { name: 'x' });
    });
  });

  describe('DELETE /admin/complexes/:id', () => {
    it('soft-deletes (ADMIN only), releases the 국토교통부 code and hides it publicly', async () => {
      const { complex } = await seedBuyoung(t, { externalCode: '46150-1001' });
      const r = await withSession(t.http().delete(`${BASE}/${complex.id}`), operator).expect(403);
      expect(r.body.code).toBe(ErrorCode.FORBIDDEN);
      await withSession(t.http().delete(`${BASE}/${complex.id}`), admin).expect(204);
      const row = await t.prisma.complex.findUniqueOrThrow({ where: { id: complex.id } });
      expect(row.deletedAt).not.toBeNull();
      expect(row.externalCode).toBeNull();
      await t.http().get(`/api/v1/complexes/${complex.id}`).expect(404);
      await withSession(t.http().delete(`${BASE}/${complex.id}`), admin).expect(404);
      expect(
        await t.prisma.auditLog.count({
          where: { action: 'complex.delete', resourceId: complex.id },
        }),
      ).toBe(1);
    });

    it('authz and validation', async () => {
      await expectAdminOnly('delete', `${BASE}/${NIL_UUID}`);
      await withSession(t.http().delete(`${BASE}/x`), admin).expect(400);
    });
  });

  describe('평형 (area types)', () => {
    it('adds a 평형 (assigning matching unassigned trades), updates and deletes it', async () => {
      const { complex, at84 } = await seedBuyoung(t);
      const trade = await insertTrade(t, {
        complexId: complex.id,
        exclusiveArea: '114.8',
        price: 30000,
      });
      const created = await withSession(t.http().post(`${BASE}/${complex.id}/area-types`), operator)
        .send({ exclusiveArea: 114.9, supplyArea: 145.2, typeName: '115' })
        .expect(201);
      expect(created.body).toMatchObject({
        exclusiveArea: 114.9,
        pyeongLabel: '44평',
        typeName: '115',
      });
      const assigned = await t.prisma.tradeRecord.findUniqueOrThrow({ where: { id: trade.id } });
      expect(assigned.areaTypeId).toBe(created.body.id);
      expect(await t.prisma.complexTradeStat.count({ where: { complexId: complex.id } })).toBe(1);

      const dup = await withSession(t.http().post(`${BASE}/${complex.id}/area-types`), operator)
        .send({ exclusiveArea: 84.97, typeName: '84A' })
        .expect(409);
      expect(dup.body.code).toBe(ErrorCode.COMPLEX_AREA_TYPE_DUPLICATE);

      const upd = await withSession(
        t.http().patch(`${BASE}/${complex.id}/area-types/${at84.id}`),
        operator,
      )
        .send({ pyeongLabel: '34평형', households: 300 })
        .expect(200);
      expect(upd.body).toMatchObject({ pyeongLabel: '34평형', households: 300 });

      await withSession(
        t.http().delete(`${BASE}/${complex.id}/area-types/${created.body.id}`),
        operator,
      ).expect(204);
      expect(
        (await t.prisma.tradeRecord.findUniqueOrThrow({ where: { id: trade.id } })).areaTypeId,
      ).toBeNull();
      expect(
        await t.prisma.auditLog.count({ where: { action: { startsWith: 'complex.area-type.' } } }),
      ).toBe(3);
    });

    it('404 for a 평형 of another 단지, 400 for invalid input, authz', async () => {
      const { complex } = await seedBuyoung(t);
      const other = await seedBuyoung(t, { name: '다른단지' });
      const url = `${BASE}/${complex.id}/area-types/${other.at84.id}`;
      expect(
        (await withSession(t.http().patch(url), operator).send({ typeName: 'x' }).expect(404)).body
          .code,
      ).toBe(ErrorCode.COMPLEX_AREA_TYPE_NOT_FOUND);
      await withSession(t.http().delete(url), operator).expect(404);
      await withSession(t.http().post(`${BASE}/${NIL_UUID}/area-types`), operator)
        .send({ exclusiveArea: 84 })
        .expect(404);
      await withSession(t.http().post(`${BASE}/${complex.id}/area-types`), operator)
        .send({ exclusiveArea: -1 })
        .expect(400);
      await withSession(
        t.http().patch(`${BASE}/${complex.id}/area-types/${other.at84.id}`),
        operator,
      )
        .send({})
        .expect(400);
      await withSession(t.http().delete(`${BASE}/${complex.id}/area-types/bad`), operator).expect(
        400,
      );
      await expectAdminOnly('post', `${BASE}/${complex.id}/area-types`, { exclusiveArea: 84 });
      await expectAdminOnly('delete', url);
    });
  });

  describe('PUT /admin/complexes/:id/photos', () => {
    it('replaces the ordered photo list with usable 단지 photos only', async () => {
      const { complex } = await seedBuyoung(t);
      const m1 = await createMedia(t.prisma, { purpose: MediaPurpose.COMPLEX_PHOTO });
      const m2 = await createMedia(t.prisma, { purpose: MediaPurpose.COMPLEX_PHOTO });
      const url = `${BASE}/${complex.id}/photos`;
      const r = await withSession(t.http().put(url), operator)
        .send({ items: [{ mediaId: m2.id, caption: '전경' }, { mediaId: m1.id }] })
        .expect(200);
      expect(
        (r.body as { mediaId: string; sortOrder: number }[]).map((p) => [p.mediaId, p.sortOrder]),
      ).toEqual([
        [m2.id, 0],
        [m1.id, 1],
      ]);
      const cleared = await withSession(t.http().put(url), operator)
        .send({ items: [{ mediaId: m1.id }] })
        .expect(200);
      expect(cleared.body).toHaveLength(1);

      const listingPhoto = await createMedia(t.prisma, { purpose: MediaPurpose.LISTING_PHOTO });
      const pending = await createMedia(t.prisma, {
        purpose: MediaPurpose.COMPLEX_PHOTO,
        status: 'PENDING',
      });
      for (const bad of [listingPhoto.id, pending.id, NIL_UUID]) {
        const res = await withSession(t.http().put(url), operator)
          .send({ items: [{ mediaId: bad }] })
          .expect(400);
        expect(res.body.code).toBe(ErrorCode.COMPLEX_MEDIA_INVALID);
      }
      expect(await t.prisma.complexPhoto.count({ where: { complexId: complex.id } })).toBe(1);
    });

    it('400 for duplicates / bad ids, 404 for unknown 단지, authz', async () => {
      const { complex } = await seedBuyoung(t);
      const m = await createMedia(t.prisma, { purpose: MediaPurpose.COMPLEX_PHOTO });
      const url = `${BASE}/${complex.id}/photos`;
      await withSession(t.http().put(url), operator)
        .send({ items: [{ mediaId: m.id }, { mediaId: m.id }] })
        .expect(400);
      await withSession(t.http().put(url), operator)
        .send({ items: [{ mediaId: 'x' }] })
        .expect(400);
      await withSession(t.http().put(`${BASE}/${NIL_UUID}/photos`), operator)
        .send({ items: [] })
        .expect(404);
      await expectAdminOnly('put', url, { items: [] });
    });
  });

  describe('admin regions', () => {
    it('POST /admin/regions/seed-default is idempotent (ADMIN only)', async () => {
      const r = await withSession(
        t.http().post('/api/v1/admin/regions/seed-default'),
        admin,
      ).expect(200);
      expect(r.body).toEqual({ upserted: 209 });
      await withSession(t.http().post('/api/v1/admin/regions/seed-default'), admin).expect(200);
      expect(await t.prisma.region.count()).toBe(209);
      await withSession(t.http().post('/api/v1/admin/regions/seed-default'), operator).expect(403);
      await expectAdminOnly('post', '/api/v1/admin/regions/seed-default');
    });

    it('PUT /admin/regions/:code upserts with parent checks and refreshes the cached list', async () => {
      const list = await t.http().get('/api/v1/regions').expect(200);
      expect(
        (list.body as { code: string; lat: number | null }[]).find((x) => x.code === '46150114')
          ?.lat,
      ).toBeNull();
      const r = await withSession(t.http().put('/api/v1/admin/regions/46150114'), admin)
        .send({
          name: '연향동',
          fullName: '전라남도 순천시 연향동',
          level: 'EMD',
          parentCode: '46150',
          lat: 34.958,
          lng: 127.522,
        })
        .expect(200);
      expect(r.body).toMatchObject({ code: '46150114', lat: 34.958 });
      const after = await t.http().get('/api/v1/regions').expect(200);
      expect(
        (after.body as { code: string; lat: number | null }[]).find((x) => x.code === '46150114')
          ?.lat,
      ).toBe(34.958);
      expect(
        await t.prisma.auditLog.count({
          where: { action: 'region.upsert', resourceId: '46150114' },
        }),
      ).toBe(1);

      const put = (code: string, body: object) =>
        withSession(t.http().put(`/api/v1/admin/regions/${code}`), admin).send(body);
      const emd = {
        name: '신규동',
        fullName: '전라남도 순천시 신규동',
        level: 'EMD',
        parentCode: '46150',
      };
      await put('4615019999', emd).expect(400); // 10-digit code is not an EMD
      expect((await put('46150199', { ...emd, parentCode: '46130' }).expect(400)).body.code).toBe(
        ErrorCode.REGION_PARENT_INVALID,
      );
      expect((await put('46130199', { ...emd, parentCode: '46130' }).expect(400)).body.code).toBe(
        ErrorCode.REGION_PARENT_INVALID,
      );
      await put('46150199', { ...emd, level: 'TOWN' }).expect(400);
      await put('abc', emd).expect(400);
      await put('46150199', emd).expect(200);
      await withSession(t.http().put('/api/v1/admin/regions/46150199'), operator)
        .send(emd)
        .expect(403);
      await expectAdminOnly('put', '/api/v1/admin/regions/46150199', emd);
    });
  });
});
