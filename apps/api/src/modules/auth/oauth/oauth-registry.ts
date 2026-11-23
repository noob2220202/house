import { Inject, Injectable } from '@nestjs/common';
import { type AuthProvider, ErrorCode } from '@house/shared';
import { AppException } from '../../../common/errors/app.exception';
import { OAUTH_PROVIDERS, type OAuthProvider } from './oauth-provider';

/** Looks up provider implementations registered under OAUTH_PROVIDERS. */
@Injectable()
export class OAuthProviderRegistry {
  private readonly byName: Map<AuthProvider, OAuthProvider>;

  constructor(@Inject(OAUTH_PROVIDERS) providers: OAuthProvider[]) {
    this.byName = new Map(providers.map((p) => [p.provider, p]));
  }

  /** The enabled provider, or 404 AUTH_PROVIDER_DISABLED (unknown slugs fail validation earlier). */
  get(provider: AuthProvider): OAuthProvider {
    const impl = this.byName.get(provider);
    if (!impl || !impl.isEnabled()) {
      throw new AppException(ErrorCode.AUTH_PROVIDER_DISABLED, { status: 404 });
    }
    return impl;
  }

  enabled(): AuthProvider[] {
    return [...this.byName.values()].filter((p) => p.isEnabled()).map((p) => p.provider);
  }
}
