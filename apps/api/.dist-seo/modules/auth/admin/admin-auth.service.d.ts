import { type AdminLoginInput, type AdminLoginResponse, type AdminMeResponse, type AdminSessionResponse, type AdminTotpActivateResponse, type AdminTotpSetupInput, type AdminTotpSetupResponse, type AdminTotpVerifyInput } from '@house/shared';
import type { AdminUser } from '@prisma/client';
import type { Request, Response } from 'express';
import type Redis from 'ioredis';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { AuditService } from '../../../common/audit/audit.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SessionService } from '../session/session.service';
import { PasswordService } from './password.service';
import { SecretBox } from './secret-box';
import { TotpService } from './totp.service';
export declare function toAdminMe(a: AdminUser): AdminMeResponse;
/**
 * Back-office login: email + argon2id password → short pre-MFA session → mandatory TOTP
 * (enrollment on first login) → session rotated into a verified one.
 *
 * Two lockouts, so that knowing an admin's email is not enough to lock them out:
 * - Wrong passwords count per (admin, client IP bucket) in Redis within a 15-minute window;
 *   ADMIN_MAX_PASSWORD_FAILURES locks only that pair for 15 minutes. The account, its other
 *   networks and its existing sessions are untouched.
 * - Second-factor failures (and wrong passwords on re-auth from a verified session) prove the
 *   caller knows the password: they share the account-wide counter that only a completed second
 *   factor resets; ADMIN_MAX_FAILED_ATTEMPTS locks the account, kills its sessions and is audited.
 */
export declare class AdminAuthService {
    private readonly prisma;
    private readonly sessions;
    private readonly passwords;
    private readonly totp;
    private readonly box;
    private readonly audit;
    private readonly redis;
    private readonly logger;
    constructor(prisma: PrismaService, sessions: SessionService, passwords: PasswordService, totp: TotpService, box: SecretBox, audit: AuditService, redis: Redis);
    /**
     * Password step. Every refusal (unknown email, disabled, outside the account's IP allowlist,
     * locked, wrong password) is the same 401 after the same argon2 work, so the endpoint reveals
     * neither which emails exist nor whether a password is right while the account or this client
     * is locked, or the caller is outside its allowlist. Only wrong passwords from an allowed network
     * count, and only toward this client's lock. No counter is reset here: only a completed second
     * factor resets them, so "right password, then a few wrong codes" cannot be repeated forever.
     */
    login(dto: AdminLoginInput, req: Request, res: Response): Promise<AdminLoginResponse>;
    /**
     * Starts TOTP enrollment (first login, pre-MFA session) or rotation. Rotation needs a verified
     * session AND re-authentication with the current password plus a current TOTP / recovery code,
     * so a hijacked session alone cannot swap the second factor. The pending secret is bound to the
     * session that asked for it and kept in Redis until activated.
     */
    setupTotp(principal: AdminPrincipal, dto: AdminTotpSetupInput, req: Request): Promise<AdminTotpSetupResponse>;
    /** Confirms enrollment with a first code; returns the one-time recovery codes (shown once). */
    activateTotp(principal: AdminPrincipal, code: string, req: Request, res: Response): Promise<AdminTotpActivateResponse>;
    /** Second factor for an enrolled admin: TOTP code or a one-time recovery code. */
    verifyTotp(principal: AdminPrincipal, dto: AdminTotpVerifyInput, req: Request, res: Response): Promise<AdminSessionResponse>;
    me(principal: AdminPrincipal): Promise<AdminMeResponse>;
    logout(req: Request, res: Response): Promise<void>;
    changePassword(principal: AdminPrincipal, dto: {
        currentPassword: string;
        newPassword: string;
    }, req: Request, res: Response): Promise<AdminSessionResponse>;
    private issueSession;
    private loadActive;
    private isLocked;
    /** TOTP check with replay protection: each time-step is accepted once per admin. */
    private checkTotp;
    /** Recovery codes are single use; concurrent use of one code succeeds at most once. */
    private consumeRecoveryCode;
    /** Rotation re-auth: current password + a current TOTP code or a recovery code. */
    private reauthenticate;
    /** The pending enrollment secret, only for the session that started it. */
    private pendingSetupSecret;
    /**
     * Counts a wrong password at the login step for one (admin, client IP bucket). The counter lives
     * in a fixed window that starts at the first failure; the attempt that reaches the limit locks
     * the pair for ADMIN_CLIENT_LOCK_SECONDS (audited). Never touches the account or its sessions:
     * this step proves nothing about the caller, so it must not let them lock the admin out.
     */
    private registerPasswordFailure;
    /**
     * Counts a failed attempt by a caller who already knows the password (second factor, or the
     * password on re-auth from a verified session). Returns true when this attempt locked the
     * account (sessions are destroyed and the lock is audited).
     */
    private registerFailure;
}
