import 'reflect-metadata';
// Enables the processors; must precede AppModule.
import './roles/worker';
import { Logger as NestLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

/**
 * BullMQ worker process (no HTTP server): 실거래가 sync, banner stats flush, media processing,
 * view-counter flushes, listing/deal-request expiry, PII scrub, orphan cleanup, admin maintenance.
 * Every processor starts its worker and registers its repeatable jobs in onApplicationBootstrap
 * when JOBS_ENABLED, which this entry sets. SIGINT/SIGTERM close the workers gracefully (running
 * jobs finish or are released back to the queue).
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.flushLogs();
  app.enableShutdownHooks();
  await app.init();
  app.get(Logger).log('worker started', 'Worker');
}

bootstrap().catch((err: unknown) => {
  new NestLogger('Worker').error(err instanceof Error ? (err.stack ?? err.message) : String(err));
  process.exit(1);
});
