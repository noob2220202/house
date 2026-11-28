// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { visitorHeaders, visitorIp, visitorUserAgent } from './forward';

vi.mock('server-only', () => ({}));
/**
 * `unstable_cache` stand-in: one entry per key, kept until `expireDataCache()` (the revalidate
 * window passing). Records the options so the tests can check tags / revalidate.
 */
const dataCache = vi.hoisted(() => ({
  entries: new Map<string, unknown>(),
  options: [] as { keyParts: string[]; revalidate?: number | false; tags?: string[] }[],
}));
vi.mock('next/cache', () => ({
  unstable_cache:
    <T>(
      fn: () => Promise<T>,
      keyParts: string[],
      options: { revalidate?: number | false; tags?: string[] },
    ) =>
    async () => {
      dataCache.options.push({ keyParts, ...options });
      const key = JSON.stringify(keyParts);
      if (dataCache.entries.has(key)) return dataCache.entries.get(key) as T;
      const value = await fn();
      // Like Next: the JSON-serialisable outcome is stored, null included; throws are not.
      dataCache.entries.set(key, JSON.parse(JSON.stringify(value)) as unknown);
      return value;
    },
}));
const expireDataCache = () => dataCache.entries.clear();
const incoming = vi.hoisted(() => ({
  headers: new Headers(),
  cookies: [] as { name: string; value: string }[],
}));
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(incoming.headers),
  cookies: () =>
    Promise.resolve({
      getAll: () => incoming.cookies,
      get: (name: string) => incoming.cookies.find((c) => c.name === name),
    }),
}));

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  incoming.headers = new Headers({
    'x-real-ip': '203.0.113.7',
    // nginx overwrites both; a value a client could forge must never win over X-Real-IP.
    'x-forwarded-for': '198.51.100.1, 10.0.0.1',
    'user-agent': 'Mozilla/5.0 (iPhone) Safari',
  });
  incoming.cookies = [];
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const lastInit = () => fetchMock.mock.calls.at(-1)?.[1] as RequestInit & { next?: unknown };
const lastHeaders = () => lastInit().headers as Record<string, string>;

describe('visitor forwarding (lib/api/forward)', () => {
  it('takes the IP from nginx X-Real-IP only', () => {
    expect(visitorIp(new Headers({ 'x-real-ip': '203.0.113.7' }))).toBe('203.0.113.7');
    expect(visitorIp(new Headers({ 'x-real-ip': '2001:db8::1' }))).toBe('2001:db8::1');
    // Not through nginx: the client-supplied X-Forwarded-For is ignored.
    expect(visitorIp(new Headers({ 'x-forwarded-for': '198.51.100.1' }))).toBeNull();
    expect(visitorIp(new Headers({ 'x-real-ip': 'evil, 1.2.3.4' }))).toBeNull();
  });

  it('caps the User-Agent and drops control characters', () => {
    expect(visitorUserAgent(new Headers({ 'user-agent': 'a'.repeat(900) }))).toHaveLength(512);
    expect(visitorUserAgent(new Headers())).toBeNull();
  });

  it('always marks the call as SSR', () => {
    expect(visitorHeaders(new Headers())).toEqual({ 'x-house-ssr': '1' });
    expect(visitorHeaders(incoming.headers)).toEqual({
      'x-house-ssr': '1',
      'x-forwarded-for': '203.0.113.7',
      'user-agent': 'Mozilla/5.0 (iPhone) Safari',
    });
  });
});

