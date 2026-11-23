import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config.service';

const VERSION = 'v1';

/**
 * AES-256-GCM for small secrets at rest (admin TOTP secrets), keyed by TOTP_ENCRYPTION_KEY.
 * `aad` binds a ciphertext to its owner (the admin id), so a secret copied onto another row fails.
 * Format: v1.<iv>.<tag>.<ciphertext> (base64url).
 */
@Injectable()
export class SecretBox {
  private readonly key: Buffer;

  constructor(config: AppConfig) {
    this.key = Buffer.from(config.get('TOTP_ENCRYPTION_KEY'), 'base64');
    if (this.key.length !== 32) throw new Error('TOTP_ENCRYPTION_KEY must decode to 32 bytes');
  }

  encrypt(plaintext: string, aad: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(aad));
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv, tag, ct].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.');
  }

  /** Throws when the payload was tampered with, belongs to another aad, or uses another key. */
  decrypt(payload: string, aad: string): string {
    const [version, iv, tag, ct] = payload.split('.');
    if (version !== VERSION || !iv || !tag || ct === undefined) {
      throw new Error('Unsupported secret payload');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ct, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
