import type { Request } from 'express';
import { OriginPolicy } from './origin-policy';

const req = (url: string): Request => ({ originalUrl: url, url }) as unknown as Request;

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
});
