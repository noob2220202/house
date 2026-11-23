import { type ExecutionContext, Logger } from '@nestjs/common';
import type { AppConfig } from '../../../config/app-config.service';
import { AppException } from '../../../common/errors/app.exception';
import { AdminIpGuard } from './admin-ip.guard';
import { clientIpBucket, IpAllowlist, ipAllowed, normalizeIp } from './ip-allowlist';
import { normalizeRecoveryCode, PasswordService } from './password.service';
import { SecretBox } from './secret-box';
import { TotpService } from './totp.service';

const config = (env: Record<string, unknown>) =>
  ({ get: (k: string) => env[k] }) as unknown as AppConfig;

describe('IpAllowlist', () => {
  it('matches exact IPs and CIDRs (v4, v6, v4-mapped v6)', () => {
    const list = new IpAllowlist(['203.0.113.7', '10.0.0.0/8', '2001:db8::/32']);
    expect(list.allows('203.0.113.7')).toBe(true);
    expect(list.allows('::ffff:10.20.30.40')).toBe(true);
    expect(list.allows('2001:db8::1')).toBe(true);
    expect(list.allows('203.0.113.8')).toBe(false);
    expect(list.allows('2001:db9::1')).toBe(false);
    expect(list.allows(undefined)).toBe(false);
    expect(list.allows('garbage')).toBe(false);
  });

  it('an empty list allows everything; invalid entries fail loudly', () => {
    expect(new IpAllowlist([]).allows('1.2.3.4')).toBe(true);
    expect(() => new IpAllowlist(['10.0.0.0/33'])).toThrow();
    expect(() => new IpAllowlist(['not-an-ip'])).toThrow();
    // a broken per-account list must deny, not allow
    expect(ipAllowed(['bad'], '1.2.3.4')).toBe(false);
    expect(ipAllowed([], '1.2.3.4')).toBe(true);
    expect(normalizeIp('::ffff:127.0.0.1')).toBe('127.0.0.1');
  });
});

describe('clientIpBucket', () => {
  it('keeps IPv4 addresses and buckets IPv6 by /64', () => {
    expect(clientIpBucket('198.51.100.7')).toBe('198.51.100.7');
    expect(clientIpBucket('::ffff:198.51.100.7')).toBe('198.51.100.7');
    expect(clientIpBucket('2001:db8:1:2::1')).toBe('2001:db8:1:2::/64');
    expect(clientIpBucket('2001:0DB8:0001:0002:ffff:1:2:3')).toBe('2001:db8:1:2::/64');
    expect(clientIpBucket('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(clientIpBucket('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
    expect(clientIpBucket('64:ff9b:1:2::198.51.100.7')).toBe('64:ff9b:1:2::/64');
    expect(clientIpBucket('::1')).toBe('0:0:0:0::/64');
    expect(clientIpBucket('::')).toBe('0:0:0:0::/64');
  });

  it('maps missing or invalid addresses to one shared bucket', () => {
    expect(clientIpBucket(undefined)).toBe('unknown');
    expect(clientIpBucket('')).toBe('unknown');
    expect(clientIpBucket('garbage')).toBe('unknown');
  });
});

describe('AdminIpGuard', () => {
  beforeAll(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));
  afterAll(() => jest.restoreAllMocks());
  const ctx = (originalUrl: string, ip: string) =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => ({ originalUrl, ip, path: originalUrl }) }),
    }) as unknown as ExecutionContext;

  it('enforces ADMIN_IP_ALLOWLIST on admin paths only', () => {
    const guard = new AdminIpGuard(config({ ADMIN_IP_ALLOWLIST: ['192.0.2.0/24'] }));
    expect(guard.canActivate(ctx('/api/v1/admin/auth/login', '192.0.2.10'))).toBe(true);
    expect(guard.canActivate(ctx('/api/v1/listings', '198.51.100.1'))).toBe(true);
    expect(() => guard.canActivate(ctx('/api/v1/admin/auth/login', '198.51.100.1'))).toThrow(
      AppException,
    );
    expect(() => guard.canActivate(ctx('/api/v1/admin', '198.51.100.1'))).toThrow(AppException);
  });

  it('is a no-op without an allowlist', () => {
    const guard = new AdminIpGuard(config({ ADMIN_IP_ALLOWLIST: [] }));
    expect(guard.canActivate(ctx('/api/v1/admin/x', '1.1.1.1'))).toBe(true);
  });
});

describe('SecretBox', () => {
  const box = new SecretBox(
    config({ TOTP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64') }),
  );

  it('round-trips and never leaks the plaintext', () => {
    const enc = box.encrypt('JBSWY3DPEHPK3PXP', 'totp:a');
    expect(enc).toMatch(/^v1\./);
    expect(enc).not.toContain('JBSWY3DPEHPK3PXP');
    expect(box.decrypt(enc, 'totp:a')).toBe('JBSWY3DPEHPK3PXP');
    expect(box.encrypt('x', 'a')).not.toBe(box.encrypt('x', 'a')); // random IV
  });

  it('rejects another owner (aad), tampering and another key', () => {
    const enc = box.encrypt('secret', 'totp:a');
    expect(() => box.decrypt(enc, 'totp:b')).toThrow();
    const parts = enc.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => box.decrypt(parts.join('.'), 'totp:a')).toThrow();
    const other = new SecretBox(
      config({ TOTP_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64') }),
    );
    expect(() => other.decrypt(enc, 'totp:a')).toThrow();
    expect(() => new SecretBox(config({ TOTP_ENCRYPTION_KEY: 'c2hvcnQ=' }))).toThrow();
  });
});

describe('TotpService', () => {
  const totp = new TotpService();
  const secret = totp.generateSecret();
  const now = Date.UTC(2026, 0, 1, 0, 0, 15);

  it('accepts the current and adjacent windows and reports the matched step', () => {
    const code = totp.generate(secret, now);
    const step = Math.floor(now / 30_000);
    expect(totp.verify(secret, code, now)).toBe(step);
    expect(totp.verify(secret, code, now + 30_000)).toBe(step);
    expect(totp.verify(secret, code, now + 90_000)).toBeNull();
    expect(totp.verify(secret, 'abcdef', now)).toBeNull();
  });

  it('builds an otpauth URI', () => {
    expect(totp.keyUri('ops@example.com', secret)).toMatch(/^otpauth:\/\/totp\/.*secret=/);
  });
});

describe('PasswordService', () => {
  const passwords = new PasswordService();

  it('hashes with argon2id and verifies', async () => {
    await passwords.onModuleInit();
    const h = await passwords.hash('a-long-password-1');
    expect(h.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true);
    await expect(passwords.verify(h, 'a-long-password-1')).resolves.toBe(true);
    await expect(passwords.verify(h, 'wrong')).resolves.toBe(false);
    await expect(passwords.verify('not-a-hash', 'x')).resolves.toBe(false);
    await expect(passwords.verifyDummy('x')).resolves.toBe(false);
  });

  it('generates unambiguous, unique recovery codes', () => {
    const codes = passwords.generateRecoveryCodes(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$/);
    expect(normalizeRecoveryCode('abcd-efgh')).toBe('ABCDEFGH');
  });
});
