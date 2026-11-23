import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema';

/** Typed access to validated env. Inject this, never read process.env in app code. */
@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  get isTest(): boolean {
    return this.get('NODE_ENV') === 'test';
  }

  get cookieSecure(): boolean {
    return this.get('COOKIE_SECURE') ?? this.isProduction;
  }

  /** Origins allowed for CORS and the CSRF Origin/Referer check. */
  get allowedOrigins(): string[] {
    const origins = new Set<string>(this.get('CORS_ORIGINS'));
    origins.add(new URL(this.get('PUBLIC_BASE_URL')).origin);
    origins.add(new URL(this.get('ADMIN_BASE_URL')).origin);
    return [...origins];
  }
}
