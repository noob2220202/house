import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type Redis from 'ioredis';
import { TermsService } from './terms.service';
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
export declare class TermsConsentGuard implements CanActivate {
    private readonly reflector;
    private readonly terms;
    private readonly redis;
    constructor(reflector: Reflector, terms: TermsService, redis: Redis);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
