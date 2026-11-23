import { AdminRole, ErrorCode } from '@house/shared';
import type { AdminUser } from '@prisma/client';
import type { Response, Test } from 'supertest';
import { createAdmin, loginAdmin, type TestApp, type TestSession, withSession } from '../../utils';

export const api = (path: string): string => `/api/v1${path}`;

/** A real browser UA (supertest sends none, which counts as a bot). */
export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

export interface AdminActor {
  admin: AdminUser;
  session: TestSession;
}

export async function adminActor(
  t: TestApp,
  role: AdminRole = AdminRole.ADMIN,
  opts: { mfaVerified?: boolean } = {},
): Promise<AdminActor> {
  const admin = await createAdmin(t.prisma, { role });
  const session = await loginAdmin(t.app, { id: admin.id, role }, opts);
  return { admin, session };
}

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

export function as(t: TestApp, session: TestSession, method: Method, path: string): Test {
  return withSession(t.http()[method](api(path)), session);
}

export function expectCode(res: Response, code: ErrorCode): void {
  expect((res.body as { code?: string }).code).toBe(code);
}

/** Audit rows of an action (oldest first). */
export function auditRows(t: TestApp, action: string) {
  return t.prisma.auditLog.findMany({ where: { action }, orderBy: { createdAt: 'asc' } });
}

/**
 * Standard authz checks for an admin route: no session → 401, a site-user cookie → 401 (ignored on
 * /admin), TOTP not verified → 401 AUTH_TOTP_REQUIRED, and (optionally) a too-low role → 403.
 */
export async function expectAdminAuthz(
  t: TestApp,
  method: Method,
  path: string,
  opts: { userSession: TestSession; lowRole?: AdminRole; body?: object },
): Promise<void> {
  const send = (req: Test): Test => (opts.body ? req.send(opts.body) : req);
  await send(t.http()[method](api(path))).expect(401);
  await send(withSession(t.http()[method](api(path)), opts.userSession)).expect(401);
  const pre = await adminActor(t, AdminRole.SUPER_ADMIN, { mfaVerified: false });
  const res = await send(as(t, pre.session, method, path)).expect(401);
  expectCode(res, ErrorCode.AUTH_TOTP_REQUIRED);
  if (opts.lowRole) {
    const low = await adminActor(t, opts.lowRole);
    const forbidden = await send(as(t, low.session, method, path)).expect(403);
    expectCode(forbidden, ErrorCode.FORBIDDEN);
  }
}

/** `pluck(res.body.items, 'id')` — field values of a JSON array from a response body. */
export function pluck(items: unknown, key: string): unknown[] {
  return (items as Record<string, unknown>[]).map((item) => item[key]);
}
