import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_ROLES, ErrorCode, Role } from '@house/shared';
import type { Request } from 'express';
import { RequestContext } from '../context/request-context';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../decorators/metadata-keys';
import { AppException } from '../errors/app.exception';
import {
  isAdminPath,
  resolveSessionOnce,
  SESSION_RESOLVER,
  type SessionResolver,
} from './session-resolver';

/**
 * Global guard. Resolves the session (if any) onto req.principal, then:
 *  - non-@Public routes require a principal (401)
 *  - /api/v1/admin/* requires an ADMIN principal with TOTP verified (401)
 *  - @Roles(...) requires principal.role ∈ roles (403)
 * Resource ownership is NOT checked here — services must check it (no IDOR).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(SESSION_RESOLVER) private readonly sessions: SessionResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<Request>();
    const targets = [context.getHandler(), context.getClass()];
    const isPublic =
      this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, targets) ?? false;
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);

    const session = await resolveSessionOnce(req, this.sessions);
    if (session) {
      req.authSession = session;
      req.principal = session.principal;
      const ctx = RequestContext.current();
      if (ctx) ctx.principal = session.principal;
    }
    const principal = req.principal;

    if (isAdminPath(req) && !isPublic) {
      if (principal?.kind !== 'ADMIN') throw AppException.unauthenticated();
      if (!principal.mfaVerified) throw AppException.unauthenticated(ErrorCode.AUTH_TOTP_REQUIRED);
    }
    if (!principal) {
      if (isPublic) return true;
      throw AppException.unauthenticated();
    }
    if (roles && roles.length > 0) {
      if (!roles.includes(principal.role)) throw AppException.forbidden();
      const adminOnly = roles.every((r) => ADMIN_ROLES.includes(r));
      if (adminOnly && principal.kind !== 'ADMIN') throw AppException.forbidden();
    }
    return true;
  }
}
