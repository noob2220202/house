import { AdminRole, ErrorCode, HEADER_NAMES, idParamSchema, UserRole } from '@house/shared';
import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import type { Test } from 'supertest';
import { z } from 'zod';
import { AdminOnly, CurrentUser, Public, Roles } from '../../../src/common/decorators';
import type { UserPrincipal } from '../../../src/common/auth/principal';
import { AppException } from '../../../src/common/errors/app.exception';
import { createZodDto } from '../../../src/common/pipes/zod-validation.pipe';
import { SessionService } from '../../../src/modules/auth/session/session.service';
import {
  createAdmin,
  createTestApp,
  createUser,
  loginAdmin,
  loginUser,
  resetAll,
  withSession,
  type TestApp,
} from '../../utils';

class EchoDto extends createZodDto(z.object({ name: z.string().min(2), count: z.int().min(0) })) {}
class IdParamDto extends createZodDto(idParamSchema) {}

/** Probe routes that exercise the global guards / pipe / filter exactly as module controllers will. */
@Controller('__probe')
class ProbeController {
  @Public()
  @Get('public')
  publicRoute(): { ok: true } {
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: UserPrincipal): { userId: string } {
    return { userId: user.userId };
  }

  @Public()
  @Post('echo')
  echo(@Body() body: EchoDto): EchoDto {
    return body;
  }

  @Post('write')
  write(): { ok: true } {
    return { ok: true };
  }

  @Roles(UserRole.AGENCY_OWNER)
  @Get('owner-only')
  ownerOnly(): { ok: true } {
    return { ok: true };
  }

  /** Tiny per-route limit so the throttle tracker can be observed. */
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Get('throttled')
  throttled(): { ok: true } {
    return { ok: true };
  }

  /** req.ip as every IP-keyed check sees it (throttler, admin allowlist, logs). */
  @Public()
  @Get('ip')
  ip(@Req() req: Request): { ip: string | undefined } {
    return { ip: req.ip };
  }

  @Public()
  @Get('items/:id')
  item(@Param() params: IdParamDto): never {
    throw AppException.notFound(ErrorCode.LISTING_NOT_FOUND);
    void params;
  }
}

@Controller('admin/__probe')
class AdminProbeController {
  @AdminOnly(AdminRole.ADMIN)
  @Get()
  get(): { ok: true } {
    return { ok: true };
  }

  @AdminOnly(AdminRole.ADMIN)
  @Post()
  post(): { ok: true } {
    return { ok: true };
  }
}

const WEB_ORIGIN = process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000';
const ADMIN_ORIGIN = process.env.ADMIN_BASE_URL ?? 'http://localhost:3001';

