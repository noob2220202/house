// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { visitorHeaders, visitorIp, visitorUserAgent } from './forward';

vi.mock('server-only', () => ({}));
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
