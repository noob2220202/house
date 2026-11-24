// @vitest-environment node
import type { NextConfig } from 'next';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware } from '../../middleware';
import { adminContentSecurityPolicy, createNonce, parseOrigins } from './csp';

const directives = (policy: string) =>
  new Map(
    policy.split(';').map((d) => {
      const [name = '', ...values] = d.trim().split(/\s+/);
      return [name, values] as const;
    }),
  );

describe('admin Content-Security-Policy', () => {
  it('locks scripts to the request nonce (no inline, no hosts, no eval in production)', () => {
    const p = directives(adminContentSecurityPolicy({ nonce: 'abc123' }));
    expect(p.get('script-src')).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
    expect(p.get('frame-ancestors')).toEqual(["'none'"]);
    expect(p.get('object-src')).toEqual(["'none'"]);
    expect(p.get('connect-src')).toEqual(["'self'"]);
    expect(p.get('frame-src')).toEqual(["'self'", 'blob:']);
  });

  it('adds media hosts and the dev-only allowances', () => {
    const p = directives(
      adminContentSecurityPolicy({
        nonce: 'n',
        dev: true,
        mediaHosts: parseOrigins('https://cdn.example.kr/x, not a url'),
      }),
    );
    expect(p.get('img-src')).toContain('https://cdn.example.kr');
    expect(p.get('script-src')).toContain("'unsafe-eval'");
  });

  it('creates a fresh 128-bit nonce each time', () => {
    const a = createNonce();
    expect(atob(a)).toHaveLength(16);
    expect(createNonce()).not.toBe(a);
  });
});

describe('middleware', () => {
  const nonceOf = (csp: string | null) => /'nonce-([^']+)'/.exec(csp ?? '')?.[1];

  it('sends the policy and hands the same nonce to Next on the request', () => {
    const res = middleware(new NextRequest('https://admin.example.kr/login'));
    const csp = res.headers.get('content-security-policy');
    expect(nonceOf(csp)).toBeTruthy();
    // NextResponse.next({ request: { headers } }) exposes overridden request headers like this.
    expect(res.headers.get('x-middleware-request-content-security-policy')).toBe(csp);
  });

  it('uses a different nonce per request and still sets it on the login redirect', () => {
    const a = middleware(new NextRequest('https://admin.example.kr/'));
    const b = middleware(new NextRequest('https://admin.example.kr/'));
    expect(a.status).toBe(307);
    expect(nonceOf(a.headers.get('content-security-policy'))).not.toBe(
      nonceOf(b.headers.get('content-security-policy')),
    );
  });
});

describe('next.config.mjs', () => {
  it('lets the image optimizer fetch /media only, never the API', async () => {
    const file = '../../../next.config.mjs';
    const config = ((await import(/* @vite-ignore */ file)) as { default: NextConfig }).default;
    // The optimizer may fetch local /media (and the mock stand-ins) only — no API path, and no
    // loopback API host (it could otherwise be pointed at any path on the API's port).
    expect(config.images?.unoptimized).toBeFalsy();
    expect(config.images?.localPatterns).toEqual([
      { pathname: '/media/**' },
      { pathname: '/mock-api/**' },
    ]);
    for (const p of config.images?.remotePatterns ?? []) {
      const host = p instanceof URL ? p.hostname : p.hostname;
      expect(['localhost', '127.0.0.1', '::1', '[::1]']).not.toContain(host);
    }
    const rewrites = (await config.rewrites?.()) as { source: string; destination: string }[];
    const media = rewrites.find((r) => r.source === '/media/:path*');
    expect(media?.destination).toMatch(/\/media\/:path\*$/);
  });
});
