// @vitest-environment node
import type { AssetType } from '@house/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgencyListingPage } from '@/features/w-agencies/api/schemas';
import type { AgencyListingsParams } from '@/features/w-agencies/api/queries';
import * as agencyServer from '@/features/w-agencies/api/server';
import type { OfficeSite } from './schemas';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ unstable_cache: <T>(fn: () => Promise<T>) => fn }));
vi.mock('@/features/w-agencies/api/server', () => ({ getAgencyListings: vi.fn() }));
const getAgencyListings = vi.mocked(agencyServer.getAgencyListings);

const page = (total: number): AgencyListingPage => ({
  items: [],
  page: 1,
  pageSize: 12,
  total,
  totalPages: Math.ceil(total / 12),
});

/** An office whose counters (co-brokered listings included) say 10: 6 APT, 4 OFFICETEL. */
const site = (counts: Partial<Record<AssetType, number>> = { APT: 6, OFFICETEL: 4 }) =>
  ({
    slug: 'sindae',
    color: 'BLUE',
    url: 'https://sindae.suncheonmap.kr',
    agency: {
      id: 'a1',
      activeListingCount: Object.values(counts).reduce((s, n) => s + n, 0),
      listingCounts: { presale: 0, sale: 10, jeonse: 0, monthly: 0 },
      listingCountsByAsset: counts,
    },
  }) as unknown as OfficeSite;

/** Primary-only answers: 5 in all, 5 APT, no OFFICETEL (those are co-brokered). */
function primaryAnswers(byAsset: Partial<Record<AssetType, number | null>>, total: number | null) {
  getAgencyListings.mockImplementation((_id: string, params: AgencyListingsParams, scope) => {
    expect(scope).toEqual({ primaryOnly: true });
    const n = params.assetType ? byAsset[params.assetType] : total;
    return Promise.resolve(n === null || n === undefined ? null : page(n));
  });
}

beforeEach(() => {
  getAgencyListings.mockReset();
});

describe('loadOfficeListingFacts (D-D: the office site counts its own listings only)', () => {
  it('counts primary listings per 종류 and drops a 종류 the office only co-brokers', async () => {
    const { loadOfficeListingFacts } = await import('./server');
    primaryAnswers({ APT: 5, OFFICETEL: 0 }, 5);
    const facts = await loadOfficeListingFacts(site());
    expect(facts).toMatchObject({ total: 5, byAsset: { APT: 5 }, exact: true });
    expect(facts.byAsset).not.toHaveProperty('OFFICETEL');
  });

  it('needs no per-종류 reads when nothing is co-brokered, or with a single 종류', async () => {
    const { loadOfficeListingFacts } = await import('./server');
    primaryAnswers({}, 10);
    expect(await loadOfficeListingFacts(site())).toMatchObject({
      total: 10,
      byAsset: { APT: 6, OFFICETEL: 4 },
      exact: true,
    });
    expect(getAgencyListings).toHaveBeenCalledTimes(1);

    getAgencyListings.mockClear();
    primaryAnswers({}, 3);
    expect(await loadOfficeListingFacts(site({ APT: 7 }))).toMatchObject({
      total: 3,
      byAsset: { APT: 3 },
      exact: true,
    });
    expect(getAgencyListings).toHaveBeenCalledTimes(1);
  });

  it('marks the numbers inexact when a read fails (the tabs then hide their counts)', async () => {
    const { loadOfficeListingFacts } = await import('./server');
    primaryAnswers({ APT: 5, OFFICETEL: null }, 5);
    expect(await loadOfficeListingFacts(site())).toMatchObject({
      total: 5,
      byAsset: { APT: 5, OFFICETEL: 4 },
      exact: false,
    });
    primaryAnswers({}, null);
    expect(await loadOfficeListingFacts(site())).toMatchObject({ total: null, exact: false });
  });
});
