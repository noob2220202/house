import { ListingStatus, MapResultKind } from '@house/shared';
import { gridSizeForZoom } from '../../../src/common/geo/geo';
import { tileSizeForZoom } from '../../../src/modules/listings/domain/map-tiles';
import { ListingCountersService } from '../../../src/modules/listings/services/listing-counters.service';
import { ListingsModerationService } from '../../../src/modules/listings/services/listings-moderation.service';
import { createComplex, createTestApp, resetAll, type TestApp } from '../../utils';
import { agencyWithOwner, seedListing } from './helpers';

/** A promise plus its resolver, to hold a transaction open at a chosen point. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe('listings: counter races and tile-aligned grid cells (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  /** Resolves once another session of this database is blocked waiting for a lock. */
  async function lockWaiter(): Promise<void> {
    for (let i = 0; i < 500; i++) {
      const [row] = await t.prisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'`;
      if ((row?.n ?? 0) > 0) return;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error('no session ever waited for a lock');
  }

  async function counts(complexId: string, agencyId: string) {
    const c = await t.prisma.complex.findUniqueOrThrow({ where: { id: complexId } });
    const a = await t.prisma.agency.findUniqueOrThrow({ where: { id: agencyId } });
    return { complex: c.activeListingCount, agency: a.activeListingCount };
  }

  describe('ListingCountersService.refresh', () => {
    it('two transactions publishing in the same 단지 at once leave the exact count', async () => {
      const { agency } = await agencyWithOwner(t);
      const complex = await createComplex(t.prisma);
      const draft = { complexId: complex.id, status: ListingStatus.DRAFT };
      const l1 = await seedListing(t, agency.id, {
        property: { complexId: complex.id },
        listing: draft,
      });
      const l2 = await seedListing(t, agency.id, {
        property: { complexId: complex.id },
        listing: draft,
      });
      const counters = t.app.get(ListingCountersService);
      const scope = { complexIds: [complex.id], agencyIds: [agency.id] };
      const publish = (id: string) => ({ where: { id }, data: { status: ListingStatus.ACTIVE } });

      const holdT1 = deferred();
      const t1Counted = deferred();
      const t1 = t.prisma.$transaction(async (tx) => {
        await tx.listing.update(publish(l1.listing.id));
        await counters.refresh(tx, scope);
        t1Counted.resolve();
        await holdT1.promise;
      });
      await t1Counted.promise;
      // T2 changes another listing and recounts the same rows: it must wait for T1's lock…
      const t2 = t.prisma.$transaction(async (tx) => {
        await tx.listing.update(publish(l2.listing.id));
        await counters.refresh(tx, scope);
      });
      await lockWaiter();
      // …and once T1 commits, recount with T1's change visible.
      holdT1.resolve();
      await Promise.all([t1, t2]);

      expect(await counts(complex.id, agency.id)).toEqual({ complex: 2, agency: 2 });
    });
  });

  describe('ListingsModerationService.hide racing a publish', () => {
    it('sees the committed status and drops the published listing from the counters', async () => {
      const { agency } = await agencyWithOwner(t);
      const complex = await createComplex(t.prisma);
      const { listing } = await seedListing(t, agency.id, {
        property: { complexId: complex.id },
        listing: { complexId: complex.id, status: ListingStatus.DRAFT },
      });
      const counters = t.app.get(ListingCountersService);
      const moderation = t.app.get(ListingsModerationService);

      const holdPublish = deferred();
      const published = deferred();
      const publish = t.prisma.$transaction(async (tx) => {
        await tx.listing.update({
          where: { id: listing.id },
          data: { status: ListingStatus.ACTIVE },
        });
        await counters.refresh(tx, { complexIds: [complex.id], agencyIds: [agency.id] });
        published.resolve();
        await holdPublish.promise;
      });
      await published.promise;
      const hide = moderation.hide(listing.id, '허위매물 신고 처리');
      await lockWaiter();
      holdPublish.resolve();
      await publish;

      // The status hide replaced is the committed ACTIVE, not the DRAFT it would have read before.
      expect(await hide).toBe(ListingStatus.ACTIVE);
      const row = await t.prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
      expect(row.status).toBe(ListingStatus.HIDDEN);
      expect(await counts(complex.id, agency.id)).toEqual({ complex: 0, agency: 0 });
    });
  });

  describe('GET /map/search grid clusters at a tile edge', () => {
    const zoom = 14;
    const size = gridSizeForZoom(zoom);
    const tile = tileSizeForZoom(zoom);
    // A tile edge (multiple of the tile size) near 순천 downtown.
    const edge = Math.floor(127.49 / tile) * tile;
    const lat = 34.95;

    interface Cluster {
      key: string;
      count: number;
      lat: number;
      lng: number;
    }
    const grid = async (swLng: number, neLng: number) => {
      const res = await t
        .http()
        .get(`/api/v1/map/search?bbox=${swLng},34.94,${neLng},34.96&zoom=${zoom}`)
        .expect(200);
      expect(res.body.kind).toBe(MapResultKind.GRID_CLUSTERS);
      return res.body as { total: number; clusters: Cluster[]; bbox: { swLng: number } };
    };

    it('listings on either side of a tile edge fall in different cells, each counted once', async () => {
      const { agency } = await agencyWithOwner(t);
      const at = (lng: number) =>
        seedListing(t, agency.id, { property: { lat, lng }, listing: { lat, lng } });
      await at(edge - size * 0.2); // west tile, last cell
      await at(edge + size * 0.2); // east tile, first cell
      await at(edge); // exactly on the edge: belongs to the east cell [edge, edge + size)

      const east = await grid(edge + 0.0005, edge + 0.01);
      expect(east.bbox.swLng).toBe(edge);
      const west = await grid(edge - 0.01, edge - 0.0005);

      expect(east.total).toBe(2);
      expect(west.total).toBe(1);
      expect(east.clusters).toHaveLength(1);
      expect(west.clusters).toHaveLength(1);
      const [e, w] = [east.clusters[0]!, west.clusters[0]!];
      expect(e.count).toBe(2);
      expect(w.count).toBe(1);
      // Distinct cells → distinct keys; the key is the cell centre.
      expect(e.key).not.toBe(w.key);
      expect(Number(e.key.split(':')[0])).toBeCloseTo(edge + size / 2, 6);
      expect(Number(w.key.split(':')[0])).toBeCloseTo(edge - size / 2, 6);
      expect(e.lng).toBeGreaterThanOrEqual(edge);
      expect(w.lng).toBeLessThan(edge);

      // A viewport spanning both tiles sees the same two cells with the same counts.
      const both = await grid(edge - 0.01, edge + 0.01);
      expect(both.total).toBe(3);
      expect(new Map(both.clusters.map((c) => [c.key, c.count]))).toEqual(
        new Map([
          [e.key, 2],
          [w.key, 1],
        ]),
      );
    });
  });
});
