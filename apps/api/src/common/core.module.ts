import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { AppConfig } from '../config/app-config.service';
import { REDIS } from '../redis/redis.constants';
import { AuditInterceptor } from './audit/audit.interceptor';
import { AuditModule } from './audit/audit.module';
import { AuthGuard } from './auth/auth.guard';
import { CacheService } from './cache/cache.service';
import { CsrfGuard } from './auth/csrf.guard';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { ZodValidationPipe } from './pipes/zod-validation.pipe';
import { DailyCapService } from './throttle/daily-cap.service';
import { HouseThrottlerGuard } from './throttle/house-throttler.guard';
import { RedisThrottlerStorage } from './throttle/redis-throttler.storage';

/**
 * Cross-cutting wiring. Guard order matters: Throttler (per user, else per IP) → Auth (reuses the
 * memoized session) → CSRF.
 * Nothing here should need editing by module teams.
 */
@Global()
@Module({
  imports: [
    AuditModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfig, REDIS],
      useFactory: (config: AppConfig, redis: Redis) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get('THROTTLE_TTL_MS'),
            limit: config.get('THROTTLE_LIMIT'),
          },
        ],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
  ],
  providers: [
    { provide: APP_GUARD, useClass: HouseThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_PIPE, useFactory: () => new ZodValidationPipe() },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    CacheService,
    DailyCapService,
  ],
  exports: [AuditModule, CacheService, DailyCapService],
})
export class CoreModule {}
