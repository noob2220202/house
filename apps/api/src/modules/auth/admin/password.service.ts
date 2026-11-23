import { randomBytes, randomInt } from 'node:crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/** OWASP-recommended argon2id parameters (m=19 MiB, t=2, p=1). The library default is argon2id. */
const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

/** No 0/O/1/I/L/U: unambiguous when read off a screen or paper. */
const RECOVERY_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * argon2id password hashing for admin accounts (exported: the admin module uses it to create
 * admins) and one-time recovery codes.
 */
@Injectable()
export class PasswordService implements OnModuleInit {
  /** Real hash of a random value: verified against when the email is unknown (equal timing). */
  private dummyHash = '';

  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.hash(randomBytes(16).toString('hex'));
  }

  hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  /** Burns the same time as a real verification (unknown account). Always false. */
  async verifyDummy(password: string): Promise<false> {
    if (this.dummyHash) await this.verify(this.dummyHash, password);
    return false;
  }

  /** Recovery codes in display form "ABCD-EFGH". Store only their hashes (normalizeRecoveryCode first). */
  generateRecoveryCodes(count: number): string[] {
    return Array.from({ length: count }, () => {
      const chars = Array.from(
        { length: 8 },
        () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)] as string,
      ).join('');
      return `${chars.slice(0, 4)}-${chars.slice(4)}`;
    });
  }
}

/** "abcd-efgh" → "ABCDEFGH" (matches recoveryCodeSchema's transform). */
export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^0-9A-Z]/g, '');
}
