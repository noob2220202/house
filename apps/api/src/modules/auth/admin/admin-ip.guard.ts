import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ErrorCode } from '@house/shared';
import type { Request } from 'express';
import { isAdminPath } from '../../../common/auth/session-resolver';
import { AppException } from '../../../common/errors/app.exception';
import { AppConfig } from '../../../config/app-config.service';
import { IpAllowlist } from './ip-allowlist';

/**
 * Global guard (registered by AuthModule): when ADMIN_IP_ALLOWLIST is set, every /api/v1/admin/*
 * request — including the public login — must come from it. Per-account allowlists are enforced at
 * login and on every request by SessionService.resolve. Relies on Express `trust proxy` for req.ip.
 */
@Injectable()
export class AdminIpGuard implements CanActivate {
  private readonly logger = new Logger(AdminIpGuard.name);
  private readonly allowlist: IpAllowlist;

  constructor(config: AppConfig) {
    this.allowlist = new IpAllowlist(config.get('ADMIN_IP_ALLOWLIST'));
  }

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http' || this.allowlist.size === 0) return true;
    const req = context.switchToHttp().getRequest<Request>();
    if (!isAdminPath(req)) return true;
    if (this.allowlist.allows(req.ip)) return true;
    this.logger.warn({ ip: req.ip, path: req.path }, 'admin request from a non-allowlisted IP');
    throw AppException.forbidden(ErrorCode.AUTH_IP_NOT_ALLOWED);
  }
}
