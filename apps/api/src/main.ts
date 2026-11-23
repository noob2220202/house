import 'reflect-metadata';
// The HTTP API never runs BullMQ processors (dist/worker.js does); must precede AppModule.
import './roles/api';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp, createHttpAdapter } from './bootstrap/configure-app';
import {
  createShutdownHandler,
  finishProcess,
  HttpDrainer,
  installShutdownSignals,
} from './bootstrap/graceful-shutdown';
import { AppConfig } from './config/app-config.service';

/**
 * Shutdown budget, tied to PM2's kill_timeout for house-api (15 s, ecosystem.config.cjs):
 * keep-alive sockets get DRAIN_GRACE_MS to finish their current response, and the whole
 * shutdown (drain + Prisma/Redis close) must end by SHUTDOWN_DEADLINE_MS, before PM2's SIGKILL.
 */
const DRAIN_GRACE_MS = 8_000;
const SHUTDOWN_DEADLINE_MS = 13_000;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, createHttpAdapter(), {
    bufferLogs: true,
    bodyParser: false,
  });
  const drainer = new HttpDrainer({ graceMs: DRAIN_GRACE_MS });
  configureApp(app, { drainer });
  const config = app.get(AppConfig);
  const logger = app.get(Logger);

  // Listen for signals before listen(): a reload can arrive while the worker is starting.
  installShutdownSignals(
    createShutdownHandler({
      drainer,
      closeApp: () => app.close(),
      hardTimeoutMs: SHUTDOWN_DEADLINE_MS,
      log: (message) => logger.log(message, 'Shutdown'),
      logError: (message) => logger.error(message, undefined, 'Shutdown'),
      finish: finishProcess,
    }),
  );

  drainer.attach(await app.listen(config.get('PORT'), config.get('HOST')));
}

void bootstrap();
