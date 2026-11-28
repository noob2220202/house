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

  /**
   * Parent domain of the 사무소 홈페이지 hosts: SITE_ROOT_DOMAIN, else PUBLIC_BASE_URL's hostname
   * ("suncheonmap.kr"; dev "localhost", which browsers resolve for `<slug>.localhost` too).
   */
  get siteRootDomain(): string {
    return this.get('SITE_ROOT_DOMAIN') ?? new URL(this.get('PUBLIC_BASE_URL')).hostname;
  }
}
