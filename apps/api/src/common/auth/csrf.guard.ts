import { timingSafeEqual } from 'node:crypto';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, HEADER_NAMES } from '@house/shared';
import type { Request } from 'express';
import { AppConfig } from '../../config/app-config.service';
import { SKIP_CSRF_KEY } from '../decorators/metadata-keys';
import { AppException } from '../errors/app.exception';
import { OriginPolicy } from './origin-policy';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Global CSRF guard for state-changing requests (runs after AuthGuard):
 *  1. If Origin (or Referer) is present it must be allowed for the request's surface
 *     (OriginPolicy: admin routes only the admin site, user routes only the public site).
 *  2. If the request is authenticated by a session cookie, the `x-csrf-token` header must equal
 *     the session's CSRF token (the token is also readable by the frontend in the house_csrf cookie).
 * Requests without a session carry no ambient credentials, so (2) does not apply to them.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly origins: OriginPolicy;

  constructor(
    private readonly reflector: Reflector,
    config: AppConfig,
  ) {
    this.origins = OriginPolicy.fromConfig(config);
  }

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;
    const skip = this.reflector.getAllAndOverride<boolean | undefined>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const origin = this.requestOrigin(req);
    if (origin !== null && !this.origins.allows(req, origin))
      throw AppException.forbidden(ErrorCode.CSRF_FAILED);

    if (req.authSession) {
      const header = req.headers[HEADER_NAMES.CSRF];
      if (typeof header !== 'string' || !safeEqual(header, req.authSession.csrfToken)) {
        throw AppException.forbidden(ErrorCode.CSRF_FAILED);
      }
    }
    return true;
  }

  private requestOrigin(req: Request): string | null {
    const origin = req.headers.origin;
    if (typeof origin === 'string' && origin !== 'null') return origin;
    if (origin === 'null') return 'null';
    const referer = req.headers.referer;
    if (typeof referer === 'string') {
      try {
        return new URL(referer).origin;
      } catch {
        return 'invalid';
      }
    }
    return null;
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
