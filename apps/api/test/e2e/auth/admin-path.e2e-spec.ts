import { ErrorCode } from '@house/shared';
import type * as Utils from '../../utils';
import type * as Helpers from './helpers';

const ADMIN_ORIGIN = 'http://localhost:3001';

/**
 * Express matches routes case-insensitively, so the admin-path checks (global ADMIN_IP_ALLOWLIST,
 * admin cookie, audit) must too: no spelling of /api/v1/admin may reach an admin handler from a
 * non-allowlisted address.
 */
describe('auth: admin path detection vs. the global admin IP allowlist (e2e)', () => {
  let t: Utils.TestApp;
  let utils: typeof Utils;
  const saved = process.env.ADMIN_IP_ALLOWLIST;

  beforeAll(async () => {
    // Env is validated when the app modules are first loaded, so set it before importing them.
    process.env.ADMIN_IP_ALLOWLIST = '10.9.9.9';
    utils = await import('../../utils');
    const helpers: typeof Helpers = await import('./helpers');
    ({ t } = await helpers.createAuthTestApp());
  });
  beforeEach(() => utils.resetAll(t));
  afterAll(async () => {
    await t?.close();
    if (saved === undefined) delete process.env.ADMIN_IP_ALLOWLIST;
    else process.env.ADMIN_IP_ALLOWLIST = saved;
  });

  it.each([
    '/api/v1/admin/auth/login',
    '/api/v1/Admin/auth/login',
    '/API/V1/ADMIN/AUTH/LOGIN',
    '/api/v1/aDmIn/auth/login?x=1',
    '/api/v1//admin/auth/login',
    '/api/v1/%61dmin/auth/login',
  ])('POST %s from outside the allowlist never reaches the login handler', async (path) => {
    const a = await utils.createAdmin(t.prisma);
    const res = await t
      .http()
      .post(path)
      .set('Origin', ADMIN_ORIGIN)
      .send({ email: a.email, password: 'whatever-password-1' });
    expect([403, 404]).toContain(res.status);
    if (res.status === 403) expect(res.body.code).toBe(ErrorCode.AUTH_IP_NOT_ALLOWED);
    expect(res.body.code).not.toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
  });

  it('non-admin routes are unaffected', async () => {
    await t.http().get('/api/v1/health').expect(200);
  });

  it('an invalid body is refused by the IP check first (no validation details leak)', async () => {
    const res = await t
      .http()
      .post('/api/v1/ADMIN/auth/login')
      .set('Origin', ADMIN_ORIGIN)
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(403);
  });
});
