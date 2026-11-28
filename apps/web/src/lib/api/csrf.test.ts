import { COOKIE_NAMES, ErrorCode, HEADER_NAMES } from '@house/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './client';
import { forgetCsrfToken, getCsrfToken, rememberCsrfToken } from './csrf';
import { ApiError } from './errors';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const csrfFailed = () =>
  json(403, { code: ErrorCode.CSRF_FAILED, message: '요청이 유효하지 않습니다.' });

interface Call {
  method: string;
  path: string;
  token: string | null;
}

/** Calls the stubbed backend received, in order. */
let calls: Call[];
/** What GET /auth/csrf answers (the current session's token), or a Response to send instead. */
let serverToken: string | Response;
/** Answers of the mutation endpoint, consumed in order (default 200 `{ ok: true }`). */
let answers: Response[];

const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
  const url = new URL(input, 'http://localhost');
  const path = url.pathname.replace(/^.*\/(mock-)?api\/v1/, '');
  const headers = new Headers(init?.headers);
  calls.push({ method: init?.method ?? 'GET', path, token: headers.get(HEADER_NAMES.CSRF) });
  if (path === '/auth/csrf') {
    if (serverToken instanceof Response) return serverToken;
    return json(200, { csrfToken: serverToken });
  }
  if (path === '/auth/signup') {
    return json(201, { user: { id: 'u1' }, returnTo: null, csrfToken: 'signup-token' });
  }
  if (path === '/auth/logout') return new Response(null, { status: 204 });
  return answers.shift() ?? json(200, { ok: true });
});

const mutations = () => calls.filter((c) => c.method !== 'GET');
const csrfFetches = () => calls.filter((c) => c.path === '/auth/csrf').length;

beforeEach(() => {
  calls = [];
  answers = [];
  serverToken = 'session-token';
  forgetCsrfToken();
  // The back office (same cookie name) wrote its own token last: it must never be sent.
  document.cookie = `${COOKIE_NAMES.CSRF}=admin-token; path=/`;
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockClear();
  document.cookie = `${COOKIE_NAMES.CSRF}=; path=/; max-age=0`;
});

describe('CSRF token (in memory, not the shared house_csrf cookie)', () => {
  it('asks GET /auth/csrf once and reuses the token for later mutations', async () => {
    await api.post('/favorites', { listingId: 'l1' });
    await api.delete('/favorites/l1');
    expect(csrfFetches()).toBe(1);
    expect(mutations().map((c) => c.token)).toEqual(['session-token', 'session-token']);
  });

  it('never sends a token on GET requests', async () => {
    await api.get('/listings');
    expect(calls).toEqual([{ method: 'GET', path: '/listings', token: null }]);
  });

  it('uses the csrfToken of a session-creating response (signup) without another round trip', async () => {
    await api.post('/auth/signup', { nickname: '하늘' });
    await api.post('/favorites', { listingId: 'l1' });
    expect(csrfFetches()).toBe(1); // only for the signup request itself
    expect(mutations().at(-1)).toMatchObject({ path: '/favorites', token: 'signup-token' });
  });

  it('shares one GET /auth/csrf between concurrent mutations', async () => {
    await Promise.all([api.post('/a'), api.post('/b'), api.patch('/c', {})]);
    expect(csrfFetches()).toBe(1);
    expect(new Set(mutations().map((c) => c.token))).toEqual(new Set(['session-token']));
  });

  it('refreshes via GET /auth/csrf on CSRF_FAILED and retries the mutation once', async () => {
    await api.post('/warm-up');
    serverToken = 'rotated-token';
    answers = [csrfFailed()];
    await expect(api.post('/favorites', { listingId: 'l1' })).resolves.toEqual({ ok: true });
    expect(mutations().slice(1)).toEqual([
      { method: 'POST', path: '/favorites', token: 'session-token' },
      { method: 'POST', path: '/favorites', token: 'rotated-token' },
    ]);
    expect(csrfFetches()).toBe(2);
    // The fresh token is kept for the next call.
    await api.post('/next');
    expect(mutations().at(-1)?.token).toBe('rotated-token');
  });

  it('gives up after one retry and surfaces CSRF_FAILED', async () => {
    answers = [csrfFailed(), csrfFailed()];
    const error = await api.post('/favorites').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 403, code: ErrorCode.CSRF_FAILED });
    expect(mutations()).toHaveLength(2);
  });

  it('does not retry other 403 refusals', async () => {
    answers = [json(403, { code: 'AUTH_FORBIDDEN', message: '권한이 없습니다.' })];
    await expect(api.post('/favorites')).rejects.toMatchObject({ code: 'AUTH_FORBIDDEN' });
    expect(mutations()).toHaveLength(1);
  });

  it('forgets the token on logout and on a 401', async () => {
    await api.post('/auth/signup', {});
    await api.post('/auth/logout');
    await api.post('/favorites');
    expect(mutations().at(-1)?.token).toBe('session-token'); // fetched again after logout

    answers = [json(401, { code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' })];
    await expect(api.post('/x')).rejects.toMatchObject({ status: 401 });
    serverToken = 'new-session-token';
    await api.post('/y');
    expect(mutations().at(-1)?.token).toBe('new-session-token');
  });

  it('works for an anonymous visitor whose GET /auth/csrf sets no cookie', async () => {
    // The API stops setting house_csrf without a session (so /auth/me is not probed on every
    // later page); the anonymous token comes from the body alone.
    document.cookie = `${COOKIE_NAMES.CSRF}=; path=/; max-age=0`;
    serverToken = 'anonymous-token';
    await api.post('/listings/l1/view');
    expect(mutations().map((c) => c.token)).toEqual(['anonymous-token']);
    expect(document.cookie).not.toContain(COOKIE_NAMES.CSRF);
  });

  it('falls back to the cookie only when GET /auth/csrf cannot answer', async () => {
    serverToken = json(503, { code: 'INTERNAL_ERROR', message: 'down' });
    await expect(getCsrfToken()).resolves.toBe('admin-token');
    // Nothing was remembered: the next call asks the server again.
    serverToken = 'session-token';
    await expect(getCsrfToken()).resolves.toBe('session-token');
  });

  it('a token remembered while a refresh is in flight is not overwritten by it', async () => {
    let release!: () => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(json(200, { csrfToken: 'stale-token' }));
        }),
    );
    const refresh = getCsrfToken();
    // e.g. a signup response arriving meanwhile
    rememberCsrfToken({ user: { id: 'u1' }, csrfToken: 'signup-token' });
    release();
    await expect(refresh).resolves.toBe('signup-token');
    await expect(getCsrfToken()).resolves.toBe('signup-token');
  });
});
