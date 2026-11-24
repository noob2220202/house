import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './client';
import { forgetCsrfToken, getCsrfToken } from './csrf';

/**
 * Admin CSRF (apps/api README "use csrfToken from the body"): the token is bound to the admin
 * session, read from GET /admin/auth/csrf (never the shared `house_csrf` cookie) and replaced by
 * the token every session-rotating response returns.
 */
const fetchMock = vi.fn<typeof fetch>();
/** Header values as sent (the client reuses one headers object across its CSRF retry). */
const sent: (string | undefined)[] = [];
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const headerOf = (call: number) => sent[call];
const urlOf = (call: number) => {
  const input = fetchMock.mock.calls[call]![0];
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
};

beforeEach(() => {
  forgetCsrfToken();
  fetchMock.mockReset();
  sent.length = 0;
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    sent.push((init?.headers as Record<string, string> | undefined)?.['x-csrf-token']);
    return fetchMock(input, init);
  });
  // A user-site token in the shared cookie must never be sent to the admin API.
  document.cookie = 'house_csrf=user-site-token; path=/';
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = 'house_csrf=; path=/; max-age=0';
});

describe('admin CSRF token', () => {
  it('reads the session token from GET /admin/auth/csrf, not from the shared cookie', async () => {
    fetchMock.mockResolvedValueOnce(json({ csrfToken: 'admin-token' }));
    expect(await getCsrfToken()).toBe('admin-token');
    expect(urlOf(0)).toMatch(/\/admin\/auth\/csrf$/);
    // remembered: no second request
    expect(await getCsrfToken()).toBe('admin-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends no token without an admin session (the login is not CSRF-checked)', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ code: 'UNAUTHENTICATED', message: 'x' }, 401))
      .mockResolvedValueOnce(json({ mfaRequired: true, totpEnrolled: true, csrfToken: 'pre-mfa' }));
    await api.post('/admin/auth/login', { email: 'a@example.com', password: 'pw' });
    expect(headerOf(1)).toBeUndefined();
    // …and keeps the token of the new pre-MFA session for the TOTP step
    fetchMock.mockResolvedValueOnce(json({ admin: {}, csrfToken: 'verified' }));
    await api.post('/admin/auth/totp/verify', { code: '123456' });
    expect(headerOf(2)).toBe('pre-mfa');
    fetchMock.mockResolvedValueOnce(json({ ok: true }));
    await api.patch('/admin/banners/1', { title: 'x' });
    expect(headerOf(3)).toBe('verified');
  });

  it('re-reads the token once after a CSRF failure and forgets it on logout', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ csrfToken: 'stale' }))
      .mockResolvedValueOnce(json({ code: 'CSRF_FAILED', message: 'x' }, 403))
      .mockResolvedValueOnce(json({ csrfToken: 'fresh' }))
      .mockResolvedValueOnce(json({ ok: true }));
    await api.post('/admin/faqs', { q: 'x' });
    expect(headerOf(1)).toBe('stale');
    expect(urlOf(2)).toMatch(/\/admin\/auth\/csrf$/);
    expect(headerOf(3)).toBe('fresh');

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await api.post('/admin/auth/logout');
    fetchMock.mockResolvedValueOnce(json({ code: 'UNAUTHENTICATED', message: 'x' }, 401));
    expect(await getCsrfToken()).toBeNull();
  });
});
