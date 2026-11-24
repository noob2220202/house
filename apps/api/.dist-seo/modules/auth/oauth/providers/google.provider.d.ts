import { AppConfig } from '../../../../config/app-config.service';
import { GoogleIdTokenVerifier } from '../google-id-token.verifier';
import { type OAuthHttpClient } from '../oauth-http';
import { type AuthorizeUrlParams, type CodeExchangeParams, type OAuthProfile, type OAuthProvider, type OAuthTokens, type ProfileContext } from '../oauth-provider';
export declare const GOOGLE_ENDPOINTS: {
    readonly authorize: "https://accounts.google.com/o/oauth2/v2/auth";
    readonly token: "https://oauth2.googleapis.com/token";
};
/**
 * Google (OIDC): authorization code + PKCE (S256) + nonce. The profile comes from the verified
 * id_token — no userinfo call, so nothing unverified feeds the account.
 */
export declare class GoogleOAuthProvider implements OAuthProvider {
    private readonly config;
    private readonly http;
    private readonly verifier;
    readonly provider: "GOOGLE";
    constructor(config: AppConfig, http: OAuthHttpClient, verifier: GoogleIdTokenVerifier);
    isEnabled(): boolean;
    redirectUri(): string;
    buildAuthorizeUrl(p: AuthorizeUrlParams): string;
    exchangeCode(p: CodeExchangeParams): Promise<OAuthTokens>;
    fetchProfile(tokens: OAuthTokens, ctx: ProfileContext): Promise<OAuthProfile>;
    private credentials;
}
