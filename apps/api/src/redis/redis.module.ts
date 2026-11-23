import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfig } from '../config/app-config.service';
import { REDIS, redisOptionsFromUrl } from './redis.constants';

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [AppConfig],
      useFactory: (config: AppConfig): Redis => {
        const logger = new Logger('Redis');
        const client = new Redis({
          ...redisOptionsFromUrl(config.get('REDIS_URL')),
          keyPrefix: config.get('REDIS_KEY_PREFIX'),
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
        });
        client.on('error', (err: Error) => logger.error(`redis error: ${err.message}`));
        return client;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.redis.status !== 'end') await this.redis.quit().catch(() => undefined);
  }
}
