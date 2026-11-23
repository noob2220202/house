import { createHash } from 'node:crypto';
import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@house/shared';
import type { Request } from 'express';
import type Redis from 'ioredis';
import { isUserPrincipal } from '../../../common/auth/principal';
import { AppException } from '../../../common/errors/app.exception';
import { REDIS } from '../../../redis/redis.constants';
import { REDIS_KEYS, TERMS_CONSENT_OK_TTL_SECONDS } from '../auth.constants';
import { SKIP_TERMS_CHECK_KEY } from './skip-terms-check.decorator';
import { TermsService } from './terms.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Global guard (registered by AuthModule, runs after AuthGuard): a member who has not agreed to the
 * current version of every required terms document cannot make state-changing requests
 * (403 AUTH_TERMS_REQUIRED, details.missing = the pending types) until they POST /me/consents.
 * Reads stay open, and routes marked @SkipTermsCheck() (auth, own account, consents, withdrawal)
 * stay usable. Admin sessions are not affected.
 *
 * Only a positive result is cached, keyed by the set of current required document ids: a newly
 * effective version changes the key, so nothing has to be invalidated on publish or on consent,
 * and required consents cannot be revoked, so a cached "ok" cannot go stale.
 */
@Injectable()
export class TermsConsentGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly terms: TermsService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;
    const principal = req.principal;
    if (!isUserPrincipal(principal)) return true;
    const skip = this.reflector.getAllAndOverride<boolean | undefined>(SKIP_TERMS_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const required = (await this.terms.current()).filter((d) => d.isRequired);
    if (required.length === 0) return true;
    const digest = createHash('sha256')
      .update(
        required
          .map((d) => d.id)
          .sort()
          .join(','),
      )
      .digest('hex')
      .slice(0, 32);
    const key = REDIS_KEYS.termsConsentOk(principal.userId, digest);
    if ((await this.redis.get(key)) !== null) return true;

    const missing = await this.terms.pendingRequired(principal.userId, required);
    if (missing.length === 0) {
      await this.redis.set(key, '1', 'EX', TERMS_CONSENT_OK_TTL_SECONDS);
      return true;
    }
    throw new AppException(ErrorCode.AUTH_TERMS_REQUIRED, {
      status: HttpStatus.FORBIDDEN,
      details: { missing },
    });
  }
}
