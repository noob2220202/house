import { AdminRole, AdminStatus, COOKIE_NAMES, ErrorCode } from '@house/shared';
import type { AdminUser } from '@prisma/client';
import { PasswordService } from '../../../src/modules/auth/admin/password.service';
import { SecretBox } from '../../../src/modules/auth/admin/secret-box';
import { TotpService } from '../../../src/modules/auth/admin/totp.service';
import {
  hashSessionToken,
  SessionService,
} from '../../../src/modules/auth/session/session.service';
import {
  createAdmin,
  createUser,
  loginAdmin,
  loginUser,
  resetAll,
  withSession,
  type TestApp,
} from '../../utils';
import { ADMIN_ORIGIN, createAuthTestApp, setCookies } from './helpers';

const PASSWORD = 'correct-horse-42-battery';

interface Browser {
  cookie: string;
  csrf: string;
}

describe('auth: admin login + TOTP (e2e)', () => {
  let t: TestApp;
  let totp: TotpService;
  let passwords: PasswordService;
  let box: SecretBox;
  let passwordHash: string;

  beforeAll(async () => {
    ({ t } = await createAuthTestApp());
    totp = t.app.get(TotpService);
    passwords = t.app.get(PasswordService);
    box = t.app.get(SecretBox);
    passwordHash = await passwords.hash(PASSWORD);
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  async function admin(
    opts: { enrolled?: boolean; data?: Parameters<typeof createAdmin>[1] } = {},
  ): Promise<{ admin: AdminUser; secret: string }> {
    const secret = totp.generateSecret();
    let row = await createAdmin(t.prisma, { passwordHash, ...opts.data });
    if (opts.enrolled) {
      row = await t.prisma.adminUser.update({
        where: { id: row.id },
        data: {
          totpSecretEnc: box.encrypt(secret, `totp:${row.id}`),
          totpEnabledAt: new Date(),
          recoveryCodeHashes: [await passwords.hash('ABCD2345')],
        },
      });
    }
    return { admin: row, secret };
  }

  const post = (path: string, b?: Browser) => {
    const req = t.http().post(`/api/v1/admin/auth/${path}`).set('Origin', ADMIN_ORIGIN);
    return b ? req.set('Cookie', b.cookie).set('x-csrf-token', b.csrf) : req;
  };
  const get = (path: string, b: Browser) =>
    t.http().get(`/api/v1/admin/auth/${path}`).set('Cookie', b.cookie);

  async function login(email: string, password = PASSWORD): Promise<Browser> {
    const res = await post('login').send({ email, password }).expect(200);
    const sid = setCookies(res)[COOKIE_NAMES.ADMIN_SESSION];
    return { cookie: `${COOKIE_NAMES.ADMIN_SESSION}=${sid}`, csrf: res.body.csrfToken as string };
  }

  function fromResponse(res: {
    headers: Record<string, unknown>;
    body: { csrfToken: string };
  }): Browser {
    const sid = setCookies(res as never)[COOKIE_NAMES.ADMIN_SESSION];
    return { cookie: `${COOKIE_NAMES.ADMIN_SESSION}=${sid}`, csrf: res.body.csrfToken };
  }

  describe('POST /api/v1/admin/auth/login', () => {
    it('password ok → short pre-TOTP session that cannot use admin routes', async () => {
      const { admin: a } = await admin({ enrolled: true });
      const res = await post('login')
        .send({ email: a.email.toUpperCase(), password: PASSWORD })
        .expect(200);
      expect(res.body).toMatchObject({ mfaRequired: true, totpEnrolled: true });
      const b = fromResponse(res);
      const denied = await get('me', b).expect(401);
      expect(denied.body.code).toBe(ErrorCode.AUTH_TOTP_REQUIRED);
      const token = b.cookie.split('=')[1] ?? '';
      const ttl = await t.redis.ttl(`session:${hashSessionToken(token)}`);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(600);
    });

    it('401 for a wrong password or unknown email (same error)', async () => {
      const { admin: a } = await admin();
      const wrong = await post('login')
        .send({ email: a.email, password: 'nope-nope-1234' })
        .expect(401);
      const unknown = await post('login')
        .send({ email: 'nobody@example.test', password: PASSWORD })
        .expect(401);
      expect(wrong.body.code).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
      expect(unknown.body).toMatchObject({ code: wrong.body.code, message: wrong.body.message });
      const disabled = await admin({ data: { status: AdminStatus.DISABLED } });
      await post('login').send({ email: disabled.admin.email, password: PASSWORD }).expect(401);
    });

    it('locks after 5 wrong passwords; while locked even the right password gets the same 401', async () => {
      const { admin: a } = await admin();
      for (let i = 0; i < 5; i++) {
        const res = await post('login')
          .send({ email: a.email, password: `wrong-${i}-password` })
          .expect(401);
        expect(res.body.code).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
      }
      const res = await post('login').send({ email: a.email, password: PASSWORD }).expect(401);
      expect(res.body.code).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
      expect(setCookies(res)[COOKIE_NAMES.ADMIN_SESSION]).toBeUndefined();
      const row = await t.prisma.adminUser.findUniqueOrThrow({ where: { id: a.id } });
      expect(row.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
      const audit = await t.prisma.auditLog.findFirstOrThrow({
        where: { action: 'admin.account.lock', resourceId: a.id },
      });
      expect(audit.ip).toBeDefined();
    });

    it('does not reveal whether an email exists or, while locked, whether the password is right', async () => {
      const { admin: a } = await admin({
        data: { lockedUntil: new Date(Date.now() + 10 * 60_000) },
      });
      const lockedRight = await post('login').send({ email: a.email, password: PASSWORD });
      const lockedWrong = await post('login').send({ email: a.email, password: 'bad-pw-0001' });
      const unknown = await post('login').send({ email: 'ghost@example.test', password: PASSWORD });
      for (const res of [lockedRight, lockedWrong, unknown]) {
        expect(res.status).toBe(401);
        expect(res.body.code).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
        expect(setCookies(res)[COOKIE_NAMES.ADMIN_SESSION]).toBeUndefined();
      }
    });

    it('a password success does not reset the counter: password + 4 bad codes, twice → 423', async () => {
      const { admin: a, secret } = await admin({ enrolled: true });
      const good = totp.generate(secret);
      const wrong = good === '000000' ? '999999' : '000000';
      const first = await login(a.email);
      for (let i = 0; i < 4; i++) {
        await post('totp/verify', first).send({ code: wrong }).expect(401);
      }
      const second = await login(a.email); // right password again
      const res = await post('totp/verify', second).send({ code: wrong }).expect(423);
      expect(res.body.code).toBe(ErrorCode.AUTH_ACCOUNT_LOCKED);
      const row = await t.prisma.adminUser.findUniqueOrThrow({ where: { id: a.id } });
      expect(row.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
      await post('totp/verify', second).send({ code: good }).expect(401); // sessions destroyed
    });

    it('a completed second factor resets the counter', async () => {
      const { admin: a, secret } = await admin({ enrolled: true });
      await post('login').send({ email: a.email, password: 'wrong-password-1' }).expect(401);
      const pre = await login(a.email);
      await post('totp/verify', pre)
        .send({ code: totp.generate(secret) })
        .expect(200);
      const row = await t.prisma.adminUser.findUniqueOrThrow({ where: { id: a.id } });
      expect(row.failedLoginCount).toBe(0);
    });

    it('outside the per-account IP allowlist: the same 401, nothing counted toward the lock', async () => {
      const { admin: a } = await admin({ data: { ipAllowlist: ['203.0.113.0/24'] } });
      const right = await post('login').send({ email: a.email, password: PASSWORD }).expect(401);
      const wrong = await post('login')
        .send({ email: a.email, password: 'wrong-password-9' })
        .expect(401);
      expect(right.body.code).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
      expect(right.body.message).toBe(wrong.body.message);
      expect(wrong.body.code).toBe(right.body.code);
      for (let i = 0; i < 5; i++) {
        await post('login')
          .send({ email: a.email, password: `x-${i}-password` })
          .expect(401);
      }
      const row = await t.prisma.adminUser.findUniqueOrThrow({ where: { id: a.id } });
      expect(row).toMatchObject({ failedLoginCount: 0, lockedUntil: null });
      const ok = await admin({ data: { ipAllowlist: ['127.0.0.1', '::1'] } });
      await post('login').send({ email: ok.admin.email, password: PASSWORD }).expect(200);
    });

    it('400 for a malformed body', async () => {
      const res = await post('login').send({ email: 'not-an-email', password: '' }).expect(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
    });

    it('403 from a foreign origin', async () => {
      const { admin: a } = await admin();
      await t
        .http()
        .post('/api/v1/admin/auth/login')
        .set('Origin', 'https://evil.example')
        .send({ email: a.email, password: PASSWORD })
        .expect(403);
    });
  });

  describe('TOTP enrollment: POST /totp/setup + /totp/activate', () => {
    it('first login enrolls, returns recovery codes once and rotates into a verified session', async () => {
      const { admin: a } = await admin();
      const pre = await login(a.email);
      const setup = await post('totp/setup', pre).expect(200);
      expect(setup.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
      const code = totp.generate(setup.body.secret as string);
      const res = await post('totp/activate', pre).send({ code }).expect(200);
      expect(res.body.recoveryCodes).toHaveLength(10);
      expect(res.body.recoveryCodes[0]).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
      expect(res.body.admin).toMatchObject({
        id: a.id,
        totpEnabled: true,
        recoveryCodesRemaining: 10,
      });

      const verified = fromResponse(res);
      expect(verified.cookie).not.toBe(pre.cookie);
      await get('me', pre).expect(401); // old pre-MFA token is gone
      await get('me', verified).expect(200);

      const row = await t.prisma.adminUser.findUniqueOrThrow({ where: { id: a.id } });
      expect(row.totpSecretEnc).not.toContain(setup.body.secret);
      expect(row.recoveryCodeHashes.every((h) => h.startsWith('$argon2id$'))).toBe(true);
      const audit = await t.prisma.auditLog.findFirstOrThrow({
        where: { action: 'admin.totp.enable' },
      });
      expect(audit).toMatchObject({ adminUserId: a.id, resourceId: a.id });
    });

    it('401 without an admin session; enrolled admins must verify before re-enrolling', async () => {
      await post('totp/setup').expect(401);
      const { admin: a } = await admin({ enrolled: true });
      const pre = await login(a.email);
      const res = await post('totp/setup', pre).expect(401);
      expect(res.body.code).toBe(ErrorCode.AUTH_TOTP_REQUIRED);
    });

    it('400 for a malformed code, an expired setup; 401 for a wrong code', async () => {
      const { admin: a } = await admin();
      const pre = await login(a.email);
      const bad = await post('totp/activate', pre).send({ code: '12ab' }).expect(400);
      expect(bad.body.code).toBe(ErrorCode.VALIDATION_FAILED);
      const expired = await post('totp/activate', pre).send({ code: '123456' }).expect(400);
      expect(expired.body.code).toBe(ErrorCode.AUTH_TOTP_SETUP_EXPIRED);
      const setup = await post('totp/setup', pre).expect(200);
      const wrongCode =
        totp.generate(setup.body.secret as string) === '000000' ? '111111' : '000000';
      const wrong = await post('totp/activate', pre).send({ code: wrongCode }).expect(401);
      expect(wrong.body.code).toBe(ErrorCode.AUTH_TOTP_INVALID);
    });
  });

  describe('TOTP rotation (enrolled admin)', () => {
    async function verified(a: AdminUser, secret: string): Promise<Browser> {
      const pre = await login(a.email);
      const res = await post('totp/verify', pre)
        .send({ code: totp.generate(secret) })
        .expect(200);
      return fromResponse(res);
    }

    it('a verified session alone cannot rotate: 403 AUTH_REAUTH_REQUIRED', async () => {
      const { admin: a, secret } = await admin({ enrolled: true });
      const b = await verified(a, secret);
      const res = await post('totp/setup', b).send({}).expect(403);
      expect(res.body.code).toBe(ErrorCode.AUTH_REAUTH_REQUIRED);
      const onlyPassword = await post('totp/setup', b)
        .send({ currentPassword: PASSWORD })
        .expect(403);
      expect(onlyPassword.body.code).toBe(ErrorCode.AUTH_REAUTH_REQUIRED);
      expect(await t.redis.exists(`auth:totp-setup:${a.id}`)).toBe(0);
    });

    it('wrong password or wrong code → 401 and counted; a recovery code is not burnt by a wrong password', async () => {
      const { admin: a, secret } = await admin({ enrolled: true });
      const b = await verified(a, secret);
      const badPw = await post('totp/setup', b)
        .send({ currentPassword: 'wrong-password-1', recoveryCode: 'ABCD-2345' })
        .expect(401);
      expect(badPw.body.code).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
      const badCode = await post('totp/setup', b)
        .send({
          currentPassword: PASSWORD,
          code: '000000' === totp.generate(secret) ? '111111' : '000000',
        })
        .expect(401);
      expect(badCode.body.code).toBe(ErrorCode.AUTH_TOTP_INVALID);
      const row = await t.prisma.adminUser.findUniqueOrThrow({ where: { id: a.id } });
      expect(row.failedLoginCount).toBe(2);
      expect(row.recoveryCodeHashes).toHaveLength(1);
    });

    it('password + recovery code → new secret; activation rotates, audits and ends other sessions', async () => {
      const { admin: a, secret } = await admin({ enrolled: true });
      const b = await verified(a, secret);
      const other = await loginAdmin(t.app, a);
      const setup = await post('totp/setup', b)
        .send({ currentPassword: PASSWORD, recoveryCode: 'abcd2345' })
        .expect(200);
      const next = setup.body.secret as string;
      expect(next).not.toBe(secret);
      // the pending secret is bound to the session that re-authenticated
      const res = await post('totp/activate', b)
        .send({ code: totp.generate(next) })
        .expect(200);
      expect(res.body.recoveryCodes).toHaveLength(10);
      await withSession(t.http().get('/api/v1/admin/auth/me'), other).expect(401);
      const audit = await t.prisma.auditLog.findFirstOrThrow({
        where: { action: 'admin.totp.rotate', resourceId: a.id },
      });
      expect(audit.ip).toBeTruthy();
    });

    it('a pending setup cannot be activated from another session', async () => {
      const { admin: a } = await admin();
      const first = await login(a.email);
      const setup = await post('totp/setup', first).expect(200);
      const second = await login(a.email);
      const res = await post('totp/activate', second)
        .send({ code: totp.generate(setup.body.secret as string) })
        .expect(400);
      expect(res.body.code).toBe(ErrorCode.AUTH_TOTP_SETUP_EXPIRED);
    });

    it('400 for a body with both a code and a recovery code', async () => {
      const { admin: a, secret } = await admin({ enrolled: true });
      const b = await verified(a, secret);
      const res = await post('totp/setup', b)
        .send({ currentPassword: PASSWORD, code: '123456', recoveryCode: 'ABCD-2345' })
        .expect(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
    });
  });

  describe('POST /api/v1/admin/auth/totp/verify', () => {
    it('accepts the current code once (replay rejected)', async () => {
      const { admin: a, secret } = await admin({ enrolled: true });
      const pre = await login(a.email);
      const code = totp.generate(secret);
      const res = await post('totp/verify', pre).send({ code }).expect(200);
      expect(res.body.admin).toMatchObject({ id: a.id, role: AdminRole.ADMIN });
      const b = fromResponse(res);
      await get('me', b).expect(200);

      const pre2 = await login(a.email);
      const replay = await post('totp/verify', pre2).send({ code }).expect(401);
      expect(replay.body.code).toBe(ErrorCode.AUTH_TOTP_INVALID);
    });

    it('accepts a recovery code exactly once', async () => {
      const { admin: a } = await admin({ enrolled: true });
      const pre = await login(a.email);
      const res = await post('totp/verify', pre).send({ recoveryCode: 'abcd-2345' }).expect(200);
      expect(res.body.admin.recoveryCodesRemaining).toBe(0);
      const pre2 = await login(a.email);
      await post('totp/verify', pre2).send({ recoveryCode: 'ABCD2345' }).expect(401);
    });

    it('locks the account and kills sessions after repeated wrong codes', async () => {
      const { admin: a, secret } = await admin({ enrolled: true });
      const pre = await login(a.email);
      const good = totp.generate(secret);
      const wrong = good === '000000' ? '999999' : '000000';
      for (let i = 0; i < 4; i++) await post('totp/verify', pre).send({ code: wrong }).expect(401);
      const locked = await post('totp/verify', pre).send({ code: wrong }).expect(423);
      expect(locked.body.code).toBe(ErrorCode.AUTH_ACCOUNT_LOCKED);
      await post('totp/verify', pre).send({ code: good }).expect(401); // session destroyed
      const res = await post('login').send({ email: a.email, password: PASSWORD }).expect(401);
      expect(res.body.code).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
    });

    it('401 without a session; 400 for a body with neither or both factors', async () => {
      await post('totp/verify').send({ code: '123456' }).expect(401);
      const { admin: a } = await admin({ enrolled: true });
      const pre = await login(a.email);
      await post('totp/verify', pre).send({}).expect(400);
      await post('totp/verify', pre)
        .send({ code: '123456', recoveryCode: 'ABCD-2345' })
        .expect(400);
    });

    it('400 when TOTP is not enrolled yet', async () => {
      const { admin: a } = await admin();
      const pre = await login(a.email);
      const res = await post('totp/verify', pre).send({ code: '123456' }).expect(400);
      expect(res.body.code).toBe(ErrorCode.AUTH_TOTP_NOT_ENROLLED);
    });
  });

  describe('GET /api/v1/admin/auth/me + /csrf', () => {
    it('returns the admin without secrets', async () => {
      const { admin: a } = await admin({ enrolled: true });
      const s = await loginAdmin(t.app, a);
      const res = await withSession(t.http().get('/api/v1/admin/auth/me'), s).expect(200);
      expect(res.body).toMatchObject({ id: a.id, email: a.email, totpEnabled: true });
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|totpSecret|recoveryCodeHashes/);
      const csrf = await withSession(t.http().get('/api/v1/admin/auth/csrf'), s).expect(200);
      expect(csrf.body.csrfToken).toBe(s.csrfToken);
    });

    it('401 for anonymous, pre-TOTP and user sessions', async () => {
      await t.http().get('/api/v1/admin/auth/me').expect(401);
      await t.http().get('/api/v1/admin/auth/csrf').expect(401);
      const { admin: a } = await admin();
      const pre = await loginAdmin(t.app, a, { mfaVerified: false });
      const res = await withSession(t.http().get('/api/v1/admin/auth/me'), pre).expect(401);
      expect(res.body.code).toBe(ErrorCode.AUTH_TOTP_REQUIRED);
      const user = await createUser(t.prisma);
      const us = await loginUser(t.app, user);
      await withSession(t.http().get('/api/v1/admin/auth/me'), us).expect(401);
    });

    it('a disabled admin loses the session', async () => {
      const { admin: a } = await admin({ enrolled: true });
      const s = await loginAdmin(t.app, a);
      await t.prisma.adminUser.update({
        where: { id: a.id },
        data: { status: AdminStatus.DISABLED },
      });
      await withSession(t.http().get('/api/v1/admin/auth/me'), s).expect(401);
      expect(await t.redis.get(`session:${s.sessionId}`)).toBeNull();
    });
  });

  describe('POST /api/v1/admin/auth/logout', () => {
    it('destroys the admin session', async () => {
      const { admin: a } = await admin({ enrolled: true });
      const s = await loginAdmin(t.app, a);
      const res = await withSession(t.http().post('/api/v1/admin/auth/logout'), s).expect(204);
      expect(setCookies(res)[COOKIE_NAMES.ADMIN_SESSION]).toBe('');
      await withSession(t.http().get('/api/v1/admin/auth/me'), s).expect(401);
    });

    it('401 without a session; 403 without the CSRF header', async () => {
      await post('logout').expect(401);
      const { admin: a } = await admin({ enrolled: true });
      const s = await loginAdmin(t.app, a);
      await t
        .http()
        .post('/api/v1/admin/auth/logout')
        .set('Cookie', s.cookie)
        .set('Origin', ADMIN_ORIGIN)
        .expect(403);
    });
  });

  describe('POST /api/v1/admin/auth/password', () => {
    it('changes the password, logs out other sessions and audits', async () => {
      const { admin: a } = await admin({ enrolled: true });
      const s1 = await loginAdmin(t.app, a);
      const s2 = await loginAdmin(t.app, a);
      const res = await withSession(t.http().post('/api/v1/admin/auth/password'), s1)
        .send({ currentPassword: PASSWORD, newPassword: 'another-strong-pass-77' })
        .expect(200);
      await withSession(t.http().get('/api/v1/admin/auth/me'), s2).expect(401);
      await get('me', fromResponse(res)).expect(200);
      await post('login').send({ email: a.email, password: PASSWORD }).expect(401);
      await post('login').send({ email: a.email, password: 'another-strong-pass-77' }).expect(200);
      expect(await t.prisma.auditLog.count({ where: { action: 'admin.password.change' } })).toBe(1);
    });

    it('401 for a wrong current password or no session', async () => {
      await post('password')
        .send({ currentPassword: 'x', newPassword: 'another-strong-pass-77' })
        .expect(401);
      const { admin: a } = await admin({ enrolled: true });
      const s = await loginAdmin(t.app, a);
      const res = await withSession(t.http().post('/api/v1/admin/auth/password'), s)
        .send({ currentPassword: 'wrong-password-1', newPassword: 'another-strong-pass-77' })
        .expect(401);
      expect(res.body.code).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
    });

    it('400 for a weak new password', async () => {
      const { admin: a } = await admin({ enrolled: true });
      const s = await loginAdmin(t.app, a);
      const res = await withSession(t.http().post('/api/v1/admin/auth/password'), s)
        .send({ currentPassword: PASSWORD, newPassword: 'short1' })
        .expect(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
    });
  });

  it('a stolen admin cookie stops working outside the account allowlist', async () => {
    const { admin: a } = await admin({ enrolled: true });
    const { token } = await t.app.get(SessionService).create({
      kind: 'ADMIN',
      adminId: a.id,
      role: a.role,
      mfaVerified: true,
      ipAllowlist: ['198.51.100.7'],
    });
    await t
      .http()
      .get('/api/v1/admin/auth/me')
      .set('Cookie', `${COOKIE_NAMES.ADMIN_SESSION}=${token}`)
      .expect(401);
  });
});
