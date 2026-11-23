import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service';
import { redisOptionsFromUrl } from '../redis/redis.constants';

/**
 * BullMQ root connection. Feature modules call `BullModule.registerQueue({ name: QUEUES.X })`
 * and add `@Processor(QUEUES.X)` workers. Repeatable jobs must be registered only when
 * `JOBS_ENABLED` is true (use `upsertJobScheduler` so registration is idempotent).
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        connection: { ...redisOptionsFromUrl(config.get('REDIS_URL')), maxRetriesPerRequest: null },
        prefix: `${config.get('REDIS_KEY_PREFIX')}bull`,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: { age: 60 * 60 * 24 * 7, count: 1000 },
          removeOnFail: { age: 60 * 60 * 24 * 30 },
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
