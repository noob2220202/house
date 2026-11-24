import { type AuthProvider } from '@house/shared';
import { type OAuthProvider } from './oauth-provider';
/** Looks up provider implementations registered under OAUTH_PROVIDERS. */
export declare class OAuthProviderRegistry {
    private readonly byName;
    constructor(providers: OAuthProvider[]);
    /** The enabled provider, or 404 AUTH_PROVIDER_DISABLED (unknown slugs fail validation earlier). */
    get(provider: AuthProvider): OAuthProvider;
    enabled(): AuthProvider[];
}
