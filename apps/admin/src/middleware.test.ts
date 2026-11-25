import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware } from './middleware';

// Behind nginx the Next server sees its own address (https://localhost:3001); the login redirect
// must be relative so the browser stays on admin.<domain> (live bug).
const req = (path: string, cookie?: string) =>
  new NextRequest(`https://localhost:3001${path}`, {
    headers: { host: 'admin.suncheonmap.kr', ...(cookie ? { cookie } : {}) },
  });

describe('admin middleware', () => {
  it('redirects to a relative /login and still sends the CSP', () => {
    const res = middleware(req('/banners'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('/login?returnTo=%2Fbanners');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
  });

  it('sends the console root to plain /login', () => {
    expect(middleware(req('/')).headers.get('location')).toBe('/login');
  });

  it('lets /login and signed-in requests through', () => {
    expect(middleware(req('/login')).headers.get('location')).toBeNull();
    expect(middleware(req('/banners', 'house_admin_sid=x')).headers.get('location')).toBeNull();
  });
});
