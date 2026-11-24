import type Redis from 'ioredis';
import type { OAuthProfile } from '../oauth/oauth-provider';
export interface PendingSignup {
    profile: OAuthProfile;
    returnTo: string | null;
    createdAt: number;
}
/**
 * A first-time social login is parked here until the user agrees to the terms (POST /auth/signup).
 * No User row exists before that, so abandoned signups leave nothing behind.
 */
export declare class PendingSignupStore {
    private readonly redis;
    constructor(redis: Redis);
    create(profile: OAuthProfile, returnTo: string | null): Promise<string>;
    get(token: string | undefined): Promise<PendingSignup | null>;
    delete(token: string): Promise<void>;
}
