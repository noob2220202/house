// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Headers()),
  cookies: () => Promise.resolve({ getAll: () => [], get: () => undefined }),
}));

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
const urlOf = (url: unknown) => new URL(url as string);
const pathOf = (url: unknown) => urlOf(url).pathname;

describe('getBrandPanelFacts', () => {
  it('reads the newest verified listing, the 실거래 report and the summary — short timeout, cached', async () => {
    fetchMock.mockImplementation((url) => {
      const path = pathOf(url);
      if (path.endsWith('/listings')) {
        return json({
          items: [
            {
              id: 'L1',
              assetType: 'APT',
              dealType: 'SALE',
              complex: { id: 'C1', name: '해룡 중앙 아파트' },
              exclusiveArea: 84.97,
              salePrice: 41000,
              verifiedAt: '2026-11-20T03:00:00Z',
              agencyCount: 2,
            },
          ],
          page: 1,
          pageSize: 1,
          total: 1,
          totalPages: 1,
        });
      }
      if (path.endsWith('/home/summary')) return json({ agencyCount: 41 });
      return Promise.resolve(new Response('{}', { status: 503 }));
    });
    const { getBrandPanelFacts, BRAND_FACTS_TIMEOUT_MS } = await import('./brand-facts');
    const facts = await getBrandPanelFacts();
    expect(facts.highlight).toMatchObject({ kind: 'listing', title: '해룡 중앙 아파트' });
    expect(facts.agencyCount).toBe(41);

    const listingCall = fetchMock.mock.calls.find(([u]) => pathOf(u).endsWith('/listings'));
    const q = urlOf(listingCall?.[0]).searchParams;
    expect(q.get('sort')).toBe('VERIFIED');
    expect(q.get('verifiedOnly')).toBe('true');
    expect(q.get('pageSize')).toBe('1');
    for (const [, init] of fetchMock.mock.calls) {
      expect((init as { next?: { revalidate?: number } }).next?.revalidate).toBeGreaterThan(0);
    }
    expect(BRAND_FACTS_TIMEOUT_MS).toBeLessThanOrEqual(2000);
  });

  it('hides every card when the API fails (never sample data, never throws)', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError('fetch failed')));
    const { getBrandPanelFacts } = await import('./brand-facts');
    await expect(getBrandPanelFacts()).resolves.toEqual({ highlight: null, agencyCount: null });
  });
});
