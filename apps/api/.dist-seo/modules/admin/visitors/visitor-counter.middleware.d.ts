import { type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { VisitorStatsService } from './visitor-stats.service';
/** Whether a request counts as a site visit (GET, not admin / health / docs, not a bot). */
export declare function countsAsVisit(req: Request): boolean;
/**
 * Feeds the dashboard's "오늘 방문자" HyperLogLog. Applied to every route by AdminModule.
 * The SSR frontend must forward the browser's X-Forwarded-For / User-Agent for anonymous visits to
 * be told apart (TRUST_PROXY decides whether X-Forwarded-For is honoured).
 */
export declare class VisitorCounterMiddleware implements NestMiddleware {
    private readonly visitors;
    constructor(visitors: VisitorStatsService);
    use(req: Request, _res: Response, next: NextFunction): void;
}
