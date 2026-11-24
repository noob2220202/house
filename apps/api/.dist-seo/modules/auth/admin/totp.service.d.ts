/** RFC 6238 TOTP (Google Authenticator compatible: SHA-1, 6 digits, 30s) via otplib. */
export declare class TotpService {
    generateSecret(): string;
    keyUri(accountName: string, secret: string): string;
    /**
     * Returns the absolute time-step the code matched (for replay protection), or null.
     * `now` is epoch ms (tests pass a fixed clock).
     */
    verify(secret: string, code: string, now?: number): number | null;
    /** Current code (tests and tooling only). */
    generate(secret: string, now?: number): string;
}
