import { AdminRole, COOKIE_NAMES, HEADER_NAMES, UserRole } from '@house/shared';
import type { INestApplication } from '@nestjs/common';
import type { Test } from 'supertest';
import { SessionService } from '../../src/modules/auth/session/session.service';

/** Credentials for supertest: cookie + CSRF header + allowed Origin. */
export interface TestSession {
  cookie: string;
  csrfToken: string;
  origin: string;
  sessionId: string;
}

/** Creates a real Redis session for a site user (no OAuth round trip). */
export async function loginUser(
  app: INestApplication,
  user: { id: string; role?: UserRole },
  opts: { agencyId?: string | null } = {},
): Promise<TestSession> {
  const sessions = app.get(SessionService);
  const { token, record } = await sessions.create({
    kind: 'USER',
    userId: user.id,
    role: user.role ?? UserRole.USER,
    agencyId: opts.agencyId ?? null,
  });
  return {
    cookie: `${COOKIE_NAMES.SESSION}=${token}`,
    csrfToken: record.csrfToken,
    origin: process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000',
    sessionId: record.id,
  };
}

/** Creates a real Redis admin session; TOTP is considered verified unless mfaVerified=false. */
export async function loginAdmin(
  app: INestApplication,
  admin: { id: string; role?: AdminRole },
  opts: { mfaVerified?: boolean } = {},
): Promise<TestSession> {
  const sessions = app.get(SessionService);
  const { token, record } = await sessions.create({
    kind: 'ADMIN',
    adminId: admin.id,
    role: admin.role ?? AdminRole.OPERATOR,
    mfaVerified: opts.mfaVerified ?? true,
  });
  return {
    cookie: `${COOKIE_NAMES.ADMIN_SESSION}=${token}`,
    csrfToken: record.csrfToken,
    origin: process.env.ADMIN_BASE_URL ?? 'http://localhost:3001',
    sessionId: record.id,
  };
}

/** Applies a session to a supertest request: `withSession(t.http().post('/api/v1/x'), s)`. */
export function withSession(req: Test, session: TestSession): Test {
  return req
    .set('Cookie', session.cookie)
    .set(HEADER_NAMES.CSRF, session.csrfToken)
    .set('Origin', session.origin);
}
