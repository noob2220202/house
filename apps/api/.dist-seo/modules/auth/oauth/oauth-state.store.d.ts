import type { AuthProvider, OAuthIntent } from '@house/shared';
import type Redis from 'ioredis';
export interface OAuthStateRecord {
    provider: AuthProvider;
    intent: OAuthIntent;
    nonce: string;
    codeVerifier: string;
    /** SHA-256 of the browser-binding cookie value. */
    bindingHash: string;
    returnTo: string | null;
    /** intent=link: the user the identity will be attached to. */
    linkUserId: string | null;
    createdAt: number;
}
export declare function randomToken(bytes?: number): string;
export declare function sha256Hex(value: string): string;
/** RFC 7636 S256 code challenge. */
export declare function pkceChallenge(verifier: string): string;
/** OAuth `state` records in Redis: short TTL, single use (GETDEL). */
export declare class OAuthStateStore {
    private readonly redis;
    constructor(redis: Redis);
    create(input: Omit<OAuthStateRecord, 'createdAt'>): Promise<string>;
    /** Returns and deletes the record (a state can be redeemed once). */
    consume(state: string): Promise<OAuthStateRecord | null>;
}
