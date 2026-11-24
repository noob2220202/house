import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

// The mock routes 404 unless mock mode is on; the flag is read when the modules load.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_MOCK = '1';
});

import {
  complexDetailSchema,
  complexListingPageSchema,
  complexStatsSchema,
} from '@/features/w-complex/api/schemas';
import { listingDetailSchema } from '@/features/w-listing/api/schemas';
import { mapSearchResponseSchema } from '@/features/w-map/api/schemas';
import { listingPageSchema } from '@/lib/api/schemas/listing';
import { mockUuid } from '@/lib/mock';
import { GET as getComplex } from './complexes/[id]/route';
import { GET as getComplexSummary } from './complexes/[id]/listings/route';
import { GET as getStats } from './complexes/[id]/stats/route';
import { GET as getPopular } from './complexes/popular/route';
import { GET as getListing } from './listings/[id]/route';
import { GET as getListings } from './listings/route';
import { GET as getMap } from './map/search/route';
import { GET as getBanners } from './banners/route';
import { GET as getRegions } from './regions/route';

/**
 * The mocks answer in the backend wire shapes (`@house/shared` response types) — the same keys the
 * real controllers send — and the frontend schemas parse them.
 */
const req = (path: string) =>
  new NextRequest(`http://localhost/mock-api/v1${path}${path.includes('?') ? '&' : '?'}_delay=1`);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const json = async (res: Response) => (await res.json()) as Record<string, unknown>;
const C01 = mockUuid('C01');

describe('mock routes speak the backend contract', () => {
  it('GET /listings → ListingSummary rows (nested complex / coverPhoto, floorLabel)', async () => {
    const body = await json(await getListings(req('/listings?pageSize=5')));
    const raw = (body.items as Record<string, unknown>[])[0]!;
    expect(raw).toHaveProperty('floorLabel');
    expect(raw).toHaveProperty('primaryAgency');
    expect(raw).not.toHaveProperty('complexName');
    expect(raw).not.toHaveProperty('coverPhotoUrl');
    expect(listingPageSchema.safeParse(body).success).toBe(true);
  });

  it('GET /listings?complexId → that 단지 rows; GET /complexes/:id/listings → summary only', async () => {
    const page = complexListingPageSchema.parse(
      await json(await getListings(req(`/listings?complexId=${C01}&pageSize=100`))),
    );
    expect(page.total).toBeGreaterThan(0);
    expect(page.items.every((l) => l.complexId === C01)).toBe(true);
    const summary = await json(
      await getComplexSummary(req(`/complexes/${C01}/listings`), ctx(C01)),
    );
    expect(Object.keys(summary).sort()).toEqual(['byDealType', 'complexId', 'total']);
    expect(summary.total).toBe(page.total);
  });

  it('GET /complexes/:id and /stats → ComplexDetail / ComplexStatsView', async () => {
    const raw = await json(await getComplex(req(`/complexes/${C01}`), ctx(C01)));
    expect(raw).toHaveProperty('latestTrades');
    expect(raw).toHaveProperty('listingSummary');
    const detail = complexDetailSchema.parse(raw);
    const area = detail.areaTypes[0]!.id;
    const stats = await json(
      await getStats(
        req(`/complexes/${C01}/stats?dealType=SALE&areaTypeId=${area}&months=120`),
        ctx(C01),
      ),
    );
    expect(stats).toHaveProperty('series');
    expect(stats.overall).toEqual([]);
    expect(complexStatsSchema.parse(stats).months.length).toBeGreaterThan(0);
  });

  it('GET /complexes/popular → bare PopularComplexItem[]', async () => {
    const body = (await (await getPopular(req('/complexes/popular?limit=3'))).json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toHaveProperty('listingCounts');
  });

  it('GET /listings/:id → ListingDetail (PhotoUrls, latestVerification, maintenanceFee)', async () => {
    const id = mockUuid('L01');
    const raw = await json(await getListing(req(`/listings/${id}`), ctx(id)));
    expect(raw).toHaveProperty('latestVerification');
    expect((raw.photos as Record<string, unknown>[])[0]).toHaveProperty('mediaId');
    expect(raw).not.toHaveProperty('nearby');
    const l = listingDetailSchema.parse(raw);
    expect(l.property.lat).toBeTypeOf('number');
  });

  it('GET /map/search → MapSearchResult', async () => {
    const raw = await json(
      await getMap(req('/map/search?bbox=127.46,34.9,127.6,34.99&zoom=17&assetTypes=ONEROOM')),
    );
    expect(raw).toHaveProperty('listings');
    expect(raw).not.toHaveProperty('markers');
    const res = mapSearchResponseSchema.parse(raw);
    expect(res.markers.length).toBeGreaterThan(0);
  });

  it('GET /banners → PublicBannerView (clickUrl), GET /regions → RegionView[]', async () => {
    const banners = await json(await getBanners(req('/banners?slot=MAIN_HERO')));
    const first = (banners.items as Record<string, unknown>[])[0]!;
    expect(first).toHaveProperty('clickUrl');
    expect(first).not.toHaveProperty('linkUrl');
    const regions = (await (await getRegions(req('/regions'))).json()) as Record<string, unknown>[];
    expect(regions[0]).toMatchObject({ isActive: true });
    expect(typeof regions[0]?.level).toBe('string');
  });
});
