import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppConfig } from '../../config/app-config.service';
/**
 * Global CSRF guard for state-changing requests (runs after AuthGuard):
 *  1. If Origin (or Referer) is present it must be in the allowlist.
 *  2. If the request is authenticated by a session cookie, the `x-csrf-token` header must equal
 *     the session's CSRF token (the token is also readable by the frontend in the house_csrf cookie).
 * Requests without a session carry no ambient credentials, so (2) does not apply to them.
 */
export declare class CsrfGuard implements CanActivate {
    private readonly reflector;
    private readonly allowed;
    constructor(reflector: Reflector, config: AppConfig);
    canActivate(context: ExecutionContext): boolean;
    private requestOrigin;
}
