import express from 'express';
import type { Request } from 'express';
import { parseTrustProxy } from './configure-app';

/**
 * req.ip as the throttler (ip:<req.ip>), the admin IP allowlist and the audit/visitor logs see it,
 * for a request whose TCP peer is `peer` (Express computes it from the socket + X-Forwarded-For).
 */
function clientIp(trustProxy: string, peer: string, headers: Record<string, string> = {}): string {
  const app = express();
  app.set('trust proxy', parseTrustProxy(trustProxy));
  const socket = { remoteAddress: peer };
  const req = Object.create(app.request) as Request & Record<string, unknown>;
  Object.assign(req, { app, headers, socket, connection: socket });
  return req.ip as string;
}

describe('TRUST_PROXY=loopback (production: nginx and Next.js SSR on the same host)', () => {
  it('a loopback hop forwarding X-Forwarded-For resolves to the visitor (nginx, SSR)', () => {
    for (const peer of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
      expect(clientIp('loopback', peer, { 'x-forwarded-for': '203.0.113.9' })).toBe('203.0.113.9');
    }
    // x-house-ssr is informational only: it changes nothing.
    expect(
      clientIp('loopback', '127.0.0.1', { 'x-forwarded-for': '203.0.113.9', 'x-house-ssr': '1' }),
    ).toBe('203.0.113.9');
  });

  it('takes the right-most untrusted address, so a client-supplied prefix cannot spoof it', () => {
    // A proxy that appends ($proxy_add_x_forwarded_for) instead of overwriting.
    expect(
      clientIp('loopback', '127.0.0.1', { 'x-forwarded-for': '198.51.100.1, 203.0.113.9' }),
    ).toBe('203.0.113.9');
    // A forged loopback entry is skipped like a trusted hop, never returned.
    expect(clientIp('loopback', '127.0.0.1', { 'x-forwarded-for': '203.0.113.9, 127.0.0.1' })).toBe(
      '203.0.113.9',
    );
  });

  it('a remote peer cannot set its address with X-Forwarded-For', () => {
    expect(clientIp('loopback', '203.0.113.50', { 'x-forwarded-for': '198.51.100.1' })).toBe(
      '203.0.113.50',
    );
    expect(clientIp('loopback', '10.0.0.5', { 'x-forwarded-for': '127.0.0.1' })).toBe('10.0.0.5');
    expect(clientIp('loopback', '203.0.113.50', { 'x-house-ssr': '1' })).toBe('203.0.113.50');
  });

  it('without the header a loopback call is keyed as the loopback address (shared SSR bucket)', () => {
    expect(clientIp('loopback', '127.0.0.1')).toBe('127.0.0.1');
  });

  it('parses the other TRUST_PROXY forms', () => {
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('loopback, 10.0.0.0/8')).toBe('loopback, 10.0.0.0/8');
    expect(clientIp('false', '127.0.0.1', { 'x-forwarded-for': '203.0.113.9' })).toBe('127.0.0.1');
  });
});
