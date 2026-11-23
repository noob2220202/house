import { ListingSort, type ListingFilter } from '@house/shared';
import { Prisma } from '@prisma/client';
import { ListingSearchRepository } from '../../../src/modules/listings/listing-search.repository';
import { createComplex, createTestApp, resetAll, type TestApp } from '../../utils';
import { agencyWithOwner, EMD_CODE } from './helpers';

const N = 20_000;
const COMPLEXES = 200;
const AGENCIES = 20;

interface PlanNode {
  'Node Type': string;
  'Index Name'?: string;
  'Relation Name'?: string;
  Plans?: PlanNode[];
}

function walk(node: PlanNode, out: PlanNode[] = []): PlanNode[] {
  out.push(node);
  for (const child of node.Plans ?? []) walk(child, out);
  return out;
}

/**
 * Seeds ~20k listings (deterministic pseudo-random spread over 순천시) and checks with EXPLAIN that
 * the hot query paths are index-backed and fast. Plans are printed for the record.
 */
describe('listings query performance (e2e, 20k rows)', () => {
  let t: TestApp;
  let repo: ListingSearchRepository;
  let agencyId: string;
  let complexId: string;
  const report: string[] = [];

  async function explain(label: string, sql: Prisma.Sql) {
    const rows = await t.prisma.$queryRaw<
      { 'QUERY PLAN': [{ Plan: PlanNode; 'Execution Time': number }] }[]
    >(Prisma.sql`EXPLAIN (ANALYZE, FORMAT JSON) ${sql}`);
    const plan = rows[0]!['QUERY PLAN'][0];
    const nodes = walk(plan.Plan);
    const indexes = [...new Set(nodes.flatMap((n) => (n['Index Name'] ? [n['Index Name']] : [])))];
    const seqScans = nodes
      .filter((n) => n['Node Type'] === 'Seq Scan')
      .map((n) => n['Relation Name'] ?? '?');
    report.push(
      `${label.padEnd(34)} ${plan['Execution Time'].toFixed(2).padStart(8)} ms  idx=[${indexes.join(', ')}]${seqScans.length ? ` seq=[${seqScans.join(', ')}]` : ''}`,
    );
    return { indexes, seqScans, ms: plan['Execution Time'] };
  }

  beforeAll(async () => {
    t = await createTestApp();
    await resetAll(t);
    repo = t.app.get(ListingSearchRepository);
    const agencyIds: string[] = [];
    for (let i = 0; i < AGENCIES; i++) agencyIds.push((await agencyWithOwner(t)).agency.id);
    agencyId = agencyIds[3]!;
    const complexes = [];
    for (let i = 0; i < COMPLEXES; i++) {
      complexes.push(
        await createComplex(t.prisma, {
          lat: 34.85 + (i % 20) * 0.01,
          lng: 127.3 + Math.floor(i / 20) * 0.03,
        }),
      );
    }
    complexId = complexes[7]!.id;
    const complexIds = complexes.map((c) => c.id);

    await t.prisma.$executeRaw`
      INSERT INTO properties (id, asset_type, road_address, sgg_code, emd_code, lat, lng, floor,
                              total_floors, exclusive_area, rooms, baths, updated_at)
      SELECT md5('p' || g)::uuid, 'APT', '전라남도 순천시 성능로 ' || g, '46150',
             '46150' || lpad(((g % 30) * 10 + 101)::text, 3, '0') || '00',
             34.85 + ((g * 7919) % 20000) / 100000.0, 127.30 + ((g * 104729) % 30000) / 100000.0,
             1 + g % 20, 20, 30 + (g % 120), 1 + g % 4, 1 + g % 2, now()
      FROM generate_series(1, ${N}) g`;
    await t.prisma.$executeRaw`
      INSERT INTO listings (id, property_id, deal_type, status, sale_price, deposit, monthly_rent,
                            primary_agency_id, published_at, verified_at, asset_type, complex_id,
                            sgg_code, emd_code, lat, lng, exclusive_area, rooms, baths, floor_class,
                            built_year, price_sort, photo_count, options, updated_at)
      SELECT md5('l' || g)::uuid, md5('p' || g)::uuid, d.deal_type::deal_type,
             (CASE WHEN g % 20 = 0 THEN 'DRAFT' WHEN g % 20 = 1 THEN 'RESERVED'
                   WHEN g % 20 = 2 THEN 'CLOSED' ELSE 'ACTIVE' END)::listing_status,
             CASE WHEN d.deal_type = 'SALE' THEN 10000 + (g * 37) % 90000 END,
             CASE WHEN d.deal_type IN ('JEONSE', 'MONTHLY') THEN 500 + (g * 37) % 40000 END,
             CASE WHEN d.deal_type = 'MONTHLY' THEN 20 + g % 80 END,
             (${agencyIds}::uuid[])[1 + g % ${AGENCIES}], now() - (g || ' minutes')::interval,
             CASE WHEN g % 3 = 0 THEN now() - (g || ' hours')::interval END,
             'APT', CASE WHEN g % 2 = 0 THEN (${complexIds}::uuid[])[1 + g % ${COMPLEXES}] END,
             p.sgg_code, p.emd_code, p.lat, p.lng, p.exclusive_area, p.rooms, p.baths,
             (ARRAY['LOW','MID','HIGH'])[1 + g % 3]::floor_class,
             CASE WHEN g % 10 < 7 THEN 1990 + g % 35 END,
             CASE WHEN d.deal_type = 'SALE' THEN 10000 + (g * 37) % 90000
                  WHEN d.deal_type = 'PRESALE' THEN 20000 + g % 30000
                  ELSE 500 + (g * 37) % 40000 END,
             g % 15, ARRAY['ELEVATOR']::listing_option[], now()
      FROM generate_series(1, ${N}) g
      JOIN properties p ON p.id = md5('p' || g)::uuid
      CROSS JOIN LATERAL (SELECT (ARRAY['SALE','JEONSE','MONTHLY','PRESALE'])[1 + g % 4] AS deal_type) d`;
    await t.prisma.$executeRaw`
      INSERT INTO listing_agencies (id, listing_id, agency_id, is_primary)
      SELECT gen_random_uuid(), id, primary_agency_id, true FROM listings`;
    await t.prisma.$executeRaw`ANALYZE properties`;
    await t.prisma.$executeRaw`ANALYZE listings`;
    await t.prisma.$executeRaw`ANALYZE listing_agencies`;
  }, 120_000);

  afterAll(async () => {
    console.log(`listings EXPLAIN (ANALYZE) on ${N} rows:\n${report.join('\n')}`);
    await resetAll(t);
    await t?.close();
  });

  const none: ListingFilter = {};

  it.each([
    ['LATEST', ListingSort.LATEST, 'listings_status_published_at_idx'],
    ['PRICE_ASC', ListingSort.PRICE_ASC, 'listings_status_price_sort_idx'],
    ['PRICE_DESC', ListingSort.PRICE_DESC, 'listings_status_price_sort_idx'],
    ['AREA_DESC', ListingSort.AREA_DESC, 'listings_status_exclusive_area_idx'],
    ['VERIFIED', ListingSort.VERIFIED, 'listings_status_verified_at_idx'],
    ['BUILT_YEAR_DESC', ListingSort.BUILT_YEAR_DESC, 'listings_status_built_year_idx'],
    ['PHOTO', ListingSort.PHOTO, 'listings_status_photo_count_idx'],
  ])('list sort %s page 1 uses its index', async (label, sort, index) => {
    const r = await explain(`list ${label}`, repo.listSql(none, undefined, sort, 0, 20));
    expect(r.indexes).toContain(index);
    expect(r.seqScans).not.toContain('listings');
    expect(r.ms).toBeLessThan(100);
  });

  it('list page 50 (deep offset) stays index-backed', async () => {
    const r = await explain(
      'list LATEST page 50',
      repo.listSql(none, undefined, ListingSort.LATEST, 980, 20),
    );
    expect(r.indexes).toContain('listings_status_published_at_idx');
    expect(r.ms).toBeLessThan(150);
  });

  it('list with a small bbox uses the GIST index', async () => {
    const bbox = { swLng: 127.45, swLat: 34.94, neLng: 127.47, neLat: 34.96 };
    const r = await explain(
      'list bbox PRICE_ASC',
      repo.listSql(none, bbox, ListingSort.PRICE_ASC, 0, 20),
    );
    expect(r.seqScans).not.toContain('listings');
    expect(r.ms).toBeLessThan(100);
  });

  it('list by complex uses the complex index', async () => {
    const r = await explain(
      'list complexId LATEST',
      repo.listSql({ complexId }, undefined, ListingSort.LATEST, 0, 20),
    );
    expect(r.seqScans).not.toContain('listings');
    expect(r.ms).toBeLessThan(100);
  });

  it('count for a filtered search is fast', async () => {
    const where = repo.publicWhere({ dealTypes: ['SALE'], priceMax: 50_000 });
    const r = await explain(
      'count SALE≤5억',
      Prisma.sql`SELECT count(*) FROM listings l WHERE ${where}`,
    );
    expect(r.ms).toBeLessThan(100);
  });

  it('map: grid clusters over a district bbox use the GIST index', async () => {
    const bbox = { swLng: 127.4, swLat: 34.9, neLng: 127.45, neLat: 34.95 };
    const where = repo.publicWhere(none, bbox);
    const sql = Prisma.sql`SELECT ST_SnapToGrid(l.location::geometry, 0.005) AS cell, count(*)
      FROM listings l WHERE ${where} GROUP BY 1`;
    const r = await explain('map grid (district)', sql);
    expect(r.indexes).toContain('listings_location_idx');
    expect(r.ms).toBeLessThan(100);
  });

  it('map: markers at street level use the GIST index', async () => {
    const bbox = { swLng: 127.45, swLat: 34.945, neLng: 127.455, neLat: 34.95 };
    const where = repo.publicWhere(none, bbox);
    const r = await explain(
      'map markers (street)',
      Prisma.sql`SELECT l.id FROM listings l WHERE ${where} AND l.complex_id IS NULL
                 ORDER BY l.published_at DESC LIMIT 501`,
    );
    expect(r.indexes).toContain('listings_location_idx');
    expect(r.ms).toBeLessThan(50);
  });

  it('map: city-wide 읍면동 clustering stays fast', async () => {
    const bbox = { swLng: 127.2, swLat: 34.8, neLng: 127.7, neLat: 35.1 };
    const where = repo.publicWhere(none, bbox);
    const r = await explain(
      'map regions (whole city)',
      Prisma.sql`SELECT substr(l.emd_code, 1, 8), l.deal_type, count(*), min(l.price_sort), max(l.price_sort)
                 FROM listings l WHERE ${where} GROUP BY 1, 2`,
    );
    // Covers every row, so a sequential scan is the right plan here; it must still be quick.
    expect(r.ms).toBeLessThan(150);
  });

  it('agency listing list uses listing_agencies(agency_id, status)', async () => {
    const r = await explain(
      'agency list',
      Prisma.sql`SELECT l.id FROM listings l
        WHERE l.deleted_at IS NULL AND EXISTS (
          SELECT 1 FROM listing_agencies la WHERE la.listing_id = l.id
            AND la.agency_id = ${agencyId}::uuid AND la.status = 'ACTIVE')
        ORDER BY l.updated_at DESC LIMIT 20`,
    );
    expect(r.indexes).toContain('listing_agencies_agency_id_status_idx');
    expect(r.ms).toBeLessThan(50);
  });

  it('the HTTP endpoints answer quickly on the seeded data', async () => {
    const t0 = Date.now();
    const list = await t.http().get('/api/v1/listings?sort=PRICE_ASC&dealTypes=SALE').expect(200);
    const listMs = Date.now() - t0;
    expect(list.body.total).toBeGreaterThanOrEqual(4000);
    expect(list.body.items).toHaveLength(20);
    const t1 = Date.now();
    const map = await t
      .http()
      .get('/api/v1/map/search?bbox=127.30,34.85,127.60,35.05&zoom=12')
      .expect(200);
    const mapMs = Date.now() - t1;
    expect(map.body.total).toBeGreaterThan(15_000);
    expect(
      (map.body.clusters as { regionCode: string }[]).some(
        (c) => c.regionCode === `${EMD_CODE.slice(0, 5)}10100`,
      ),
    ).toBe(true);
    const t2 = Date.now();
    await t.http().get('/api/v1/map/search?bbox=127.30,34.85,127.60,35.05&zoom=12').expect(200);
    const cachedMs = Date.now() - t2;
    report.push(`HTTP list ${listMs} ms, map regions ${mapMs} ms (cached ${cachedMs} ms)`);
    expect(listMs).toBeLessThan(1000);
    expect(mapMs).toBeLessThan(1000);
  });
});
