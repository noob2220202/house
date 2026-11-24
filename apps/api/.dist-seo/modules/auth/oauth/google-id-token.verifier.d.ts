import { z } from 'zod';
import { type OAuthHttpClient } from './oauth-http';
export declare const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
export declare const GOOGLE_ISSUERS: readonly ["https://accounts.google.com", "accounts.google.com"];
declare const claimsSchema: z.ZodObject<{
    iss: z.ZodString;
    aud: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
    azp: z.ZodOptional<z.ZodString>;
    sub: z.ZodString;
    exp: z.ZodNumber;
    iat: z.ZodNumber;
    nonce: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    email_verified: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodEnum<{
        true: "true";
        false: "false";
    }>]>>;
    name: z.ZodOptional<z.ZodString>;
    given_name: z.ZodOptional<z.ZodString>;
    family_name: z.ZodOptional<z.ZodString>;
    picture: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type GoogleIdTokenClaims = z.infer<typeof claimsSchema>;
export interface VerifyIdTokenOptions {
    audience: string;
    nonce: string;
    /** Epoch ms; defaults to Date.now() (tests pass a fixed clock). */
    now?: number;
}
/**
 * Verifies Google OIDC id_tokens (RS256) against Google's JWKS: signature, iss, aud, exp/iat, nonce.
 * Keys are cached in memory per process, honouring Cache-Control max-age.
 */
export declare class GoogleIdTokenVerifier {
    private readonly http;
    private readonly logger;
    private keys;
    private expiresAt;
    private lastFetchAt;
    private inflight;
    constructor(http: OAuthHttpClient);
    verify(idToken: string, opts: VerifyIdTokenOptions): Promise<GoogleIdTokenClaims>;
    private getKey;
    private refresh;
}
export {};
