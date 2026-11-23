import { Module, RequestMethod } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { AppConfig } from '../config/app-config.service';
import { logSerializers } from './log-serializers';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        // Express 5 / path-to-regexp v8 wildcard syntax (avoids the legacy "*" route warning).
        forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
        pinoHttp: {
          level: config.get('LOG_LEVEL'),
          transport: config.get('LOG_PRETTY')
            ? {
                target: 'pino-pretty',
                options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l' },
              }
            : undefined,
          // RequestContext middleware assigns req.id (from x-request-id or a new UUID) first.
          genReqId: (req) => {
            const id = (req as { id?: unknown }).id;
            return typeof id === 'string' ? id : '';
          },
          autoLogging: {
            ignore: (req) => (req.url ?? '').startsWith('/api/v1/health'),
          },
          redact: {
            paths: [
              'req.headers.cookie',
              'req.headers.authorization',
              'req.headers["x-csrf-token"]',
              'res.headers["set-cookie"]',
            ],
            censor: '[redacted]',
          },
          serializers: logSerializers,
          customProps: () => ({ service: 'house-api' }),
        },
      }),
    }),
  ],
})
export class LoggerModule {}
