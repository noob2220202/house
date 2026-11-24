import { CanActivate } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service';
/**
 * Defense in depth for the e2e login: even if the module were imported by mistake, every request
 * answers 404 unless the validated config says NODE_ENV=test and E2E_FAKE_OAUTH=1.
 */
export declare class E2eOnlyGuard implements CanActivate {
    private readonly config;
    constructor(config: AppConfig);
    canActivate(): boolean;
}
