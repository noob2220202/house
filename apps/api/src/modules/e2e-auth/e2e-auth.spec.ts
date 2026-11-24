import { NotFoundException } from '@nestjs/common';
import { ErrorCode, UserRole, UserStatus } from '@house/shared';
import type { Request, Response } from 'express';
import { AppException } from '../../common/errors/app.exception';
import type { AppConfig } from '../../config/app-config.service';
import { parseEnv } from '../../config/env.schema';
import type { PrismaService } from '../../prisma/prisma.service';
import type { TermsService } from '../auth/terms/terms.service';
import type { UserSessionService } from '../auth/users/user-session.service';
import { e2eLoginSchema } from './e2e-auth.dto';
import { e2eFakeAuthEnabled } from './e2e-auth.enabled';
import { E2eOnlyGuard } from './e2e-auth.guard';
import { E2eAuthModule } from './e2e-auth.module';
import { E2eAuthService } from './e2e-auth.service';

const baseEnv = {
  PUBLIC_BASE_URL: 'http://localhost:3000',
  ADMIN_BASE_URL: 'http://localhost:3001',
  API_BASE_URL: 'http://localhost:4000',
  CORS_ORIGINS: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379/0',
  COOKIE_SECRET: 'x'.repeat(40),
  TOTP_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  UPLOAD_DIR: '/tmp/u',
  PRIVATE_UPLOAD_DIR: '/tmp/p',
};

describe('e2eFakeAuthEnabled', () => {
  it.each([
    [{ NODE_ENV: 'test', E2E_FAKE_OAUTH: '1' }, true],
    [{ NODE_ENV: 'test' }, false],
    [{ NODE_ENV: 'test', E2E_FAKE_OAUTH: '0' }, false],
    [{ NODE_ENV: 'test', E2E_FAKE_OAUTH: 'yes' }, false],
    [{ NODE_ENV: 'development', E2E_FAKE_OAUTH: '1' }, false],
    [{ NODE_ENV: 'production', E2E_FAKE_OAUTH: '1' }, false],
    [{ E2E_FAKE_OAUTH: '1' }, false],
  ])('%o → %s', (env, expected) => {
    expect(e2eFakeAuthEnabled(env as NodeJS.ProcessEnv)).toBe(expected);
  });
});

describe('env schema E2E_FAKE_OAUTH', () => {
  it('defaults to false', () => {
    expect(parseEnv(baseEnv).E2E_FAKE_OAUTH).toBe(false);
  });
  it('is accepted with NODE_ENV=test', () => {
    expect(parseEnv({ ...baseEnv, NODE_ENV: 'test', E2E_FAKE_OAUTH: '1' }).E2E_FAKE_OAUTH).toBe(
      true,
    );
  });
  it.each(['production', 'development'])('is refused with NODE_ENV=%s', (NODE_ENV) => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        NODE_ENV,
        COOKIE_SECURE: 'true',
        COOKIE_SECRET: 'p'.repeat(40),
        E2E_FAKE_OAUTH: '1',
      }),
    ).toThrow(/E2E_FAKE_OAUTH/);
  });
});

function fakeConfig(nodeEnv: string, flag: boolean): AppConfig {
  return {
    isTest: nodeEnv === 'test',
    get: (key: string) => (key === 'E2E_FAKE_OAUTH' ? flag : undefined),
  } as unknown as AppConfig;
}

describe('E2eOnlyGuard', () => {
  it('allows only NODE_ENV=test with the flag on', () => {
    expect(new E2eOnlyGuard(fakeConfig('test', true)).canActivate()).toBe(true);
  });
  it.each([
    ['test', false],
    ['development', true],
    ['production', true],
  ])('answers 404 for NODE_ENV=%s flag=%s', (env, flag) => {
    expect(() => new E2eOnlyGuard(fakeConfig(env, flag)).canActivate()).toThrow(NotFoundException);
  });
});

describe('E2eAuthModule', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env.NODE_ENV = saved.NODE_ENV;
    if (saved.E2E_FAKE_OAUTH === undefined) delete process.env.E2E_FAKE_OAUTH;
    else process.env.E2E_FAKE_OAUTH = saved.E2E_FAKE_OAUTH;
  });
  it('refuses to initialise unless enabled', () => {
    process.env.NODE_ENV = 'production';
    process.env.E2E_FAKE_OAUTH = '1';
    expect(() => new E2eAuthModule().onModuleInit()).toThrow(/E2E_FAKE_OAUTH/);
    process.env.NODE_ENV = 'test';
    delete process.env.E2E_FAKE_OAUTH;
    expect(() => new E2eAuthModule().onModuleInit()).toThrow(/E2E_FAKE_OAUTH/);
    process.env.E2E_FAKE_OAUTH = '1';
    expect(() => new E2eAuthModule().onModuleInit()).not.toThrow();
  });
});

