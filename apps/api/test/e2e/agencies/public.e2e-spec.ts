import { AgencyStatus, ListingStatus, MediaPurpose } from '@house/shared';
import { AgencyCacheService } from '../../../src/modules/agencies/services/agency-cache.service';
import {
  createAgency,
  createListing,
  createMedia,
  createTestApp,
  resetAll,
  type TestApp,
} from '../../utils';
import { createAgent, pluck } from './helpers';

const BBOX = '127.3,34.8,127.7,35.1';

describe('agencies: public search, map & profile (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  async function seed() {
    await t.prisma.region.create({
      data: { code: '46150', name: '순천시', fullName: '전라남도 순천시', level: 'SGG' },
    });
    await t.prisma.region.create({
      data: {
        code: '46150101',
        name: '장천동',
        fullName: '전라남도 순천시 장천동',
        level: 'EMD',
        parentCode: '46150',
      },
    });
    const logo = await createMedia(t.prisma, {
      purpose: MediaPurpose.AGENCY_LOGO,
      storageKey: 'logos/central.webp',
    });
    const central = await createAgency(t.prisma, {
      name: '중앙공인중개사사무소',
      representativeName: '홍길동',
      roadAddress: '전라남도 순천시 중앙로 10',
      emdCode: '46150101',
      lat: 34.95,
      lng: 127.49,
      specialties: ['APT', 'ONEROOM'],
      activeListingCount: 2,
      logoMediaId: logo.id,
      businessHours: { mon: { open: '09:00', close: '18:00' } },
      intro: '아파트 전문',
    });
    const lake = await createAgency(t.prisma, {
      name: '호수부동산',
      representativeName: '김영희',
      roadAddress: '전라남도 순천시 호수공원길 5',
      lat: 34.93,
      lng: 127.52,
      specialties: ['LAND'],
      activeListingCount: 5,
    });
    const far = await createAgency(t.prisma, {
      name: '여수바다공인중개사',
      representativeName: '박철수',
      roadAddress: '전라남도 여수시 바다로 1',
      sggCode: '46130',
      lat: 34.85,
      lng: 127.66,
    });
    const pending = await createAgency(t.prisma, {
      name: '중앙신규공인중개사',
      status: AgencyStatus.PENDING,
      approvedAt: null,
    });
    return { central, lake, far, pending, logo };
  }

  describe('GET /api/v1/agencies', () => {
    it('200: lists APPROVED agencies only, sorted by listings by default', async () => {
      const { central, lake, far } = await seed();
      const res = await t.http().get('/api/v1/agencies').expect(200);
      expect(res.body.total).toBe(3);
      expect(pluck(res.body.items, 'id')).toEqual([
        lake.agency.id,
        central.agency.id,
        far.agency.id,
      ]);
      expect(res.body.items[1]).toMatchObject({
        name: '중앙공인중개사사무소',
        logoUrl: '/media/logos/central.webp',
        specialties: ['APT', 'ONEROOM'],
      });
      expect(res.body.items[1]).not.toHaveProperty('businessNumber');
    });

    it('200: filters by text (name / 대표 / address), 읍면동, 시군구, bbox and specialties', async () => {
      const { central, lake, far } = await seed();
      const ids = async (qs: string) =>
        pluck((await t.http().get(`/api/v1/agencies?${qs}`).expect(200)).body.items, 'id');
      expect(await ids(`q=${encodeURIComponent('중앙')}`)).toEqual([central.agency.id]);
      expect(await ids(`q=${encodeURIComponent('김영희')}`)).toEqual([lake.agency.id]);
      expect(await ids(`q=${encodeURIComponent('여수시')}`)).toEqual([far.agency.id]);
      expect(await ids('q=%25')).toEqual([]);
      expect(await ids('emdCode=46150101')).toEqual([central.agency.id]);
      expect(await ids('emdCode=46130')).toEqual([far.agency.id]);
      expect(await ids('bbox=127.45,34.9,127.55,35.0&sort=NAME')).toEqual([
        central.agency.id,
        lake.agency.id,
      ]);
      expect(await ids('specialties=LAND,ONEROOM&sort=NAME')).toEqual([
        central.agency.id,
        lake.agency.id,
      ]);
      const page = await t.http().get('/api/v1/agencies?pageSize=1&page=2').expect(200);
      expect(page.body).toMatchObject({ page: 2, pageSize: 1, total: 3, totalPages: 3 });
    });

    it('400 for invalid query values', async () => {
      await t.http().get('/api/v1/agencies?bbox=1,2,3').expect(400);
      await t.http().get('/api/v1/agencies?specialties=CASTLE').expect(400);
      await t.http().get('/api/v1/agencies?sort=RANDOM').expect(400);
      await t
        .http()
        .get(`/api/v1/agencies?q=${'가'.repeat(51)}`)
        .expect(400);
    });
  });

  describe('GET /api/v1/agencies/map', () => {
    it('200: 읍면동 clusters at low zoom, grid clusters at mid zoom, markers at high zoom', async () => {
      const { central } = await seed();
      const regions = await t.http().get(`/api/v1/agencies/map?bbox=${BBOX}&zoom=10`).expect(200);
      expect(regions.body.kind).toBe('REGION_CLUSTERS');
      expect(regions.body.clusters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: '46150101', name: '장천동', count: 1 }),
          expect.objectContaining({ code: '46150', name: '순천시', count: 1 }),
          expect.objectContaining({ code: '46130', name: null, count: 1 }),
        ]),
      );

      const grid = await t.http().get(`/api/v1/agencies/map?bbox=${BBOX}&zoom=14`).expect(200);
      expect(grid.body.kind).toBe('GRID_CLUSTERS');
      expect((pluck(grid.body.clusters, 'count') as number[]).reduce((n, c) => n + c, 0)).toBe(3);

      const markers = await t
        .http()
        .get(`/api/v1/agencies/map?bbox=127.45,34.9,127.55,35.0&zoom=17&specialties=APT`)
        .expect(200);
      expect(markers.body).toEqual({
        kind: 'MARKERS',
        truncated: false,
        markers: [
          {
            id: central.agency.id,
            name: '중앙공인중개사사무소',
            lat: 34.95,
            lng: 127.49,
            activeListingCount: 2,
            logoUrl: '/media/logos/central.webp',
          },
        ],
      });
    });

    it('serves cached tiles until an agency change bumps the version', async () => {
      const { central } = await seed();
      const url = `/api/v1/agencies/map?bbox=127.45,34.9,127.55,35.0&zoom=17`;
      const first = await t.http().get(url).expect(200);
      expect(first.body.markers).toHaveLength(2);
      await t.prisma.agency.update({
        where: { id: central.agency.id },
        data: { status: AgencyStatus.SUSPENDED },
      });
      expect((await t.http().get(url).expect(200)).body.markers).toHaveLength(2);
      await t.app.get(AgencyCacheService).invalidatePublic();
      expect((await t.http().get(url).expect(200)).body.markers).toHaveLength(1);
    });

    it('400 without bbox/zoom or with an oversized bbox', async () => {
      await t.http().get('/api/v1/agencies/map?zoom=12').expect(400);
      await t.http().get(`/api/v1/agencies/map?bbox=${BBOX}`).expect(400);
      await t.http().get('/api/v1/agencies/map?bbox=120,30,130,40&zoom=12').expect(400);
      await t.http().get(`/api/v1/agencies/map?bbox=${BBOX}&zoom=30`).expect(400);
    });
  });

  describe('GET /api/v1/agencies/:id', () => {
    it('200: profile with staff, listing counts, representative listings and disclosure', async () => {
      const { central, lake } = await seed();
      const agencyId = central.agency.id;
      const assistant = await createAgent(t.prisma, agencyId);
      const licensed = await createAgent(t.prisma, agencyId);
      await t.prisma.agencyMember.update({
        where: { id: licensed.memberId },
        data: { isLicensed: true, licenseNumber: '2020-전남-0001', displayName: '이중개' },
      });
      const { listing: sale } = await createListing(t.prisma, {
        agencyId,
        listing: { verifiedAt: new Date('2026-11-01T00:00:00Z'), title: '역세권 84㎡' },
      });
      const photo = await createMedia(t.prisma, {
        storageKey: 'listings/p1.webp',
        variants: { thumb: { key: 'listings/p1.thumb.webp' } },
      });
      await t.prisma.listingPhoto.create({
        data: { listingId: sale.id, mediaId: photo.id, isCover: true },
      });
      await createListing(t.prisma, {
        agencyId,
        property: { assetType: 'ONEROOM' },
        listing: { dealType: 'MONTHLY', deposit: 500, monthlyRent: 40, salePrice: null },
      });
      await createListing(t.prisma, { agencyId, listing: { status: ListingStatus.DRAFT } });
      // Co-brokered: primary is another agency, central joined as co-broker.
      const { listing: co } = await createListing(t.prisma, { agencyId: lake.agency.id });
      await t.prisma.listingAgency.create({ data: { listingId: co.id, agencyId } });

      const res = await t.http().get(`/api/v1/agencies/${agencyId}`).expect(200);
      expect(res.body).toMatchObject({
        id: agencyId,
        intro: '아파트 전문',
        businessHours: { mon: { open: '09:00', close: '18:00' } },
        listingCounts: {
          total: 3,
          byAssetType: { APT: 2, ONEROOM: 1 },
          byDealType: { SALE: 2, MONTHLY: 1 },
        },
        disclosure: {
          agencyId,
          name: '중앙공인중개사사무소',
          representativeName: '홍길동',
          address: '전라남도 순천시 중앙로 10',
          phone: '0617491234',
          registrationNumber: central.agency.registrationNumber,
        },
      });
      // 제18조의2①: the page carries the office's ads, so the 중개보조원 is not named at all.
      expect(pluck(res.body.members, 'role')).toEqual(['OWNER', 'AGENT']);
      expect(pluck(res.body.members, 'id')).not.toContain(assistant.memberId);
      expect(res.body.members[1]).toMatchObject({ id: licensed.memberId, isLicensed: true });
      expect(res.body.members[1]).not.toHaveProperty('phone');
      expect(res.body.members[1]).not.toHaveProperty('licenseNumber');
      expect(JSON.stringify(res.body)).not.toContain('김실장');
      expect(res.body.representativeListings).toHaveLength(3);
      expect(res.body.representativeListings[0]).toMatchObject({
        id: sale.id,
        title: '역세권 84㎡',
        thumbnailUrl: '/media/listings/p1.thumb.webp',
        exclusiveArea: 84.97,
      });
      expect(JSON.stringify(res.body)).not.toMatch(/"ho"|storageKey/);
    });

    it('404 for pending / unknown agencies; 400 for a malformed id', async () => {
      const { pending } = await seed();
      const res = await t.http().get(`/api/v1/agencies/${pending.agency.id}`).expect(404);
      expect(res.body.code).toBe('AGENCY_NOT_FOUND');
      await t.http().get('/api/v1/agencies/0190f3c2-7a4b-7cde-8f00-123456789abc').expect(404);
      await t.http().get('/api/v1/agencies/abc').expect(400);
    });
  });
});
