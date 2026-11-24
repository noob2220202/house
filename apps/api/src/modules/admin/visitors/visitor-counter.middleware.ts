import { COOKIE_NAMES, isBotUserAgent } from '@house/shared';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { isAdminPath } from '../../../common/auth/session-resolver';
import { deviceClassOf, VisitorStatsService, visitorId } from './visitor-stats.service';

const SKIPPED_PREFIXES = ['/api/v1/health', '/api/v1/docs'];

/** Whether a request counts as a site visit (GET, not admin / health / docs, not a bot). */
export function countsAsVisit(req: Request): boolean {
  if (req.method !== 'GET') return false;
  if (isAdminPath(req)) return false;
  const path = req.originalUrl.split('?')[0] ?? '';
  if (SKIPPED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return false;
  return !isBotUserAgent(req.headers['user-agent']);
}

/**
 * Feeds the dashboard's "오늘 방문자" HyperLogLog. Applied to every route by AdminModule.
 * The SSR frontend must forward the browser's X-Forwarded-For / User-Agent for anonymous visits to
 * be told apart (TRUST_PROXY decides whether X-Forwarded-For is honoured).
 */
@Injectable()
export class VisitorCounterMiddleware implements NestMiddleware {
  constructor(private readonly visitors: VisitorStatsService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    if (countsAsVisit(req)) {
      const cookies = req.cookies as Record<string, string | undefined> | undefined;
      const ua = req.headers['user-agent'];
      this.visitors.recordSafe(
        visitorId({
          sessionToken: cookies?.[COOKIE_NAMES.SESSION],
          ip: req.ip,
          userAgent: typeof ua === 'string' ? ua : null,
        }),
        new Date(),
        deviceClassOf(typeof ua === 'string' ? ua : null),
      );
    }
    next();
  }
}
