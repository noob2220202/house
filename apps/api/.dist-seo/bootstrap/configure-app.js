"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHttpAdapter = createHttpAdapter;
exports.configureApp = configureApp;
const shared_1 = require("@house/shared");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const nestjs_pino_1 = require("nestjs-pino");
const zod_1 = require("zod");
const request_context_1 = require("../common/context/request-context");
const all_exceptions_filter_1 = require("../common/filters/all-exceptions.filter");
const app_config_service_1 = require("../config/app-config.service");
zod_1.z.config(zod_1.z.locales.ko());
function parseTrustProxy(value) {
    if (value === 'true')
        return true;
    if (value === 'false')
        return false;
    if (/^\d+$/.test(value))
        return Number(value);
    return value;
}
/**
 * The Express adapter every HTTP app (main.ts, e2e) is created with. Routing is exact-case:
 * /api/v1/ADMIN/... must not alias the admin routes (nginx admin rules, isAdminPath and the route
 * table must agree). Express builds its router with these settings when it is first used, and the
 * Nest adapter uses it in its constructor, so they must be set on the instance beforehand.
 */
function createHttpAdapter() {
    const server = (0, express_1.default)();
    server.set('case sensitive routing', true);
    return new platform_express_1.ExpressAdapter(server);
}
/**
 * Applies every HTTP-level setting. Shared by main.ts and the e2e test app factory so tests
 * exercise exactly the production pipeline. Must be called before app.init()/listen().
 * Signal handling is not set up here: main.ts drains HTTP before closing the app.
 */
function configureApp(app, options = {}) {
    const config = app.get(app_config_service_1.AppConfig);
    app.useLogger(app.get(nestjs_pino_1.Logger));
    app.flushLogs();
    if (options.drainer)
        app.use(options.drainer.middleware);
    app.set('trust proxy', parseTrustProxy(config.get('TRUST_PROXY')));
    app.disable('x-powered-by');
    app.use(request_context_1.requestContextMiddleware);
    app.use((0, helmet_1.default)({
        // Swagger UI needs inline scripts; the API itself only serves JSON.
        contentSecurityPolicy: config.get('SWAGGER_ENABLED') ? false : undefined,
        crossOriginResourcePolicy: { policy: 'same-site' },
    }));
    app.use((0, compression_1.default)());
    app.use((0, cookie_parser_1.default)(config.get('COOKIE_SECRET')));
    // JSON only. OAuth callbacks are GET redirects; uploads use multipart (multer, media module).
    app.useBodyParser('json', { limit: config.get('BODY_LIMIT') });
    // Body-parser errors (too large / malformed) happen before Nest's filters; render them the same way.
    app.use((err, req, res, next) => {
        if (!err)
            return next();
        const { status, body } = (0, all_exceptions_filter_1.renderException)(err);
        res
            .status(status)
            .json({ ...body, requestId: typeof req.id === 'string' ? req.id : undefined });
    });
    const origins = new Set(config.allowedOrigins);
    app.enableCors({
        origin: (origin, cb) => cb(null, origin === undefined || origins.has(origin)),
        credentials: true,
        methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', shared_1.HEADER_NAMES.CSRF, shared_1.HEADER_NAMES.REQUEST_ID],
        exposedHeaders: [shared_1.HEADER_NAMES.REQUEST_ID],
        maxAge: 600,
    });
    app.setGlobalPrefix(shared_1.API_PREFIX);
    if (config.get('SWAGGER_ENABLED')) {
        const doc = new swagger_1.DocumentBuilder()
            .setTitle('House API')
            .setDescription('순천 부동산 공동중개 플랫폼 API')
            .setVersion('1')
            .addCookieAuth('house_sid')
            .build();
        swagger_1.SwaggerModule.setup(`${shared_1.API_PREFIX}/docs`, app, () => swagger_1.SwaggerModule.createDocument(app, doc));
    }
}
//# sourceMappingURL=configure-app.js.map