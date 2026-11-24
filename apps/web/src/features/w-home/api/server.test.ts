// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BANNER_REVALIDATE_SECONDS } from '../config';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Headers()),
  cookies: () => Promise.resolve({ getAll: () => [], get: () => undefined }),
}));

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => Promise.resolve(new Response('{}', { status: 503 })));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('getHomeData banner freshness', () => {
  it('reads every banner slot with the short window, so admin edits show within seconds', async () => {
    const { getHomeData } = await import('./server');
    await getHomeData();
    const bannerCalls = fetchMock.mock.calls.filter(([url]) =>
      new URL(url as string).pathname.endsWith('/banners'),
    );
    expect(bannerCalls).toHaveLength(3); // MAIN_HERO, MOBILE_MAIN, MAIN_STRIP
    for (const [, init] of bannerCalls) {
      expect((init as { next?: { revalidate?: number } }).next?.revalidate).toBe(
        BANNER_REVALIDATE_SECONDS,
      );
    }
    expect(BANNER_REVALIDATE_SECONDS).toBeLessThanOrEqual(15);
  });
});
