import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { AppConfig } from '../config/app-config.service';

/** Transaction client type for functions that run inside `prisma.$transaction`. */
export type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: AppConfig) {
    super({
      datasourceUrl: config.get('DATABASE_URL'),
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    (this as PrismaClient<Prisma.PrismaClientOptions, 'warn' | 'error'>).$on('warn', (e) =>
      this.logger.warn(e.message),
    );
    (this as PrismaClient<Prisma.PrismaClientOptions, 'warn' | 'error'>).$on('error', (e) =>
      this.logger.error(e.message),
    );
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
