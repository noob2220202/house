import type { AuthProvider } from '@house/shared';
import type { z } from 'zod';
import type { OAuthHttpResponse } from './oauth-http';
export interface AuthorizeUrlParams {
    state: string;
    nonce: string;
    /** PKCE S256 challenge (sent only by providers that support PKCE). */
    codeChallenge: string;
    redirectUri: string;
}
export interface CodeExchangeParams {
    code: string;
    state: string;
    codeVerifier: string;
    redirectUri: string;
}
export interface OAuthTokens {
    accessToken: string;
    idToken?: string;
}
export interface ProfileContext {
    /** Nonce stored with the state; providers using OIDC must check it in the id_token. */
    nonce: string;
}
/** Normalized provider profile. Only `providerUserId` is trusted for account linking. */
export interface OAuthProfile {
    provider: AuthProvider;
    providerUserId: string;
    email: string | null;
    /** The provider asserts the email is verified (informational only — never used to link). */
    emailVerified: boolean;
    name: string | null;
    nickname: string | null;
    /** Mobile number in canonical digits when the user granted it (Kakao/Naver); never verified. */
    phone: string | null;
    profileImageUrl: string | null;
}
/**
 * One class per social login provider, registered under OAUTH_PROVIDERS. Adding a provider means
 * adding a class + an AuthProvider enum value + a slug; the flow (OAuthService) does not change.
 */
export interface OAuthProvider {
    readonly provider: AuthProvider;
    /** Enabled when its client id is configured. */
    isEnabled(): boolean;
    redirectUri(): string;
    buildAuthorizeUrl(params: AuthorizeUrlParams): string;
    exchangeCode(params: CodeExchangeParams): Promise<OAuthTokens>;
    fetchProfile(tokens: OAuthTokens, ctx: ProfileContext): Promise<OAuthProfile>;
}
export declare const OAUTH_PROVIDERS: unique symbol;
/** Provider-side failure (bad response, rejected code, invalid id_token). Message is for logs only. */
export declare class OAuthProviderError extends Error {
    readonly provider: AuthProvider;
    constructor(provider: AuthProvider, message: string);
}
/** Validates a provider response body against a zod schema, or throws OAuthProviderError. */
export declare function parseProviderBody<T extends z.ZodType>(provider: AuthProvider, what: string, res: OAuthHttpResponse, schema: T): z.output<T>;
/** Provider phone ("+82 10-1234-5678") → "01012345678", or null when absent / not a mobile number. */
export declare function normalizeProviderPhone(raw: string | null | undefined): string | null;
/** Trims and bounds free-text profile fields to the column sizes. */
export declare function cleanText(value: string | null | undefined, max: number): string | null;
/** Only https image URLs are kept (http is upgraded: Kakao still returns some http CDN URLs). */
export declare function cleanImageUrl(value: string | null | undefined): string | null;
export declare function cleanEmail(value: string | null | undefined): string | null;
