import { AgencyStatus } from '@house/shared';
import { createAgency, createComplex, createListing, resetAll, type TestApp } from '../../utils';
import { createHomeApp, JORYE, seedRegions } from './helpers';

describe('home: GET /search/suggest (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createHomeApp();
  });
  beforeEach(async () => {
    await resetAll(t);
    await seedRegions(t);
  });
  afterAll(() => t?.close());

  it('an empty query answers no items, only popular keywords', async () => {
    const { agency } = await createAgency(t.prisma);
    await createListing(t.prisma, { agencyId: agency.id, property: { emdCode: JORYE } });
    const c = await createComplex(t.prisma, { name: '순천레이크파크', viewCount: 50 });
    const res = await t.http().get('/api/v1/search/suggest?q=').expect(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.popular).toEqual(expect.arrayContaining(['조례동', c.name]));
  });

  it('suggests 지역, then 단지, then 중개사무소', async () => {
    const complex = await createComplex(t.prisma, {
      name: '조례호수아파트',
      emdName: '조례동',
      households: 1200,
      lat: 34.958,
      lng: 127.524,
    });
    const { agency } = await createAgency(t.prisma, {
      name: '조례공인중개사사무소',
      roadAddress: '전남광주통합특별시 순천시 조례1길 12',
      lat: 34.959,
      lng: 127.521,
    });
    // Not disclosable → never suggested.
    await createAgency(t.prisma, { name: '조례부동산', status: AgencyStatus.SUSPENDED });

    const res = await t.http().get('/api/v1/search/suggest').query({ q: '조례' }).expect(200);
    expect(res.body.items).toEqual([
      {
        type: 'REGION',
        id: JORYE,
        label: '조례동',
        description: '순천시',
        lat: null,
        lng: null,
      },
      {
        type: 'COMPLEX',
        id: complex.id,
        label: '조례호수아파트',
        description: '조례동 · 1,200세대',
        lat: 34.958,
        lng: 127.524,
      },
      {
        type: 'AGENCY',
        id: agency.id,
        label: '조례공인중개사사무소',
        description: '순천시 조례1길 12',
        lat: 34.959,
        lng: 127.521,
      },
    ]);
    expect(Array.isArray(res.body.popular)).toBe(true);
  });

  it('names the 읍면 of a 리 and honours limit', async () => {
    const res = await t.http().get('/api/v1/search/suggest?q=신대&limit=1').expect(200);
    expect(res.body.items).toEqual([
      expect.objectContaining({ type: 'REGION', label: '신대리', description: '순천시 해룡면' }),
    ]);
  });

  it('cuts long queries instead of failing', async () => {
    await t
      .http()
      .get('/api/v1/search/suggest')
      .query({ q: '가'.repeat(200) })
      .expect(200);
  });
});
