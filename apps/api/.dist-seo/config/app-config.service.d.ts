import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema';
/** Typed access to validated env. Inject this, never read process.env in app code. */
export declare class AppConfig {
    private readonly config;
    constructor(config: ConfigService<Env, true>);
    get<K extends keyof Env>(key: K): Env[K];
    get isProduction(): boolean;
    get isTest(): boolean;
    get cookieSecure(): boolean;
    /** Origins allowed for CORS and the CSRF Origin/Referer check. */
    get allowedOrigins(): string[];
}