describe('e2eLoginSchema', () => {
  it('lower-cases the email and defaults agreeTerms', () => {
    expect(e2eLoginSchema.parse({ email: 'A1-Owner@Seed.Example.Invalid' })).toEqual({
      email: 'a1-owner@seed.example.invalid',
      agreeTerms: true,
    });
  });
  it('creates members only under the reserved e2e domain', () => {
    expect(
      e2eLoginSchema.safeParse({ email: 'x@e2e.example.invalid', create: { nickname: '테스터' } })
        .success,
    ).toBe(true);
    expect(
      e2eLoginSchema.safeParse({ email: 'x@gmail.com', create: { nickname: '테스터' } }).success,
    ).toBe(false);
  });
});

describe('E2eAuthService', () => {
  const req = { headers: {} } as Request;
  const res = {} as Response;
  const required = [
    { id: 'doc-service', type: 'SERVICE', isRequired: true },
    { id: 'doc-privacy', type: 'PRIVACY', isRequired: true },
    { id: 'doc-marketing', type: 'MARKETING', isRequired: false },
  ];

  function setup(existing: { id: string; role: string; status: string } | null) {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(existing),
        create: jest.fn().mockResolvedValue({
          id: 'new-user',
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
        }),
      },
    };
    const terms = {
      current: jest.fn().mockResolvedValue(required),
      pendingRequired: jest.fn().mockResolvedValue(['PRIVACY']),
      record: jest.fn().mockResolvedValue(undefined),
    };
    const userSessions = {
      start: jest.fn().mockResolvedValue({ agencyId: 'agency-1', csrfToken: 'csrf-1' }),
    };
    const service = new E2eAuthService(
      prisma as unknown as PrismaService,
      terms as unknown as TermsService,
      userSessions as unknown as UserSessionService,
    );
    return { service, prisma, terms, userSessions };
  }

  it('starts a real session for a seeded member and agrees only the missing required terms', async () => {
    const user = { id: 'owner-1', role: UserRole.AGENCY_OWNER, status: UserStatus.ACTIVE };
    const { service, prisma, terms, userSessions } = setup(user);
    const out = await service.login(
      { email: 'a1-owner@seed.example.invalid', agreeTerms: true },
      req,
      res,
    );
    expect(out).toEqual({
      userId: 'owner-1',
      role: UserRole.AGENCY_OWNER,
      agencyId: 'agency-1',
      created: false,
      csrfToken: 'csrf-1',
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(terms.record).toHaveBeenCalledWith(prisma, 'owner-1', [
      { termsDocumentId: 'doc-privacy', agreed: true },
    ]);
    expect(userSessions.start).toHaveBeenCalledWith(req, res, user);
  });

  it('answers 404 for an unknown email without create', async () => {
    const { service, userSessions } = setup(null);
    await expect(
      service.login({ email: 'nobody@e2e.example.invalid', agreeTerms: true }, req, res),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    expect(userSessions.start).not.toHaveBeenCalled();
  });

  it('creates a USER member with an identity when asked', async () => {
    const { service, prisma } = setup(null);
    const out = await service.login(
      { email: 'buyer@e2e.example.invalid', create: { nickname: '구매자' }, agreeTerms: false },
      req,
      res,
    );
    expect(out.created).toBe(true);
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      email: 'buyer@e2e.example.invalid',
      nickname: '구매자',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    });
    expect(data.ageConfirmedAt).toBeInstanceOf(Date);
    expect(data.identities.create.providerUserId).toMatch(/^e2e-[0-9a-f]{24}$/);
  });

  it.each([
    [UserStatus.SUSPENDED, ErrorCode.AUTH_ACCOUNT_SUSPENDED],
    [UserStatus.WITHDRAWN, ErrorCode.AUTH_ACCOUNT_WITHDRAWN],
  ])('refuses a %s member like the OAuth callback', async (status, code) => {
    const { service, userSessions } = setup({ id: 'u', role: UserRole.USER, status });
    const err = await service
      .login({ email: 'u@seed.example.invalid', agreeTerms: true }, req, res)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppException);
    expect((err as AppException).code).toBe(code);
    expect(userSessions.start).not.toHaveBeenCalled();
  });
});
