import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import { TOTP_ISSUER } from '../auth.constants';

const STEP_SECONDS = 30;
/** Accept the previous and next 30s window (clock drift on phones). */
const WINDOW = 1;

/** RFC 6238 TOTP (Google Authenticator compatible: SHA-1, 6 digits, 30s) via otplib. */
@Injectable()
export class TotpService {
  generateSecret(): string {
    return authenticator.generateSecret(20);
  }

  keyUri(accountName: string, secret: string): string {
    return authenticator.keyuri(accountName, TOTP_ISSUER, secret);
  }

  /**
   * Returns the absolute time-step the code matched (for replay protection), or null.
   * `now` is epoch ms (tests pass a fixed clock).
   */
  verify(secret: string, code: string, now: number = Date.now()): number | null {
    if (!/^\d{6}$/.test(code)) return null;
    const instance = authenticator.clone({ epoch: now, window: WINDOW, step: STEP_SECONDS });
    let delta: number | null;
    try {
      delta = instance.checkDelta(code, secret);
    } catch {
      return null;
    }
    return delta === null ? null : Math.floor(now / 1000 / STEP_SECONDS) + delta;
  }

  /** Current code (tests and tooling only). */
  generate(secret: string, now: number = Date.now()): string {
    return authenticator.clone({ epoch: now, step: STEP_SECONDS }).generate(secret);
  }
}
