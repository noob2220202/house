import { ExpressAdapter, type NestExpressApplication } from '@nestjs/platform-express';
import type { HttpDrainer } from './graceful-shutdown';
/**
 * The Express adapter every HTTP app (main.ts, e2e) is created with. Routing is exact-case:
 * /api/v1/ADMIN/... must not alias the admin routes (nginx admin rules, isAdminPath and the route
 * table must agree). Express builds its router with these settings when it is first used, and the
 * Nest adapter uses it in its constructor, so they must be set on the instance beforehand.
 */
export declare function createHttpAdapter(): ExpressAdapter;
export interface ConfigureAppOptions {
    /** Registered as the very first middleware (main.ts: graceful reload). */
    drainer?: HttpDrainer;
}
/**
 * Applies every HTTP-level setting. Shared by main.ts and the e2e test app factory so tests
 * exercise exactly the production pipeline. Must be called before app.init()/listen().
 * Signal handling is not set up here: main.ts drains HTTP before closing the app.
 */
export declare function configureApp(app: NestExpressApplication, options?: ConfigureAppOptions): void;
