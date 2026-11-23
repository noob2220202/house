import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { AuthProvider } from '@house/shared';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { REJOIN_COOLDOWN_DAYS } from '../auth.constants';

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
@Injectable()
export class WithdrawnIdentityService {
  private readonly key: string;

  constructor(
    private readonly prisma: PrismaService,
    config: AppConfig,
  ) {
    this.key = config.get('COOKIE_SECRET');
  }

  hash(account: SocialAccount): string {
    return createHmac('sha256', this.key)
      .update(`withdrawn-identity:v1:${account.provider}:${account.providerUserId}`)
      .digest('hex');
  }

  /** Writes (or refreshes) a tombstone per identity, inside the withdrawal transaction. */
  async record(
    tx: PrismaTx,
    userId: string,
    accounts: readonly SocialAccount[],
    now: Date,
  ): Promise<void> {
    const rejoinAfter = new Date(now.getTime() + REJOIN_COOLDOWN_DAYS * 86_400_000);
    for (const account of accounts) {
      const providerUserIdHash = this.hash(account);
      await tx.withdrawnIdentity.upsert({
        where: {
          provider_providerUserIdHash: { provider: account.provider, providerUserIdHash },
        },
        create: {
          provider: account.provider,
          providerUserIdHash,
          userId,
          withdrawnAt: now,
          rejoinAfter,
        },
        update: { userId, withdrawnAt: now, rejoinAfter },
      });
    }
  }

  /** True while this social account may not sign up again. */
  async inCooldown(
    account: SocialAccount,
    now: Date = new Date(),
    db: PrismaTx | PrismaService = this.prisma,
  ): Promise<boolean> {
    const row = await db.withdrawnIdentity.findUnique({
      where: {
        provider_providerUserIdHash: {
          provider: account.provider,
          providerUserIdHash: this.hash(account),
        },
      },
      select: { rejoinAfter: true },
    });
    return row !== null && row.rejoinAfter > now;
  }

  /** Deletes tombstones whose cooldown is over (PII scrub job). */
  async purgeExpired(now: Date = new Date()): Promise<number> {
    const { count } = await this.prisma.withdrawnIdentity.deleteMany({
      where: { rejoinAfter: { lte: now } },
    });
    return count;
  }
}
