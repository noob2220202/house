import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service';

/**
 * Defense in depth for the e2e login: even if the module were imported by mistake, every request
 * answers 404 unless the validated config says NODE_ENV=test and E2E_FAKE_OAUTH=1.
 */
@Injectable()
export class E2eOnlyGuard implements CanActivate {
  constructor(private readonly config: AppConfig) {}

  canActivate(): boolean {
    if (this.config.isTest && this.config.get('E2E_FAKE_OAUTH') === true) return true;
    throw new NotFoundException();
  }
}
