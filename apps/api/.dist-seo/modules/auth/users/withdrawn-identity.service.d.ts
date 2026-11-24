import type { AuthProvider } from '@house/shared';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
interface SocialAccount {
    provider: AuthProvider;
    providerUserId: string;
}
/**
 * 탈퇴 후 재가입 제한: remembers the social accounts of withdrawn members for REJOIN_COOLDOWN_DAYS,
 * so "withdraw, then sign up again" cannot shed daily caps, reports or moderation history.
 * Provider ids are stored as HMAC-SHA256 (keyed by COOKIE_SECRET): provider ids are short and
 * guessable, a plain hash would not pseudonymize them. Rotating COOKIE_SECRET ends running
 * cooldowns early (acceptable: it only weakens an abuse control for at most 30 days).
 */
export declare class WithdrawnIdentityService {
    private readonly prisma;
    private readonly key;
    constructor(prisma: PrismaService, config: AppConfig);
    hash(account: SocialAccount): string;
    /** Writes (or refreshes) a tombstone per identity, inside the withdrawal transaction. */
    record(tx: PrismaTx, userId: string, accounts: readonly SocialAccount[], now: Date, opts?: {
        cooldownDays?: number;
    }): Promise<void>;
    /** True while this social account may not sign up again. */
    inCooldown(account: SocialAccount, now?: Date, db?: PrismaTx | PrismaService): Promise<boolean>;
    /** Deletes tombstones whose cooldown is over (PII scrub job). */
    purgeExpired(now?: Date): Promise<number>;
}
export {};
