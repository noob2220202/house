"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
// Enables the processors; must precede AppModule.
require("./roles/worker");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const nestjs_pino_1 = require("nestjs-pino");
const app_module_1 = require("./app.module");
/**
 * BullMQ worker process (no HTTP server): 실거래가 sync, banner stats flush, media processing,
 * view-counter flushes, listing/deal-request expiry, PII scrub, orphan cleanup, admin maintenance.
 * Every processor starts its worker and registers its repeatable jobs in onApplicationBootstrap
 * when JOBS_ENABLED, which this entry sets. SIGINT/SIGTERM close the workers gracefully (running
 * jobs finish or are released back to the queue).
 */
async function bootstrap() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { bufferLogs: true });
    app.useLogger(app.get(nestjs_pino_1.Logger));
    app.flushLogs();
    app.enableShutdownHooks();
    await app.init();
    app.get(nestjs_pino_1.Logger).log('worker started', 'Worker');
}
bootstrap().catch((err) => {
    new common_1.Logger('Worker').error(err instanceof Error ? (err.stack ?? err.message) : String(err));
    process.exit(1);
});
//# sourceMappingURL=worker.js.map