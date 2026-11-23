import type { DynamicModule, ForwardReference, Provider, Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import type Redis from 'ioredis';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp, createHttpAdapter } from '../../src/bootstrap/configure-app';
import { PrismaService } from '../../src/prisma/prisma.service';
import { REDIS } from '../../src/redis/redis.constants';

export interface TestAppOptions {
  /** Extra controllers (e.g. probe controllers in the core suite). */
  controllers?: Type[];
  providers?: Provider[];
  imports?: (Type | DynamicModule | Promise<DynamicModule> | ForwardReference)[];
  /** Swap external clients for fakes: (b) => b.overrideProvider(KAKAO_CLIENT).useValue(fake) */
  override?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
}

export interface TestApp {
  app: NestExpressApplication;
  prisma: PrismaService;
  redis: Redis;
  /** supertest bound to the app's HTTP server. */
  http: () => ReturnType<typeof request>;
  close: () => Promise<void>;
}

/**
 * Boots the full AppModule with the production HTTP pipeline (configureApp) against the
 * module's own test DB / Redis index (loaded from test/env/<module>.env by setup-e2e-env.ts).
 */
export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  assertTestEnv();
  let builder = Test.createTestingModule({
    imports: [AppModule, ...(options.imports ?? [])],
    controllers: options.controllers ?? [],
    providers: options.providers ?? [],
  });
  if (options.override) builder = options.override(builder);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>(createHttpAdapter(), {
    bodyParser: false,
    bufferLogs: true,
  });
  configureApp(app);
  await app.init();
  const prisma = app.get(PrismaService);
  const redis = app.get<Redis>(REDIS);
  return {
    app,
    prisma,
    redis,
    http: () => request(app.getHttpServer()),
    close: () => app.close(),
  };
}

function assertTestEnv(): void {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.NODE_ENV !== 'test' || !/\/house_test_[a-z_]+(\?|$)/.test(url)) {
    throw new Error(
      'Refusing to start e2e app: NODE_ENV must be "test" and DATABASE_URL a house_test_* database',
    );
  }
}
