import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_MOCK = '1';
});

import {
  seoListingStatusSchema,
  seoRegionIndexSchema,
  seoRegionLandingSchema,
  seoSitemapSchema,
  seoTradeReportSchema,
} from '@/lib/seo/schemas';
import { MOCK_CLOSED_LISTING_ID } from './_data';
import { GET as getStatus } from './listings/[id]/status/route';
import { GET as getLanding } from './regions/[code]/landing/route';
import { GET as getRegions } from './regions/route';
import { GET as getReport } from './reports/apartment-trades/route';
import { GET as getSitemap } from './sitemap/[kind]/route';

/** The seo mocks answer the apps/api seo contract that lib/seo/schemas parses. */
const req = (path: string) =>
  new NextRequest(`http://localhost/mock-api/v1${path}${path.includes('?') ? '&' : '?'}_delay=1`);
const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

describe('seo mock routes', () => {
  it('GET /seo/regions → regions with data', async () => {
    const res = await getRegions(req('/seo/regions'));
    const index = seoRegionIndexSchema.parse(await res.json());
    expect(index.regions.length).toBeGreaterThan(0);
    expect(index.regions.every((r) => /^\d{8}(\d{2})?$/.test(r.code))).toBe(true);
    expect(index.regions.some((r) => r.complexCount > 0 && r.saleTradeCount > 0)).toBe(true);
  });

  it('GET /seo/regions/:code/landing → facts, 404 / 400 otherwise', async () => {
    const index = seoRegionIndexSchema.parse(await (await getRegions(req('/seo/regions'))).json());
    const withComplex = index.regions.find((r) => r.complexCount > 0);
    expect(withComplex).toBeDefined();
    const res = await getLanding(
      req(`/seo/regions/${withComplex!.code}/landing?assetTypes=APT,OFFICETEL`),
      params({ code: withComplex!.code }),
    );
    const landing = seoRegionLandingSchema.parse(await res.json());
    expect(landing.complexes.length).toBe(landing.complexTotal);
    expect(landing.trades?.sale.count).toBeGreaterThan(0);
    const oneroom = seoRegionLandingSchema.parse(
      await (
        await getLanding(
          req(`/seo/regions/${withComplex!.code}/landing?assetTypes=ONEROOM`),
          params({ code: withComplex!.code }),
        )
      ).json(),
    );
    expect(oneroom.trades).toBeNull();
    expect(oneroom.complexes).toEqual([]);
    expect(
      (await getLanding(req('/seo/regions/12150999/landing'), params({ code: '12150999' }))).status,
    ).toBe(404);
    expect((await getLanding(req('/seo/regions/x/landing'), params({ code: 'x' }))).status).toBe(
      400,
    );
  });

  it('GET /seo/reports/apartment-trades → latest closed month and archives', async () => {
    const report = seoTradeReportSchema.parse(
      await (await getReport(req('/seo/reports/apartment-trades'))).json(),
    );
    expect(report.yearMonth).toBe(report.latestYearMonth);
    expect(report.availableMonths).toContain(report.yearMonth);
    expect(report.byRegion.reduce((n, r) => n + r.sale.count, 0)).toBe(report.sale.count);
    const older = report.availableMonths.find((m) => m !== report.latestYearMonth)!;
    const archived = seoTradeReportSchema.parse(
      await (await getReport(req(`/seo/reports/apartment-trades?ym=${older}`))).json(),
    );
    expect(archived.yearMonth).toBe(older);
    expect((await getReport(req('/seo/reports/apartment-trades?ym=200001'))).status).toBe(404);
    expect((await getReport(req('/seo/reports/apartment-trades?ym=202613'))).status).toBe(400);
  });

  it('GET /seo/sitemap/:kind and /seo/listings/:id/status', async () => {
    for (const kind of ['complexes', 'listings', 'agencies']) {
      const rows = seoSitemapSchema.parse(
        await (await getSitemap(req(`/seo/sitemap/${kind}`), params({ kind }))).json(),
      );
      expect(rows.items.length).toBeGreaterThan(0);
    }
    expect((await getSitemap(req('/seo/sitemap/x'), params({ kind: 'x' }))).status).toBe(400);
    const gone = seoListingStatusSchema.parse(
      await (
        await getStatus(req('/seo/listings/x/status'), params({ id: MOCK_CLOSED_LISTING_ID }))
      ).json(),
    );
    expect(gone).toMatchObject({ state: 'GONE', status: 'CLOSED' });
    expect(gone.complexId).not.toBeNull();
    expect((await getStatus(req('/seo/listings/x/status'), params({ id: 'unknown' }))).status).toBe(
      404,
    );
  });
});
