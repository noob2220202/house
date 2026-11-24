import type Redis from 'ioredis';
/**
 * A suspended member gets no session, but must still be able to withdraw (개인정보 보호법 제36·37조).
 * When their social login is refused for suspension, the OAuth callback parks a short-lived ticket
 * here (httpOnly cookie scoped to POST /auth/withdraw). The ticket proves a fresh login with the
 * account's own social identity and is good for nothing but that withdrawal.
 */
export declare class SuspendedWithdrawStore {
    private readonly redis;
    constructor(redis: Redis);
    create(userId: string): Promise<string>;
    get(token: string | undefined): Promise<string | null>;
    delete(token: string): Promise<void>;
}
