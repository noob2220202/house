import { CanActivate, ExecutionContext } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config.service';
/**
 * Global guard (registered by AuthModule): when ADMIN_IP_ALLOWLIST is set, every /api/v1/admin/*
 * request — including the public login — must come from it. Per-account allowlists are enforced at
 * login and on every request by SessionService.resolve. Relies on Express `trust proxy` for req.ip.
 */
export declare class AdminIpGuard implements CanActivate {
    private readonly logger;
    private readonly allowlist;
    constructor(config: AppConfig);
    canActivate(context: ExecutionContext): boolean;
}
