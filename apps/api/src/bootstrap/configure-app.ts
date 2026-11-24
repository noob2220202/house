import { API_PREFIX, HEADER_NAMES } from '@house/shared';
import { ExpressAdapter, type NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { z } from 'zod';
import { OriginPolicy } from '../common/auth/origin-policy';
import { requestContextMiddleware } from '../common/context/request-context';
import { renderException } from '../common/filters/all-exceptions.filter';
import { AppConfig } from '../config/app-config.service';
import type { HttpDrainer } from './graceful-shutdown';

z.config(z.locales.ko());

/**
 * Express "trust proxy" from TRUST_PROXY. With the production value "loopback", X-Forwarded-For is
 * honoured only when the TCP peer is 127.0.0.0/8 or ::1 (nginx, or the Next.js SSR servers, which
 * listen on 127.0.0.1 only): req.ip is then the right-most untrusted address of the chain, i.e. the
 * visitor nginx saw. A client connecting from anywhere else cannot change req.ip with the header.
 */
export function parseTrustProxy(value: string): boolean | number | string {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

/**
 * The Express adapter every HTTP app (main.ts, e2e) is created with. Routing is exact-case:
 * /api/v1/ADMIN/... must not alias the admin routes (nginx admin rules, isAdminPath and the route
 * table must agree). Express builds its router with these settings when it is first used, and the
 * Nest adapter uses it in its constructor, so they must be set on the instance beforehand.
 */
export function createHttpAdapter(): ExpressAdapter {
  const server = express();
  server.set('case sensitive routing', true);
  return new ExpressAdapter(server);
}

export interface ConfigureAppOptions {
  /** Registered as the very first middleware (main.ts: graceful reload). */
  drainer?: HttpDrainer;
}

/**
 * Applies every HTTP-level setting. Shared by main.ts and the e2e test app factory so tests
 * exercise exactly the production pipeline. Must be called before app.init()/listen().
 * Signal handling is not set up here: main.ts drains HTTP before closing the app.
 */
export function configureApp(app: NestExpressApplication, options: ConfigureAppOptions = {}): void {
  const config = app.get(AppConfig);
  app.useLogger(app.get(Logger));
  app.flushLogs();

  if (options.drainer) app.use(options.drainer.middleware);

  app.set('trust proxy', parseTrustProxy(config.get('TRUST_PROXY')));
  app.disable('x-powered-by');
  app.use(requestContextMiddleware);
  app.use(
    helmet({
      // Swagger UI needs inline scripts; the API itself only serves JSON.
      contentSecurityPolicy: config.get('SWAGGER_ENABLED') ? false : undefined,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(compression());
  app.use(cookieParser(config.get('COOKIE_SECRET')));
  // JSON only. OAuth callbacks are GET redirects; uploads use multipart (multer, media module).
  app.useBodyParser('json', { limit: config.get('BODY_LIMIT') });
  // Body-parser errors (too large / malformed) happen before Nest's filters; render them the same way.
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!err) return next();
    const { status, body } = renderException(err);
    res
      .status(status)
      .json({ ...body, requestId: typeof req.id === 'string' ? req.id : undefined });
  });

  // Credentialed CORS, with the allowed origins chosen per surface by the request path (the same
  // OriginPolicy CsrfGuard uses): the public site's origin never gets ACAO on /api/v1/admin/**.
  const origins = OriginPolicy.fromConfig(config);
  // A list (not a callback) so cors always sends `Vary: Origin`, also when it refuses an origin.
  app.enableCors((req: Request, cb) => {
    const allowed = origins.forRequest(req);
    const origin = req.headers.origin;
    cb(null, {
      origin: [...allowed],
      credentials: typeof origin === 'string' && allowed.has(origin),
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', HEADER_NAMES.CSRF, HEADER_NAMES.REQUEST_ID],
      exposedHeaders: [HEADER_NAMES.REQUEST_ID],
      maxAge: 600,
    });
  });

  app.setGlobalPrefix(API_PREFIX);

  if (config.get('SWAGGER_ENABLED')) {
    const doc = new DocumentBuilder()
      .setTitle('House API')
      .setDescription('순천 부동산 공동중개 플랫폼 API')
      .setVersion('1')
      .addCookieAuth('house_sid')
      .build();
    SwaggerModule.setup(`${API_PREFIX}/docs`, app, () => SwaggerModule.createDocument(app, doc));
  }
}
