import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware } from './middleware';

// Behind nginx the Next server sees its own address (https://localhost:3000); a redirect built from
// req.nextUrl would send visitors to localhost (live bug). The login redirect must be relative.
const req = (path: string, cookie?: string) =>
  new NextRequest(`https://localhost:3000${path}`, {
    headers: {
      host: 'suncheonmap.kr',
      'x-forwarded-proto': 'https',
      ...(cookie ? { cookie } : {}),
    },
  });

describe('web middleware', () => {
  it('redirects a protected page to a relative /login without leaking the internal host', () => {
    const res = middleware(req('/deal/sell'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'https://suncheonmap.kr/login?returnTo=%2Fdeal%2Fsell',
    );
  });

  it('keeps the query string in returnTo', () => {
    const res = middleware(req('/me/requests?tab=closed'));
    expect(res.headers.get('location')).toBe(
      'https://suncheonmap.kr/login?returnTo=%2Fme%2Frequests%3Ftab%3Dclosed',
    );
  });

  it('lets a request with the session cookie through', () => {
    const res = middleware(req('/me', 'house_sid=abc'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('falls back to the request origin when Host is missing or malformed', () => {
    const bad = new NextRequest('https://localhost:3000/me', { headers: { host: 'evil.com/x' } });
    expect(new URL(middleware(bad).headers.get('location') ?? '').host).toBe('localhost:3000');
  });
});
