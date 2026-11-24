import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// The mock routes 404 unless mock mode is on; the flag is read when the modules load.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_MOCK = '1';
});

import {
  agencyDetailSchema,
  agencyListingPageSchema,
  agencyPageSchema,
} from '@/features/w-agencies/api/schemas';
import { isOpenAt } from '@/features/w-agencies/lib/hours';
import { AGENCY_SUMMARIES, agencyIdOf, findAgencyDetail } from './_fixtures';
import { GET as getListings } from '../listings/route';
import { searchAgencies } from './_search';

/**
 * Contract of the office search as the UI uses it. `sort` is a backend param; `openNow` and
 * `handlesPresale` are mock-only (the UI hides them against the real API, api/capabilities.ts).
 */
const req = (path: string) => new NextRequest(`http://localhost/mock-api/v1${path}&_delay=1`);
const json = async (res: Response) => (await res.json()) as unknown;
const fixtureOf = (id: string) => AGENCY_SUMMARIES.find((a) => a.id === id)!;

// Weekday late morning in Seoul: some offices open, some closed (lunch / day off / Sunday-only).
const NOW = new Date('2026-11-24T02:30:00Z'); // Tue 11:30 KST

describe('agencies mock — search contract', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterAll(() => vi.useRealTimers());

  it('openNow=true returns only offices open right now', async () => {
    const res = await searchAgencies(req('/agencies?openNow=true&pageSize=100'));
    const page = agencyPageSchema.parse(await json(res));
    expect(page.total).toBeGreaterThan(0);
    expect(page.total).toBeLessThan(AGENCY_SUMMARIES.length);
    // The wire rows are `AgencySummary` (no hours) — check against the fixture office.
    for (const a of page.items) expect(isOpenAt(fixtureOf(a.id).businessHours, NOW)).toBe(true);
  });

  it('handlesPresale=true returns only offices with an active 분양권 listing', async () => {
    const res = await searchAgencies(req('/agencies?handlesPresale=true&pageSize=100'));
    const page = agencyPageSchema.parse(await json(res));
    expect(page.total).toBeGreaterThan(0);
    expect(page.total).toBeLessThan(AGENCY_SUMMARIES.length);
    expect(page.items.every((a) => fixtureOf(a.id).handlesPresale)).toBe(true);
  });

  it('sort=NAME orders by name, the default by active listings', async () => {
    const byName = agencyPageSchema.parse(
      await json(await searchAgencies(req('/agencies?sort=NAME&pageSize=100'))),
    );
    const names = byName.items.map((a) => a.name);
    expect(names).toEqual([...names].sort((x, y) => x.localeCompare(y, 'ko')));
    const byCount = agencyPageSchema.parse(
      await json(await searchAgencies(req('/agencies?pageSize=100'))),
    );
    const counts = byCount.items.map((a) => a.activeListingCount);
    expect(counts).toEqual([...counts].sort((x, y) => y - x));
  });
});

describe('agencies mock — office listings (GET /listings?agencyId=)', () => {
  const id = agencyIdOf('B02');

  it('returns every active listing of the office in the shared list-item shape', async () => {
    const detail = agencyDetailSchema.parse(findAgencyDetail(id));
    const res = await getListings(req(`/listings?agencyId=${id}&pageSize=100`));
    const page = agencyListingPageSchema.parse(await json(res));
    expect(page.total).toBe(detail.activeListingCount);
    const apt = page.items.find((l) => l.assetType === 'APT');
    expect(apt?.complexName).toBeTruthy();
    expect(apt?.complexId).toBeTruthy();
  });

  it('filters by asset and deal type like listingListQuerySchema', async () => {
    const res = await getListings(
      req(`/listings?agencyId=${id}&assetTypes=APT&dealTypes=JEONSE&pageSize=100`),
    );
    const page = agencyListingPageSchema.parse(await json(res));
    expect(page.total).toBeGreaterThan(0);
    expect(page.items.every((l) => l.assetType === 'APT' && l.dealType === 'JEONSE')).toBe(true);
  });

  it('answers an empty page for an unknown office and 400 for a malformed id', async () => {
    const unknown = '00000000-0000-4000-8000-000000000000';
    const res = await getListings(req(`/listings?agencyId=${unknown}`));
    expect(agencyListingPageSchema.parse(await json(res)).total).toBe(0);
    expect((await getListings(req('/listings?agencyId=nope'))).status).toBe(400);
  });
});
