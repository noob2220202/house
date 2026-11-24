"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
// The HTTP API never runs BullMQ processors (dist/worker.js does); must precede AppModule.
require("./roles/api");
const core_1 = require("@nestjs/core");
const nestjs_pino_1 = require("nestjs-pino");
const app_module_1 = require("./app.module");
const configure_app_1 = require("./bootstrap/configure-app");
const graceful_shutdown_1 = require("./bootstrap/graceful-shutdown");
const app_config_service_1 = require("./config/app-config.service");
/**
 * Shutdown budget, tied to PM2's kill_timeout for house-api (15 s, ecosystem.config.cjs):
 * keep-alive sockets get DRAIN_GRACE_MS to finish their current response, and the whole
 * shutdown (drain + Prisma/Redis close) must end by SHUTDOWN_DEADLINE_MS, before PM2's SIGKILL.
 */
const DRAIN_GRACE_MS = 8_000;
const SHUTDOWN_DEADLINE_MS = 13_000;
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, (0, configure_app_1.createHttpAdapter)(), {
        bufferLogs: true,
        bodyParser: false,
    });
    const drainer = new graceful_shutdown_1.HttpDrainer({ graceMs: DRAIN_GRACE_MS });
    (0, configure_app_1.configureApp)(app, { drainer });
    const config = app.get(app_config_service_1.AppConfig);
    const logger = app.get(nestjs_pino_1.Logger);
    // Listen for signals before listen(): a reload can arrive while the worker is starting.
    (0, graceful_shutdown_1.installShutdownSignals)((0, graceful_shutdown_1.createShutdownHandler)({
        drainer,
        closeApp: () => app.close(),
        hardTimeoutMs: SHUTDOWN_DEADLINE_MS,
        log: (message) => logger.log(message, 'Shutdown'),
        logError: (message) => logger.error(message, undefined, 'Shutdown'),
        finish: graceful_shutdown_1.finishProcess,
    }));
    drainer.attach(await app.listen(config.get('PORT'), config.get('HOST')));
}
void bootstrap();
//# sourceMappingURL=main.js.map