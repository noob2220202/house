import { ErrorCode, ListingStatus } from '@house/shared';
import { AdminSearchService } from '../../../src/modules/admin/services/admin-search.service';
import { kstToday } from '../../../src/modules/listings/domain/dates';
import { createComplex, createTestApp, resetAll, withSession, type TestApp } from '../../utils';
import { addCoBroker, agencyWithOwner, createDraft, createPublished, seedListing } from './helpers';

const BASE = '/api/v1/agency/listings';
const BBOX = '127.40,34.90,127.60,35.00';
const DAY = 86_400_000;

interface Row {
  id: string;
  listingNo: string | null;
  ho: string | null;
  missingCount: number | null;
  verificationDueAt: string | null;
  updatedAt: string;
}

interface Page {
  items: { id: string }[];
  total: number;
}

const ids = (body: unknown) => (body as Page).items.map((i) => i.id);

describe('console listing list + search groups (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  describe('GET /agency/listings rows', () => {
    it('carries 매물번호, 호 (own listings only), 확인 deadline and the drafts’ missing count', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const complete = await createDraft(t, a.ownerSession);
      const ownHo = '비밀일이공삼호';
      const res = await withSession(t.http().post(BASE), a.ownerSession)
        .send({
          dealType: 'SALE',
          property: {
            assetType: 'APT',
            roadAddress: '전남광주통합특별시 순천시 연향로 1',
            lat: 34.95,
            lng: 127.49,
          },
        })
        .expect(201);
      const incomplete = res.body.id as string;
      const live = await createPublished(t, a.ownerSession, { property: { ho: ownHo } });
      await withSession(t.http().post(`${BASE}/${live}/verifications`), a.ownerSession)
        .send({ method: 'SITE_VISIT', verifiedAt: kstToday() })
        .expect(201);
      const theirs = await createPublished(t, b.ownerSession, { property: { ho: '남의칠공칠호' } });
      await addCoBroker(t, theirs, b, a);

      const list = await withSession(t.http().get(BASE), a.ownerSession).expect(200);
      const rows = new Map((list.body.items as Row[]).map((r) => [r.id, r]));
      expect(rows.size).toBe(4);
      for (const r of rows.values()) expect(r.listingNo).toMatch(/^\d{6,}$/);
      expect(new Set([...rows.values()].map((r) => r.listingNo)).size).toBe(4);

      // Drafts: the same count the publish validator reports.
      expect(rows.get(complete)?.missingCount).toBe(0);
      const publish = await withSession(
        t.http().post(`${BASE}/${incomplete}/publish`),
        a.ownerSession,
      ).expect(400);
      expect(publish.body.code).toBe(ErrorCode.LISTING_PUBLISH_REQUIREMENTS);
      expect(rows.get(incomplete)?.missingCount).toBe((publish.body.details as unknown[]).length);
      expect(rows.get(live)?.missingCount).toBeNull();

      // 호: the primary sees its own; a co-broker never sees the primary's.
      expect(rows.get(live)?.ho).toBe(ownHo);
      expect(rows.get(theirs)?.ho).toBeNull();
      expect(JSON.stringify(list.body)).not.toContain('남의칠공칠호');

      const today = kstToday();
      const due = new Date(Date.parse(`${today}T00:00:00Z`) + 30 * DAY).toISOString().slice(0, 10);
      expect(rows.get(live)?.verificationDueAt).toBe(due);
      expect(rows.get(complete)?.verificationDueAt).toBeNull();

      // The detail has the same number and deadline; the public detail shows the number, never 호.
      const detail = await withSession(t.http().get(`${BASE}/${live}`), a.ownerSession).expect(200);
      expect(detail.body).toMatchObject({
        listingNo: rows.get(live)?.listingNo,
        verificationDueAt: due,
      });
      const pub = await t.http().get(`/api/v1/listings/${live}`).expect(200);
      expect(pub.body.listingNo).toBe(rows.get(live)?.listingNo);
      expect(JSON.stringify(pub.body)).not.toContain(ownHo);
    });

    it('filters: text (spaces ignored, 호 own only, 매물번호), asset types, co-brokered, 확인 due', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const complex = await createComplex(t.prisma, { name: '신대레이크파크' });
      const apt = await createPublished(t, a.ownerSession, {
        title: '호수공원 조망',
        property: { complexId: complex.id, ho: '1505호' },
      });
      const officetel = await createDraft(t, a.ownerSession, {
        property: { assetType: 'OFFICETEL', buildingName: '연향 스테이' },
      });
      const theirs = await createPublished(t, b.ownerSession, { property: { ho: '1505호' } });
      await addCoBroker(t, theirs, b, a);
      const get = async (query: string): Promise<Page> =>
        (await withSession(t.http().get(`${BASE}?${query}`), a.ownerSession).expect(200))
          .body as Page;

      expect(ids(await get(`q=${encodeURIComponent('레이크 파크')}`))).toEqual([apt]);
      expect(ids(await get(`q=${encodeURIComponent('연향스테이')}`))).toEqual([officetel]);
      // 호 matches the agency's own listing, not the co-brokered one with the same 호.
      expect(ids(await get(`q=${encodeURIComponent('1505호')}`))).toEqual([apt]);
      const row = await t.prisma.listing.findUniqueOrThrow({ where: { id: theirs } });
      expect(ids(await get(`q=${row.listingNo}`))).toEqual([theirs]);
      expect(ids(await get(`q=${encodeURIComponent(`매물번호 ${row.listingNo}`)}`))).toEqual([
        theirs,
      ]);
      expect((await get('q=%25')).total).toBe(0);
      expect((await get('q=')).total).toBe(3);

      expect(ids(await get('assetTypes=OFFICETEL'))).toEqual([officetel]);
      expect(ids(await get('coBrokered=true'))).toEqual([theirs]);
      expect((await get('primaryOnly=true')).total).toBe(2);

      // Never verified → due; verified today → not; verified 25 days ago → due within 7 days.
      expect(ids(await get('verificationDue=true')).sort()).toEqual([apt, theirs].sort());
      await withSession(t.http().post(`${BASE}/${apt}/verifications`), a.ownerSession)
        .send({ method: 'OWNER_CALL', verifiedAt: kstToday() })
        .expect(201);
      expect(ids(await get('verificationDue=true'))).toEqual([theirs]);
      await t.prisma.listing.update({
        where: { id: apt },
        data: { verifiedAt: new Date(Date.now() - 25 * DAY) },
      });
      expect(ids(await get('verificationDue=true')).sort()).toEqual([apt, theirs].sort());
      // Drafts are never due.
      expect(ids(await get('verificationDue=true&statuses=DRAFT'))).toEqual([]);
    });

    it('sorts like the console (price, views, latest, 확인 due, updated)', async () => {
      const a = await agencyWithOwner(t);
      const cheap = await createPublished(t, a.ownerSession, { salePrice: 20_000 });
      const dear = await createPublished(t, a.ownerSession, { salePrice: 50_000 });
      const mid = await createPublished(t, a.ownerSession, { salePrice: 35_000 });
      await t.prisma.listing.update({ where: { id: cheap }, data: { viewCount: 90 } });
      await t.prisma.listing.update({
        where: { id: mid },
        data: { verifiedAt: new Date(Date.now() - 20 * DAY) },
      });
      await t.prisma.listing.update({
        where: { id: dear },
        data: { verifiedAt: new Date(Date.now() - 2 * DAY) },
      });
      const sorted = async (sort: string) =>
        ids(
          (await withSession(t.http().get(`${BASE}?sort=${sort}`), a.ownerSession).expect(200))
            .body,
        );

      expect(await sorted('PRICE_ASC')).toEqual([cheap, mid, dear]);
      expect(await sorted('PRICE_DESC')).toEqual([dear, mid, cheap]);
      expect((await sorted('VIEWS'))[0]).toBe(cheap);
      expect(await sorted('LATEST')).toEqual([mid, dear, cheap]);
      // Oldest 확인 first; never verified last.
      expect(await sorted('VERIFY_DUE')).toEqual([mid, dear, cheap]);
      // UPDATED (default): the last write first.
      expect((await sorted('UPDATED'))[0]).toBe(dear);
      await withSession(t.http().get(`${BASE}?sort=NOPE`), a.ownerSession).expect(400);
    });
  });

  describe('search groups: 방 구성 / 용도지역 / 지목', () => {
    it('derives them on write (stated 1.5룸 wins) and keeps them in sync on edits', async () => {
      const a = await agencyWithOwner(t);
      const room = await createDraft(t, a.ownerSession, {
        dealType: 'MONTHLY',
        salePrice: undefined,
        deposit: 300,
        monthlyRent: 35,
        property: { assetType: 'ONEROOM', rooms: 1, roomType: 'ONE_HALF_ROOM' },
      });
      const land = await createDraft(t, a.ownerSession, {
        property: {
          assetType: 'LAND',
          zoning: '자연녹지지역',
          landCategory: '임야',
          landArea: 990,
        },
      });
      const cols = (id: string) =>
        t.prisma.listing.findUniqueOrThrow({
          where: { id },
          select: { roomType: true, landZone: true, landCategory: true },
        });
      expect(await cols(room)).toEqual({
        roomType: 'ONE_HALF_ROOM',
        landZone: null,
        landCategory: null,
      });
      expect(await cols(land)).toEqual({ roomType: null, landZone: 'GREEN', landCategory: 'IMYA' });

      await withSession(t.http().patch(`${BASE}/${room}`), a.ownerSession)
        .send({ property: { roomType: null, rooms: 2 } })
        .expect(200);
      expect((await cols(room)).roomType).toBe('TWO_ROOM');
      const edited = await withSession(t.http().patch(`${BASE}/${land}`), a.ownerSession)
        .send({ property: { zoning: '제1종일반주거지역', landCategory: '대' } })
        .expect(200);
      expect(edited.body.property).toMatchObject({
        zoning: '제1종일반주거지역',
        landCategory: '대',
      });
      expect(await cols(land)).toEqual({
        roomType: null,
        landZone: 'RESIDENTIAL',
        landCategory: 'DAE',
      });
      await withSession(t.http().patch(`${BASE}/${room}`), a.ownerSession)
        .send({ property: { roomType: '1.5룸' } })
        .expect(400);
    });

    it('GET /listings and /map/search filter by roomTypes, landZones and landCategories', async () => {
      const { agency } = await agencyWithOwner(t);
      const half = await seedListing(t, agency.id, {
        property: { assetType: 'ONEROOM', roomType: 'ONE_HALF_ROOM', rooms: 1 },
        listing: { assetType: 'ONEROOM', roomType: 'ONE_HALF_ROOM', rooms: 1 },
      });
      const two = await seedListing(t, agency.id, {
        property: { assetType: 'ONEROOM', rooms: 2 },
        listing: { assetType: 'ONEROOM', roomType: 'TWO_ROOM', rooms: 2 },
      });
      const forest = await seedListing(t, agency.id, {
        property: { assetType: 'LAND', zoning: '계획관리지역', landCategory: '임야' },
        listing: { assetType: 'LAND', landZone: 'MANAGEMENT', landCategory: 'IMYA' },
      });
      const site = await seedListing(t, agency.id, {
        property: { assetType: 'LAND', zoning: '제2종일반주거지역', landCategory: '대' },
        listing: { assetType: 'LAND', landZone: 'RESIDENTIAL', landCategory: 'DAE' },
      });
      const list = async (query: string) =>
        ids((await t.http().get(`/api/v1/listings?${query}`).expect(200)).body).sort();

      expect(await list('roomTypes=ONE_HALF_ROOM')).toEqual([half.listing.id]);
      expect(await list('roomTypes=ONE_ROOM,TWO_ROOM')).toEqual([two.listing.id]);
      expect(await list('landZones=MANAGEMENT')).toEqual([forest.listing.id]);
      expect(await list('landCategories=DAE,JEON')).toEqual([site.listing.id]);
      expect(await list('landZones=RESIDENTIAL,MANAGEMENT&landCategories=IMYA')).toEqual([
        forest.listing.id,
      ]);
      await t.http().get('/api/v1/listings?roomTypes=TWOROOM').expect(400);

      const items = (await t.http().get('/api/v1/listings?assetTypes=LAND').expect(200)).body
        .items as { id: string; landZone: string; landCategory: string; listingNo: string }[];
      expect(items.find((i) => i.id === forest.listing.id)).toMatchObject({
        landZone: 'MANAGEMENT',
        landCategory: 'IMYA',
        listingNo: String(forest.listing.listingNo),
      });

      const map = async (query: string) =>
        (await t.http().get(`/api/v1/map/search?bbox=${BBOX}&zoom=14&${query}`).expect(200)).body
          .total as number;
      expect(await map('roomTypes=ONE_HALF_ROOM,TWO_ROOM')).toBe(2);
      expect(await map('landCategories=IMYA')).toBe(1);
      expect(await map('landZones=GREEN')).toBe(0);
    });
  });

  describe('admin search by 매물번호', () => {
    it('finds a listing by its number and returns it', async () => {
      const { agency } = await agencyWithOwner(t);
      const { listing } = await seedListing(t, agency.id, { listing: { title: '아무 제목' } });
      await seedListing(t, agency.id, { listing: { status: ListingStatus.DRAFT } });
      const res = await t.app
        .get(AdminSearchService)
        .search({ q: `매물번호 ${listing.listingNo}`, limit: 5 });
      expect(res.listings.total).toBe(1);
      expect(res.listings.items[0]).toMatchObject({
        id: listing.id,
        listingNo: String(listing.listingNo),
      });
    });
  });
});
