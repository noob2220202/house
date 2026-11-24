import type { Response } from 'express';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
type CheckResult = 'ok' | 'error';
export declare class HealthController {
    private readonly prisma;
    private readonly redis;
    constructor(prisma: PrismaService, redis: Redis);
    /** Liveness: the process is up. */
    live(): {
        status: 'ok';
        uptime: number;
    };
    /** Readiness: DB and Redis reachable. 503 otherwise. */
    ready(res: Response): Promise<{
        status: 'ok' | 'error';
        checks: Record<'db' | 'redis', CheckResult>;
    }>;
    private checkDb;
    private checkRedis;
}
export {};