describe('core pipeline (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ controllers: [ProbeController, AdminProbeController] });
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  describe('health', () => {
    it('GET /api/v1/health → liveness', async () => {
      const res = await t.http().get('/api/v1/health').expect(200);
      expect(res.body.status).toBe('ok');
      expect(res.headers[HEADER_NAMES.REQUEST_ID]).toBeDefined();
    });

    it('GET /api/v1/health/ready → db + redis ok', async () => {
      const res = await t.http().get('/api/v1/health/ready').expect(200);
      expect(res.body).toEqual({ status: 'ok', checks: { db: 'ok', redis: 'ok' } });
    });
  });

  describe('auth guard', () => {
    it('public route works anonymously', async () => {
      await t.http().get('/api/v1/__probe/public').expect(200, { ok: true });
    });

    it('protected route → 401 with safe error shape', async () => {
      const res = await t.http().get('/api/v1/__probe/me').expect(401);
      expect(res.body).toMatchObject({
        code: ErrorCode.UNAUTHENTICATED,
        message: expect.any(String),
      });
      expect(res.body.requestId).toEqual(expect.any(String));
    });

    it('session cookie resolves the user', async () => {
      const user = await createUser(t.prisma);
      const s = await loginUser(t.app, user);
      const res = await withSession(t.http().get('/api/v1/__probe/me'), s).expect(200);
      expect(res.body).toEqual({ userId: user.id });
    });

    it('@Roles rejects other roles with 403', async () => {
      const user = await createUser(t.prisma);
      const s = await loginUser(t.app, user);
      const res = await withSession(t.http().get('/api/v1/__probe/owner-only'), s).expect(403);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
    });

    it('admin paths need an admin session with TOTP verified and the right rank', async () => {
      const user = await createUser(t.prisma);
      const userSession = await loginUser(t.app, user);
      await withSession(t.http().get('/api/v1/admin/__probe'), userSession).expect(401);

      const operator = await createAdmin(t.prisma, { role: AdminRole.OPERATOR });
      await withSession(
        t.http().get('/api/v1/admin/__probe'),
        await loginAdmin(t.app, operator),
      ).expect(403);

      const admin = await createAdmin(t.prisma, { role: AdminRole.ADMIN });
      const noMfa = await loginAdmin(t.app, admin, { mfaVerified: false });
      const res = await withSession(t.http().get('/api/v1/admin/__probe'), noMfa).expect(401);
      expect(res.body.code).toBe(ErrorCode.AUTH_TOTP_REQUIRED);

      await withSession(
        t.http().get('/api/v1/admin/__probe'),
        await loginAdmin(t.app, admin),
      ).expect(200);
    });

    it('routing is case-sensitive: other spellings of admin routes do not resolve', async () => {
      const admin = await createAdmin(t.prisma, { role: AdminRole.ADMIN });
      const session = await loginAdmin(t.app, admin);
      for (const path of [
        '/api/v1/ADMIN/__probe',
        '/api/v1/Admin/__probe',
        '/API/v1/admin/__probe',
      ]) {
        const res = await withSession(t.http().get(path), session);
        // Never served by the admin probe: 404 from the router (or 401 from the admin guard).
        expect([401, 404]).toContain(res.status);
        expect(res.body).not.toEqual({ ok: true });
      }
      const anon = await t.http().get('/api/v1/ADMIN/__probe').expect(404);
      expect(anon.body.code).toBe(ErrorCode.NOT_FOUND);
      // Public routes too: no case-folded aliases.
      await t.http().get('/api/v1/__PROBE/public').expect(404);
    });
  });

  describe('csrf', () => {
    it('rejects a session POST without the csrf header', async () => {
      const s = await loginUser(t.app, await createUser(t.prisma));
      const res = await t
        .http()
        .post('/api/v1/__probe/write')
        .set('Cookie', s.cookie)
        .set('Origin', s.origin)
        .expect(403);
      expect(res.body.code).toBe(ErrorCode.CSRF_FAILED);
    });

    it('rejects a foreign Origin', async () => {
      const s = await loginUser(t.app, await createUser(t.prisma));
      await withSession(t.http().post('/api/v1/__probe/write'), s)
        .set('Origin', 'https://evil.example')
        .expect(403);
    });

    it('accepts cookie + matching token + allowed origin', async () => {
      const s = await loginUser(t.app, await createUser(t.prisma));
      await withSession(t.http().post('/api/v1/__probe/write'), s).expect(201, { ok: true });
    });
  });

  describe('origins are split by surface (admin API ≠ public site)', () => {
    const acao = 'access-control-allow-origin';

    it('CORS: the public site gets no credentialed access to /api/v1/admin/**', async () => {
      const admin = await createAdmin(t.prisma, { role: AdminRole.ADMIN });
      const s = await loginAdmin(t.app, admin);
      // The admin CSRF token endpoint: readable cross-origin only by the admin site.
      const fromWeb = await t
        .http()
        .get('/api/v1/admin/auth/csrf')
        .set('Cookie', s.cookie)
        .set('Origin', WEB_ORIGIN);
      expect(fromWeb.headers[acao]).toBeUndefined();
      expect(fromWeb.headers['access-control-allow-credentials']).toBeUndefined();
      expect(fromWeb.headers.vary).toMatch(/Origin/i);

      const fromAdmin = await t
        .http()
        .get('/api/v1/admin/auth/csrf')
        .set('Cookie', s.cookie)
        .set('Origin', ADMIN_ORIGIN)
        .expect(200);
      expect(fromAdmin.headers[acao]).toBe(ADMIN_ORIGIN);
      expect(fromAdmin.headers['access-control-allow-credentials']).toBe('true');
    });

    it('CORS preflight follows the same split', async () => {
      const preflight = (path: string, origin: string) =>
        t
          .http()
          .options(path)
          .set('Origin', origin)
          .set('Access-Control-Request-Method', 'POST')
          .set('Access-Control-Request-Headers', `content-type,${HEADER_NAMES.CSRF}`);

      expect((await preflight('/api/v1/admin/__probe', WEB_ORIGIN)).headers[acao]).toBeUndefined();
      expect((await preflight('/api/v1/admin/__probe', ADMIN_ORIGIN)).headers[acao]).toBe(
        ADMIN_ORIGIN,
      );
      expect(
        (await preflight('/api/v1/__probe/write', ADMIN_ORIGIN)).headers[acao],
      ).toBeUndefined();
      expect((await preflight('/api/v1/__probe/write', WEB_ORIGIN)).headers[acao]).toBe(WEB_ORIGIN);
    });

    it('CORS: user routes answer only the public site', async () => {
      const web = await t.http().get('/api/v1/__probe/public').set('Origin', WEB_ORIGIN);
      expect(web.headers[acao]).toBe(WEB_ORIGIN);
      const adm = await t.http().get('/api/v1/__probe/public').set('Origin', ADMIN_ORIGIN);
      expect(adm.headers[acao]).toBeUndefined();
    });

    it('CSRF: an admin write from the public site origin is refused even with the token', async () => {
      const admin = await createAdmin(t.prisma, { role: AdminRole.ADMIN });
      const s = await loginAdmin(t.app, admin);
      for (const req of [
        withSession(t.http().post('/api/v1/admin/__probe'), s).set('Origin', WEB_ORIGIN),
        withSession(t.http().post('/api/v1/admin/__probe'), s)
          .unset('Origin')
          .set('Referer', `${WEB_ORIGIN}/listing/1`),
      ]) {
        const res = await req.expect(403);
        expect(res.body.code).toBe(ErrorCode.CSRF_FAILED);
      }
      await withSession(t.http().post('/api/v1/admin/__probe'), s).expect(201, { ok: true });
    });

    it('CSRF: a user write from the admin site origin is refused', async () => {
      const s = await loginUser(t.app, await createUser(t.prisma));
      const res = await withSession(t.http().post('/api/v1/__probe/write'), s)
        .set('Origin', ADMIN_ORIGIN)
        .expect(403);
      expect(res.body.code).toBe(ErrorCode.CSRF_FAILED);
      await withSession(t.http().post('/api/v1/__probe/write'), s).expect(201, { ok: true });
    });
  });

  describe('validation + errors', () => {
    it('zod DTO validates and returns parsed body', async () => {
      await t
        .http()
        .post('/api/v1/__probe/echo')
        .send({ name: 'ab', count: 1 })
        .expect(201, { name: 'ab', count: 1 });
    });

    it('invalid body → 400 VALIDATION_FAILED with details', async () => {
      const res = await t
        .http()
        .post('/api/v1/__probe/echo')
        .send({ name: 'a', count: -1 })
        .expect(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'name' }),
          expect.objectContaining({ path: 'count' }),
        ]),
      );
    });

    it('invalid path param → 400; AppException → its status/code', async () => {
      await t.http().get('/api/v1/__probe/items/not-a-uuid').expect(400);
      const res = await t
        .http()
        .get('/api/v1/__probe/items/0192b1d4-8a4e-7cc0-9b1e-3f1f7a1b2c3d')
        .expect(404);
      expect(res.body).toMatchObject({
        code: ErrorCode.LISTING_NOT_FOUND,
        message: '매물을 찾을 수 없습니다.',
      });
    });

    it('malformed JSON and unknown routes keep the error shape', async () => {
      const bad = await t
        .http()
        .post('/api/v1/__probe/echo')
        .set('Content-Type', 'application/json')
        .send('{"x":')
        .expect(400);
      expect(bad.body.code).toBe(ErrorCode.BAD_REQUEST);
      const missing = await t.http().get('/api/v1/nope').expect(404);
      expect(missing.body.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('oversized body → 413', async () => {
      const res = await t
        .http()
        .post('/api/v1/__probe/echo')
        .send({ name: 'x'.repeat(1_100_000), count: 1 })
        .expect(413);
      expect(res.body.code).toBe(ErrorCode.PAYLOAD_TOO_LARGE);
    });
  });

  describe('throttle (keyed per user, else per client IP)', () => {
    const hit = (xff?: string): Test => {
      const req = t.http().get('/api/v1/__probe/throttled');
      return xff ? req.set('X-Forwarded-For', xff) : req;
    };

    it('anonymous clients sharing one IP share a bucket → 429 after the limit', async () => {
      for (let i = 0; i < 3; i++) await hit('203.0.113.7').expect(200);
      const res = await hit('203.0.113.7').expect(429);
      expect(res.body.code).toBe(ErrorCode.RATE_LIMITED);
    });

    it('X-Forwarded-For from a trusted loopback hop (nginx / SSR) separates clients', async () => {
      for (let i = 0; i < 3; i++) await hit('203.0.113.7').expect(200);
      await hit('203.0.113.7').expect(429);
      await hit('198.51.100.20').expect(200);
    });

    it('SSR contract: a loopback call with X-Forwarded-For (+ x-house-ssr) is the visitor', async () => {
      const ip = (headers: Record<string, string>) => {
        const req = t.http().get('/api/v1/__probe/ip');
        for (const [k, v] of Object.entries(headers)) req.set(k, v);
        return req.expect(200).then((r) => (r.body as { ip: string }).ip);
      };
      // supertest connects from 127.0.0.1, like nginx and the Next.js servers in production.
      await expect(ip({ 'x-forwarded-for': '203.0.113.9', 'x-house-ssr': '1' })).resolves.toBe(
        '203.0.113.9',
      );
      // Appended chains resolve to the right-most untrusted hop; forged loopback entries are skipped.
      await expect(ip({ 'x-forwarded-for': '198.51.100.1, 203.0.113.9' })).resolves.toBe(
        '203.0.113.9',
      );
      await expect(ip({ 'x-forwarded-for': '203.0.113.9, 127.0.0.1' })).resolves.toBe(
        '203.0.113.9',
      );
      // Without the header the call is the loopback address (the shared bucket the SSR layer avoids).
      await expect(ip({ 'x-house-ssr': '1' })).resolves.toMatch(/^(::ffff:)?127\.0\.0\.1$|^::1$/);
    });

    it('cached SSR reads (marker, no visitor) skip the throttle instead of sharing one bucket', async () => {
      const cached = () => t.http().get('/api/v1/__probe/throttled').set('x-house-ssr', '1');
      for (let i = 0; i < 6; i++) await cached().expect(200);
      // Same loopback peer without the marker: an ordinary anonymous caller, throttled.
      for (let i = 0; i < 3; i++) await hit().expect(200);
      await hit().expect(429);
      // Any other marker value is not the SSR contract.
      await t.http().get('/api/v1/__probe/throttled').set('x-house-ssr', 'true').expect(429);
    });

    it('SSR calls forwarding different visitors get separate buckets; the marker exempts nothing', async () => {
      const ssr = (xff: string) => hit(xff).set('x-house-ssr', '1');
      for (let i = 0; i < 3; i++) await ssr('203.0.113.7').expect(200);
      await ssr('203.0.113.7').expect(429);
      // The same visitor arriving through nginx (no SSR marker) shares that bucket.
      await hit('203.0.113.7').expect(429);
      await ssr('198.51.100.20').expect(200);
    });

    it('logged-in users behind one shared IP (CGNAT) each get their own bucket', async () => {
      const [a, b] = await Promise.all([createUser(t.prisma), createUser(t.prisma)]);
      const [sa, sb] = await Promise.all([loginUser(t.app, a), loginUser(t.app, b)]);
      const ip = '100.64.0.1';
      for (let i = 0; i < 3; i++) await withSession(hit(ip), sa).expect(200);
      await withSession(hit(ip), sa).expect(429);
      // Same IP, different account: unaffected by A's exhausted bucket…
      for (let i = 0; i < 3; i++) await withSession(hit(ip), sb).expect(200);
      // …and an anonymous visitor on that IP still has the full IP bucket.
      await hit(ip).expect(200);
    });

    it('the session is resolved once per request (throttler + auth guard share it)', async () => {
      const user = await createUser(t.prisma);
      const s = await loginUser(t.app, user);
      const spy = jest.spyOn(t.app.get(SessionService), 'resolve');
      try {
        await withSession(t.http().get('/api/v1/__probe/me'), s).expect(200, { userId: user.id });
        expect(spy).toHaveBeenCalledTimes(1);
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('postgis', () => {
    it('keeps location in sync with lat/lng via trigger', async () => {
      await t.prisma.region.create({
        data: {
          code: '12150',
          name: '순천시',
          fullName: '전남광주통합특별시 순천시',
          level: 'SGG',
          lat: 34.95,
          lng: 127.48,
        },
      });
      const [row] = await t.prisma.$queryRaw<{ wkt: string }[]>`
        SELECT ST_AsText(location::geometry) AS wkt FROM regions WHERE code = '12150'`;
      expect(row?.wkt).toBe('POINT(127.48 34.95)');
    });
  });
});