describe('serverGetDetail (public detail reads that can turn into a 404)', () => {
  const schema = z.object({ id: z.string(), title: z.string() });
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  beforeEach(() => {
    dataCache.entries.clear();
    dataCache.options = [];
  });

  it('caches the outcome, so a listing hidden after a cached 200 turns into "not found"', async () => {
    const { serverGetDetail } = await import('./server');
    const read = () =>
      serverGetDetail('/listings/L1', { schema, revalidate: 60, tags: ['listings', 'listing:L1'] });

    fetchMock.mockResolvedValueOnce(json(200, { id: 'L1', title: '신대 레이크파크' }));
    expect(await read()).toEqual({ id: 'L1', title: '신대 레이크파크' });
    // The inner fetch is never put in Next's fetch cache (it would keep the 200 forever).
    expect(lastInit().cache).toBe('no-store');
    expect(lastInit().next).toBeUndefined();
    expect(lastHeaders()).toEqual({ accept: 'application/json', 'x-house-ssr': '1' });
    expect(dataCache.options.at(-1)).toEqual({
      keyParts: ['api-detail', '/listings/L1'],
      revalidate: 60,
      tags: ['listings', 'listing:L1'],
    });

    // Within the window: served from the data cache, no API call.
    expect(await read()).toEqual({ id: 'L1', title: '신대 레이크파크' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // The listing was hidden; once the window passes the 404 replaces the cached listing.
    expireDataCache();
    fetchMock.mockResolvedValueOnce(json(404, { code: 'LISTING_NOT_FOUND', message: '없음' }));
    expect(await read()).toBeNull();
    expect(await read()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('treats a malformed id (400) as not found, and throws (uncached) on other failures', async () => {
    const { serverGetDetail } = await import('./server');
    fetchMock.mockResolvedValueOnce(json(400, { code: 'VALIDATION_FAILED', message: 'x' }));
    expect(await serverGetDetail('/agencies/x', { schema, revalidate: 120, tags: [] })).toBeNull();

    fetchMock.mockResolvedValueOnce(json(500, { code: 'INTERNAL_ERROR', message: 'x' }));
    await expect(
      serverGetDetail('/agencies/b01', { schema, revalidate: 120, tags: [] }),
    ).rejects.toMatchObject({ status: 500 });
    fetchMock.mockResolvedValueOnce(json(200, { id: 'b01', title: '신대중앙' }));
    expect(await serverGetDetail('/agencies/b01', { schema, revalidate: 120, tags: [] })).toEqual({
      id: 'b01',
      title: '신대중앙',
    });
  });
});

describe('serverGet / serverGetAuthed', () => {
  it('cached reads carry only the SSR marker (one shared cache entry, page stays static)', async () => {
    const { serverGet } = await import('./server');
    await serverGet('/notices', { revalidate: 120, tags: ['notices'] });
    expect(lastInit().next).toEqual({ revalidate: 120, tags: ['notices'] });
    expect(lastInit().cache).toBeUndefined();
    expect(lastHeaders()).toEqual({ accept: 'application/json', 'x-house-ssr': '1' });
  });

  it('revalidate 0 is a per-request read on behalf of the visitor (no data cache)', async () => {
    const { serverGet } = await import('./server');
    await serverGet('/complexes', { query: { q: '아무거나' }, revalidate: 0 });
    expect(lastInit().cache).toBe('no-store');
    expect(lastInit().next).toBeUndefined();
    expect(lastHeaders()).toMatchObject({
      'x-house-ssr': '1',
      'x-forwarded-for': '203.0.113.7',
      'user-agent': 'Mozilla/5.0 (iPhone) Safari',
    });
  });

  it('authed reads forward cookies and the visitor', async () => {
    incoming.cookies = [{ name: 'sid', value: 'a b' }];
    const { serverGetAuthed } = await import('./server');
    await serverGetAuthed('/auth/me');
    expect(lastInit().cache).toBe('no-store');
    expect(lastHeaders()).toMatchObject({
      cookie: 'sid=a%20b',
      'x-house-ssr': '1',
      'x-forwarded-for': '203.0.113.7',
      'user-agent': 'Mozilla/5.0 (iPhone) Safari',
    });
  });

  it('forwards nothing about the visitor when the request did not pass nginx', async () => {
    incoming.headers = new Headers({ 'x-forwarded-for': '198.51.100.1' });
    const { serverGetAuthed } = await import('./server');
    await serverGetAuthed('/auth/me');
    expect(lastHeaders()['x-forwarded-for']).toBeUndefined();
    expect(lastHeaders()['x-house-ssr']).toBe('1');
  });
});
