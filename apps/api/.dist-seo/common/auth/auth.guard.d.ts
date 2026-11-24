import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type SessionResolver } from './session-resolver';
/**
 * Global guard. Resolves the session (if any) onto req.principal, then:
 *  - non-@Public routes require a principal (401)
 *  - /api/v1/admin/* requires an ADMIN principal with TOTP verified (401)
 *  - @Roles(...) requires principal.role ∈ roles (403)
 * Resource ownership is NOT checked here — services must check it (no IDOR).
 */
export declare class AuthGuard implements CanActivate {
    private readonly reflector;
    private readonly sessions;
    constructor(reflector: Reflector, sessions: SessionResolver);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
