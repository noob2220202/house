// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchCacheSeconds } from '../search/popular';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Headers({ 'x-real-ip': '203.0.113.7' })),
  cookies: () => Promise.resolve({ getAll: () => [], get: () => undefined }),
}));

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 1 }), { status: 200 }),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

type Init = RequestInit & { next?: { revalidate?: number } };
const callsTo = (path: string) =>
  fetchMock.mock.calls
    .filter(([url]) => new URL(String(url)).pathname.endsWith(path))
    .map(([url, init]) => ({ url: String(url), init: init as Init }));

describe('getSearchResults caching', () => {
  it('reads free-text q per request: nothing lands in the fetch cache', async () => {
    const { getSearchResults } = await import('./server');
    await getSearchResults('랜덤검색어-12345');
    for (const path of ['/complexes', '/agencies']) {
      const [call] = callsTo(path);
      expect(call?.url).toContain('q=');
      expect(call?.init.cache).toBe('no-store');
      expect(call?.init.next).toBeUndefined();
    }
  });

  it('caches only the fixed popular keywords', async () => {
    expect(searchCacheSeconds('신대지구')).toBe(60);
    expect(searchCacheSeconds('신대지구2')).toBe(0);
    const { getSearchResults } = await import('./server');
    await getSearchResults('신대지구', 'complex');
    const [call] = callsTo('/complexes');
    expect(call?.init.next?.revalidate).toBe(60);
    expect(call?.init.cache).toBeUndefined();
  });
});
