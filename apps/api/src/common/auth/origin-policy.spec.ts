import type { Request } from 'express';
import { OriginPolicy } from './origin-policy';

const req = (url: string, origin?: string): Request =>
  ({ originalUrl: url, url, headers: origin ? { origin } : {} }) as unknown as Request;

const policy = new OriginPolicy({
  publicBaseUrl: 'https://suncheonmap.kr',
  adminBaseUrl: 'https://admin.suncheonmap.kr/',
  // As deploy/install.sh used to write it: both sites in one list.
  userOrigins: [
    'https://suncheonmap.kr',
    'https://admin.suncheonmap.kr',
    'https://www.suncheonmap.kr/',
  ],
  adminOrigins: ['https://suncheonmap.kr', 'http://127.0.0.1:3001'],
});

describe('OriginPolicy', () => {
  it('admin routes accept only the admin site (+ admin extras), never the public site', () => {
    for (const path of ['/api/v1/admin/auth/csrf', '/api/v1/admin', '/api/v1//Admin/users?x=1']) {
      expect(policy.allows(req(path), 'https://admin.suncheonmap.kr')).toBe(true);
      expect(policy.allows(req(path), 'http://127.0.0.1:3001')).toBe(true);
      expect(policy.allows(req(path), 'https://suncheonmap.kr')).toBe(false);
      expect(policy.allows(req(path), 'https://www.suncheonmap.kr')).toBe(false);
    }
  });

  it('user routes accept only the public site (+ user extras), never the admin site', () => {
    for (const path of ['/api/v1/me', '/api/v1/administrator', '/api/v1/listings/admin']) {
      expect(policy.allows(req(path), 'https://suncheonmap.kr')).toBe(true);
      expect(policy.allows(req(path), 'https://www.suncheonmap.kr')).toBe(true);
      expect(policy.allows(req(path), 'https://admin.suncheonmap.kr')).toBe(false);
      expect(policy.allows(req(path), 'http://127.0.0.1:3001')).toBe(false);
    }
  });

  it('normalizes configured origins and compares exactly', () => {
    expect([...policy.user]).toEqual(['https://suncheonmap.kr', 'https://www.suncheonmap.kr']);
    expect([...policy.admin]).toEqual(['https://admin.suncheonmap.kr', 'http://127.0.0.1:3001']);
    expect(policy.allows(req('/api/v1/me'), 'https://suncheonmap.kr.evil.example')).toBe(false);
    expect(policy.allows(req('/api/v1/me'), 'http://suncheonmap.kr')).toBe(false);
    expect(policy.allows(req('/api/v1/me'), 'null')).toBe(false);
  });

  it('keeps a shared origin on both surfaces only when both sites really use it (dev)', () => {
    const same = new OriginPolicy({
      publicBaseUrl: 'http://localhost:3000',
      adminBaseUrl: 'http://localhost:3000',
      userOrigins: [],
      adminOrigins: [],
    });
    expect(same.allows(req('/api/v1/admin/x'), 'http://localhost:3000')).toBe(true);
    expect(same.allows(req('/api/v1/x'), 'http://localhost:3000')).toBe(true);
  });

  describe('office sites (<slug>.<SITE_ROOT_DOMAIN>)', () => {
    const sites = new OriginPolicy({
      publicBaseUrl: 'https://suncheonmap.kr',
      adminBaseUrl: 'https://admin.suncheonmap.kr',
      userOrigins: [],
      adminOrigins: [],
      siteRootDomain: 'suncheonmap.kr',
    });
    const user = '/api/v1/listings/1/view';

    it('user routes accept any valid office host with the public protocol and port', () => {
      for (const origin of ['https://gangnam.suncheonmap.kr', 'https://a1-b2.suncheonmap.kr']) {
        expect(sites.isSiteOrigin(origin)).toBe(true);
        expect(sites.allows(req(user), origin)).toBe(true);
      }
    });

    it('admin routes never accept an office host', () => {
      for (const path of ['/api/v1/admin/auth/csrf', '/api/v1/admin/agencies']) {
        expect(sites.allows(req(path), 'https://gangnam.suncheonmap.kr')).toBe(false);
        expect(sites.forRequest(req(path, 'https://gangnam.suncheonmap.kr')).size).toBe(1);
      }
    });

    it('refuses reserved labels, invalid labels, nested hosts and look-alikes', () => {
      for (const origin of [
        'https://admin.suncheonmap.kr',
        'https://www.suncheonmap.kr',
        'https://api.suncheonmap.kr',
        'https://xn--hq1b.suncheonmap.kr',
        'https://ab.suncheonmap.kr',
        'https://-abc.suncheonmap.kr',
        'https://a.b.suncheonmap.kr',
        'https://gangnam.suncheonmap.kr.evil.example',
        'https://gangnamsuncheonmap.kr',
        'https://suncheonmap.kr',
        'https://Gangnam.suncheonmap.kr',
        'https://gangnam.suncheonmap.kr/',
        'null',
        'not a url',
      ]) {
        expect(sites.isSiteOrigin(origin)).toBe(false);
      }
      // The public site itself stays allowed through the list, not the pattern.
      expect(sites.allows(req(user), 'https://suncheonmap.kr')).toBe(true);
    });

    it('refuses another protocol or port', () => {
      expect(sites.allows(req(user), 'http://gangnam.suncheonmap.kr')).toBe(false);
      expect(sites.allows(req(user), 'https://gangnam.suncheonmap.kr:8443')).toBe(false);
      const dev = new OriginPolicy({
        publicBaseUrl: 'http://localhost:3000',
        adminBaseUrl: 'http://localhost:3001',
        userOrigins: [],
        adminOrigins: [],
        siteRootDomain: 'localhost',
      });
      expect(dev.allows(req(user), 'http://gangnam.localhost:3000')).toBe(true);
      expect(dev.allows(req(user), 'http://gangnam.localhost:3001')).toBe(false);
      expect(dev.allows(req(user), 'http://gangnam.localhost')).toBe(false);
      expect(dev.allows(req(user), 'https://gangnam.localhost:3000')).toBe(false);
    });

    it('forRequest (CORS) never lists an office origin: only CsrfGuard accepts them', () => {
      // A credentialed fetch from an office host to the apex API carries the main-site session.
      const set = sites.forRequest(req(user, 'https://gangnam.suncheonmap.kr'));
      expect([...set]).toEqual(['https://suncheonmap.kr']);
      expect([...sites.forRequest(req(user, 'https://admin.suncheonmap.kr'))]).toEqual([
        'https://suncheonmap.kr',
      ]);
      expect(sites.allows(req(user), 'https://gangnam.suncheonmap.kr')).toBe(true);
      expect(sites.user.size).toBe(1);
    });

    it('is off without a root domain or for an IP root', () => {
      expect(policy.isSiteOrigin('https://gangnam.suncheonmap.kr')).toBe(false);
      const ip = new OriginPolicy({
        publicBaseUrl: 'http://127.0.0.1:3000',
        adminBaseUrl: 'http://127.0.0.1:3001',
        userOrigins: [],
        adminOrigins: [],
        siteRootDomain: '127.0.0.1',
      });
      expect(ip.isSiteOrigin('http://abc.127.0.0.1:3000')).toBe(false);
    });
  });
});
