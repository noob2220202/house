// Tiny RFC 6238 TOTP (RFC 4226 HOTP + base32), matching the API's otplib settings:
// SHA-1, 6 digits, 30 s step. Used by scripts/e2e/enroll-admin.mjs and the Playwright tests.
// No dependencies (node:crypto only).
import { createHmac } from 'node:crypto';

export const TOTP_STEP_SECONDS = 30;

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** RFC 4648 base32 → bytes (case-insensitive, padding and spaces ignored). */
export function base32Decode(input) {
  const clean = String(input).toUpperCase().replace(/[\s=]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error(`invalid base32 character "${ch}"`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** RFC 4226 HOTP for a counter. */
export function hotp(secretBase32, counter, digits = 6) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac('sha1', base32Decode(secretBase32)).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin =
    ((mac[offset] & 0x7f) << 24) |
    (mac[offset + 1] << 16) |
    (mac[offset + 2] << 8) |
    mac[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

/** Time step (counter) of an epoch-ms instant. */
export function totpStep(nowMs = Date.now()) {
  return Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);
}

/** RFC 6238 code for an instant (default: now). */
export function totp(secretBase32, nowMs = Date.now()) {
  return hotp(secretBase32, totpStep(nowMs));
}

/**
 * A code whose time step is strictly after `lastUsedStep`. The API refuses a replayed step, so a
 * second login inside the same 30 s window must wait for the next step: this waits until the
 * step boundary (never longer than one step) instead of sleeping a fixed time.
 * @returns {Promise<{ code: string, step: number }>}
 */
export async function freshTotp(secretBase32, lastUsedStep = -1) {
  for (;;) {
    const now = Date.now();
    const step = totpStep(now);
    if (step > lastUsedStep) return { code: hotp(secretBase32, step), step };
    const untilNext = (step + 1) * TOTP_STEP_SECONDS * 1000 - now + 50;
    await new Promise((resolve) => setTimeout(resolve, untilNext));
  }
}
