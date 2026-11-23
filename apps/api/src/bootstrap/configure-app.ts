import { API_PREFIX, HEADER_NAMES } from '@house/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { z } from 'zod';
import { requestContextMiddleware } from '../common/context/request-context';
import { renderException } from '../common/filters/all-exceptions.filter';
import { AppConfig } from '../config/app-config.service';

z.config(z.locales.ko());

function parseTrustProxy(value: string): boolean | number | string {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

/**
 * Applies every HTTP-level setting. Shared by main.ts and the e2e test app factory so tests
 * exercise exactly the production pipeline. Must be called before app.init()/listen().
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(AppConfig);
  app.useLogger(app.get(Logger));
  app.flushLogs();

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

  const origins = new Set(config.allowedOrigins);
  app.enableCors({
    origin: (origin, cb) => cb(null, origin === undefined || origins.has(origin)),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', HEADER_NAMES.CSRF, HEADER_NAMES.REQUEST_ID],
    exposedHeaders: [HEADER_NAMES.REQUEST_ID],
    maxAge: 600,
  });

  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();

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
