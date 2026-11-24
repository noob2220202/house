import { OnModuleInit } from '@nestjs/common';
/**
 * argon2id password hashing for admin accounts (exported: the admin module uses it to create
 * admins) and one-time recovery codes.
 */
export declare class PasswordService implements OnModuleInit {
    /** Real hash of a random value: verified against when the email is unknown (equal timing). */
    private dummyHash;
    onModuleInit(): Promise<void>;
    hash(password: string): Promise<string>;
    verify(passwordHash: string, password: string): Promise<boolean>;
    /** Burns the same time as a real verification (unknown account). Always false. */
    verifyDummy(password: string): Promise<false>;
    /** Recovery codes in display form "ABCD-EFGH". Store only their hashes (normalizeRecoveryCode first). */
    generateRecoveryCodes(count: number): string[];
}
/** "abcd-efgh" → "ABCDEFGH" (matches recoveryCodeSchema's transform). */
export declare function normalizeRecoveryCode(code: string): string;
