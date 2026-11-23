import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AppException } from '../errors/app.exception';
import {
  AdminPrincipal,
  isAdminPrincipal,
  isUserPrincipal,
  Principal,
  UserPrincipal,
} from '../auth/principal';

/** The principal if any (use on @Public routes that personalize when logged in). */
export const CurrentPrincipal = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Principal | undefined =>
    ctx.switchToHttp().getRequest<Request>().principal,
);

/** The logged-in site user; throws 401 if the request has no user session. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UserPrincipal => {
    const p = ctx.switchToHttp().getRequest<Request>().principal;
    if (!isUserPrincipal(p)) throw AppException.unauthenticated();
    return p;
  },
);

/** The logged-in admin; throws 401 if the request has no admin session. */
export const CurrentAdmin = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AdminPrincipal => {
    const p = ctx.switchToHttp().getRequest<Request>().principal;
    if (!isAdminPrincipal(p)) throw AppException.unauthenticated();
    return p;
  },
);
