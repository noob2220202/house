import type { DynamicModule, ForwardReference, Provider, Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import type Redis from 'ioredis';
import request from 'supertest';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../../src/app.module';
import { configureApp, createHttpAdapter } from '../../src/bootstrap/configure-app';
import { AppConfig } from '../../src/config/app-config.service';
import type { Env } from '../../src/config/env.schema';
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

/**
 * `override` helper: AppConfig with some validated values replaced for one suite. The app reads
 * only the validated env (ConfigModule skipProcessEnv), which is parsed when AppModule is first
 * imported — so setting process.env in a beforeAll no longer reaches the app; use this instead.
 *   createTestApp({ override: withConfig({ KAKAO_CLIENT_ID: '…' }) })
 */
export function withConfig(values: Partial<Env>) {
  return (builder: TestingModuleBuilder): TestingModuleBuilder =>
    builder.overrideProvider(AppConfig).useFactory({
      inject: [ConfigService],
      factory: (config: ConfigService<Env, true>) => {
        const base = new AppConfig(config);
        return new Proxy(base, {
          get(target, prop, receiver) {
            if (prop === 'get') {
              return <K extends keyof Env>(key: K): Env[K] =>
                key in values ? (values[key] as Env[K]) : target.get(key);
            }
            return Reflect.get(target, prop, receiver) as unknown;
          },
        });
      },
    });
}

function assertTestEnv(): void {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.NODE_ENV !== 'test' || !/\/house_test_[a-z_]+(\?|$)/.test(url)) {
    throw new Error(
      'Refusing to start e2e app: NODE_ENV must be "test" and DATABASE_URL a house_test_* database',
    );
  }
}
