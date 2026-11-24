import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { AppConfig } from '../config/app-config.service';
/** Transaction client type for functions that run inside `prisma.$transaction`. */
export type PrismaTx = Prisma.TransactionClient;
export declare class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger;
    constructor(config: AppConfig);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
}
