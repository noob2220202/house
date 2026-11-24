import { AppConfig } from '../../../config/app-config.service';
/**
 * AES-256-GCM for small secrets at rest (admin TOTP secrets), keyed by TOTP_ENCRYPTION_KEY.
 * `aad` binds a ciphertext to its owner (the admin id), so a secret copied onto another row fails.
 * Format: v1.<iv>.<tag>.<ciphertext> (base64url).
 */
export declare class SecretBox {
    private readonly key;
    constructor(config: AppConfig);
    encrypt(plaintext: string, aad: string): string;
    /** Throws when the payload was tampered with, belongs to another aad, or uses another key. */
    decrypt(payload: string, aad: string): string;
}
