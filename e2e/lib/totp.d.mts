export declare const TOTP_STEP_SECONDS: number;
export declare function base32Decode(input: string): Buffer;
export declare function hotp(secretBase32: string, counter: number, digits?: number): string;
export declare function totpStep(nowMs?: number): number;
export declare function totp(secretBase32: string, nowMs?: number): string;
export declare function freshTotp(
  secretBase32: string,
  lastUsedStep?: number,
): Promise<{ code: string; step: number }>;
