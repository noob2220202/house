import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware } from './middleware';

// Behind nginx the Next server sees its own address (https://localhost:3001); the login redirect
// must be relative so the browser stays on admin.<domain> (live bug).
const req = (path: string, cookie?: string) =>
  new NextRequest(`https://localhost:3001${path}`, {
    headers: {
      host: 'admin.suncheonmap.kr',
      'x-forwarded-proto': 'https',
      ...(cookie ? { cookie } : {}),
    },
  });

describe('admin middleware', () => {
  it('redirects to a relative /login and still sends the CSP', () => {
    const res = middleware(req('/banners'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'https://admin.suncheonmap.kr/login?returnTo=%2Fbanners',
    );
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
  });

  it('sends the console root to plain /login', () => {
    expect(middleware(req('/')).headers.get('location')).toBe('https://admin.suncheonmap.kr/login');
  });

  it('lets /login and signed-in requests through', () => {
    expect(middleware(req('/login')).headers.get('location')).toBeNull();
    expect(middleware(req('/banners', 'house_admin_sid=x')).headers.get('location')).toBeNull();
  });

  it('falls back to the request origin when Host is missing or malformed', () => {
    const bad = new NextRequest('https://localhost:3001/me', { headers: { host: 'evil.com/x' } });
    expect(new URL(middleware(bad).headers.get('location') ?? '').host).toBe('localhost:3001');
  });
});
