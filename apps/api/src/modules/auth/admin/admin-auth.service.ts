import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type AdminLoginInput,
  type AdminLoginResponse,
  type AdminMeResponse,
  type AdminSessionResponse,
  type AdminTotpActivateResponse,
  AdminStatus,
  type AdminTotpSetupInput,
  type AdminTotpSetupResponse,
  AuditActorType,
  type AdminTotpVerifyInput,
  ErrorCode,
} from '@house/shared';
import { HttpStatus } from '@nestjs/common';
import type { AdminUser } from '@prisma/client';
import type { Request, Response } from 'express';
import type Redis from 'ioredis';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { AuditService } from '../../../common/audit/audit.service';
import { AppException } from '../../../common/errors/app.exception';
import { PrismaService } from '../../../prisma/prisma.service';
import { REDIS } from '../../../redis/redis.constants';
import {
  ADMIN_LOCK_MINUTES,
  ADMIN_MAX_FAILED_ATTEMPTS,
  ADMIN_PRE_MFA_IDLE_TTL_SECONDS,
  RECOVERY_CODE_COUNT,
  REDIS_KEYS,
  TOTP_SETUP_TTL_SECONDS,
} from '../auth.constants';
import { readSessionCookie, SessionService } from '../session/session.service';
import { ipAllowed } from './ip-allowlist';
import { normalizeRecoveryCode, PasswordService } from './password.service';
import { SecretBox } from './secret-box';
import { TotpService } from './totp.service';

const invalidCredentials = () =>
  new AppException(ErrorCode.AUTH_INVALID_CREDENTIALS, { status: HttpStatus.UNAUTHORIZED });
const totpInvalid = () =>
  new AppException(ErrorCode.AUTH_TOTP_INVALID, { status: HttpStatus.UNAUTHORIZED });
const locked = () => new AppException(ErrorCode.AUTH_ACCOUNT_LOCKED, { status: HttpStatus.LOCKED });

export function toAdminMe(a: AdminUser): AdminMeResponse {
  return {
    id: a.id,
    email: a.email,
    name: a.name,
    role: a.role,
    totpEnabled: a.totpEnabledAt !== null,
    recoveryCodesRemaining: a.recoveryCodeHashes.length,
    lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
    lastLoginIp: a.lastLoginIp,
  };
}

/**
 * Back-office login: email + argon2id password → short pre-MFA session → mandatory TOTP
 * (enrollment on first login) → session rotated into a verified one. Failed password and TOTP
 * attempts share one counter that only a completed second factor resets; reaching
 * ADMIN_MAX_FAILED_ATTEMPTS locks the account, kills its sessions and writes an audit row.
 */
@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly passwords: PasswordService,
    private readonly totp: TotpService,
    private readonly box: SecretBox,
    private readonly audit: AuditService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /**
   * Password step. Every refusal (unknown email, disabled, outside the account's IP allowlist,
   * locked, wrong password) is the same 401 after the same argon2 work, so the endpoint reveals
   * neither which emails exist nor whether a password is right while the account is locked or the
   * caller is outside its allowlist. Only wrong passwords from an allowed network count toward the
   * lock. The failure counter is NOT reset here: only a completed second factor resets it, so
   * "right password, then a few wrong codes" cannot be repeated forever.
   */
  async login(dto: AdminLoginInput, req: Request, res: Response): Promise<AdminLoginResponse> {
    const admin = await this.prisma.adminUser.findUnique({ where: { email: dto.email } });
    const refusal = !admin
      ? 'unknown email'
      : admin.status !== AdminStatus.ACTIVE
        ? 'account not active'
        : !ipAllowed(admin.ipAllowlist, req.ip)
          ? 'IP not allowlisted'
          : null;
    if (!admin || refusal) {
      await this.passwords.verifyDummy(dto.password);
      this.logger.warn({ adminId: admin?.id, ip: req.ip, reason: refusal }, 'admin login refused');
      throw invalidCredentials();
    }
    const ok = await this.passwords.verify(admin.passwordHash, dto.password);
    if (this.isLocked(admin)) {
      this.logger.warn({ adminId: admin.id, ip: req.ip }, 'admin login refused: account locked');
      throw invalidCredentials();
    }
    if (!ok) {
      await this.registerFailure(admin.id, req);
      this.logger.warn({ adminId: admin.id, ip: req.ip }, 'admin login: wrong password');
      throw invalidCredentials();
    }
    const csrfToken = await this.issueSession(req, res, admin, false);
    return { mfaRequired: true, totpEnrolled: admin.totpEnabledAt !== null, csrfToken };
  }

  /**
   * Starts TOTP enrollment (first login, pre-MFA session) or rotation. Rotation needs a verified
   * session AND re-authentication with the current password plus a current TOTP / recovery code,
   * so a hijacked session alone cannot swap the second factor. The pending secret is bound to the
   * session that asked for it and kept in Redis until activated.
   */
  async setupTotp(
    principal: AdminPrincipal,
    dto: AdminTotpSetupInput,
    req: Request,
  ): Promise<AdminTotpSetupResponse> {
    const admin = await this.loadActive(principal.adminId);
    if (admin.totpEnabledAt) {
      if (!principal.mfaVerified) throw AppException.unauthenticated(ErrorCode.AUTH_TOTP_REQUIRED);
      await this.reauthenticate(admin, dto, req);
    }
    const secret = this.totp.generateSecret();
    await this.redis.set(
      REDIS_KEYS.totpSetup(admin.id),
      this.box.encrypt(secret, setupAad(admin.id, principal.sessionId)),
      'EX',
      TOTP_SETUP_TTL_SECONDS,
    );
    if (admin.totpEnabledAt) {
      this.logger.log({ adminId: admin.id, ip: req.ip }, 'admin TOTP rotation started');
    }
    return {
      secret,
      otpauthUrl: this.totp.keyUri(admin.email, secret),
      expiresInSeconds: TOTP_SETUP_TTL_SECONDS,
    };
  }

  /** Confirms enrollment with a first code; returns the one-time recovery codes (shown once). */
  async activateTotp(
    principal: AdminPrincipal,
    code: string,
    req: Request,
    res: Response,
  ): Promise<AdminTotpActivateResponse> {
    const admin = await this.loadActive(principal.adminId);
    if (this.isLocked(admin)) throw locked();
    if (admin.totpEnabledAt && !principal.mfaVerified) {
      throw AppException.unauthenticated(ErrorCode.AUTH_TOTP_REQUIRED);
    }
    const secret = await this.pendingSetupSecret(admin.id, principal.sessionId);
    if (!secret) throw AppException.badRequest(ErrorCode.AUTH_TOTP_SETUP_EXPIRED);
    if (!(await this.checkTotp(admin.id, secret, code))) {
      if (await this.registerFailure(admin.id, req)) throw locked();
      throw totpInvalid();
    }

    const recoveryCodes = this.passwords.generateRecoveryCodes(RECOVERY_CODE_COUNT);
    const hashes = await Promise.all(
      recoveryCodes.map((c) => this.passwords.hash(normalizeRecoveryCode(c))),
    );
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.adminUser.update({
        where: { id: admin.id },
        data: {
          totpSecretEnc: this.box.encrypt(secret, totpAad(admin.id)),
          totpEnabledAt: new Date(),
          recoveryCodeHashes: hashes,
          failedLoginCount: 0,
          lastLoginAt: new Date(),
          lastLoginIp: req.ip?.slice(0, 64) ?? null,
        },
      });
      await this.audit.record(
        {
          action: admin.totpEnabledAt ? 'admin.totp.rotate' : 'admin.totp.enable',
          resourceType: 'AdminUser',
          resourceId: admin.id,
          before: { totpEnabledAt: admin.totpEnabledAt },
          after: { totpEnabledAt: row.totpEnabledAt, ip: req.ip ?? null },
        },
        tx,
      );
      return row;
    });
    await this.redis.del(REDIS_KEYS.totpSetup(admin.id));
    // New second factor: every older session (possibly verified with the old secret) goes away.
    await this.sessions.destroyAllForSubject('ADMIN', admin.id);
    const csrfToken = await this.issueSession(req, res, updated, true);
    return { recoveryCodes, admin: toAdminMe(updated), csrfToken };
  }

  /** Second factor for an enrolled admin: TOTP code or a one-time recovery code. */
  async verifyTotp(
    principal: AdminPrincipal,
    dto: AdminTotpVerifyInput,
    req: Request,
    res: Response,
  ): Promise<AdminSessionResponse> {
    const admin = await this.loadActive(principal.adminId);
    if (!admin.totpEnabledAt || !admin.totpSecretEnc) {
      throw AppException.badRequest(ErrorCode.AUTH_TOTP_NOT_ENROLLED);
    }
    if (this.isLocked(admin)) throw locked();
    let ok = false;
    if (dto.code !== undefined) {
      ok = await this.checkTotp(
        admin.id,
        this.box.decrypt(admin.totpSecretEnc, totpAad(admin.id)),
        dto.code,
      );
    } else if (dto.recoveryCode !== undefined) {
      ok = await this.consumeRecoveryCode(admin, dto.recoveryCode);
    }
    if (!ok) {
      this.logger.warn({ adminId: admin.id, ip: req.ip }, 'admin TOTP verification failed');
      // The caller already proved the password, so saying "locked" here leaks nothing.
      if (await this.registerFailure(admin.id, req)) throw locked();
      throw totpInvalid();
    }
    const updated = await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        failedLoginCount: 0,
        lastLoginAt: new Date(),
        lastLoginIp: req.ip?.slice(0, 64) ?? null,
      },
    });
    if (dto.recoveryCode !== undefined) {
      await this.audit.record({
        action: 'admin.recovery_code.use',
        resourceType: 'AdminUser',
        resourceId: admin.id,
        after: { recoveryCodesRemaining: updated.recoveryCodeHashes.length },
      });
    }
    const csrfToken = await this.issueSession(req, res, updated, true);
    this.logger.log({ adminId: admin.id, ip: req.ip }, 'admin logged in');
    return { admin: toAdminMe(updated), csrfToken };
  }

  async me(principal: AdminPrincipal): Promise<AdminMeResponse> {
    return toAdminMe(await this.loadActive(principal.adminId));
  }

  async logout(req: Request, res: Response): Promise<void> {
    const token = readSessionCookie(req, 'ADMIN');
    if (token) await this.sessions.destroy(token);
    this.sessions.clearCookies(res, 'ADMIN');
  }

  async changePassword(
    principal: AdminPrincipal,
    dto: { currentPassword: string; newPassword: string },
    req: Request,
    res: Response,
  ): Promise<AdminSessionResponse> {
    const admin = await this.loadActive(principal.adminId);
    if (!(await this.passwords.verify(admin.passwordHash, dto.currentPassword))) {
      if (await this.registerFailure(admin.id, req)) throw locked();
      throw invalidCredentials();
    }
    const passwordHash = await this.passwords.hash(dto.newPassword);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.adminUser.update({
        where: { id: admin.id },
        data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0 },
      });
      await this.audit.record(
        {
          action: 'admin.password.change',
          resourceType: 'AdminUser',
          resourceId: admin.id,
          before: { passwordChangedAt: admin.passwordChangedAt },
          after: { passwordChangedAt: row.passwordChangedAt },
        },
        tx,
      );
      return row;
    });
    await this.sessions.destroyAllForSubject('ADMIN', admin.id);
    const csrfToken = await this.issueSession(req, res, updated, true);
    return { admin: toAdminMe(updated), csrfToken };
  }

  private async issueSession(
    req: Request,
    res: Response,
    admin: AdminUser,
    mfaVerified: boolean,
  ): Promise<string> {
    const previous = readSessionCookie(req, 'ADMIN');
    if (previous) await this.sessions.destroy(previous);
    const ua = req.headers['user-agent'];
    const { token, record } = await this.sessions.create({
      kind: 'ADMIN',
      adminId: admin.id,
      role: admin.role,
      mfaVerified,
      ipAllowlist: admin.ipAllowlist,
      idleTtlSeconds: mfaVerified ? undefined : ADMIN_PRE_MFA_IDLE_TTL_SECONDS,
      ip: req.ip,
      userAgent: typeof ua === 'string' ? ua : undefined,
    });
    this.sessions.setCookies(res, 'ADMIN', token, record);
    return record.csrfToken;
  }

  private async loadActive(adminId: string): Promise<AdminUser> {
    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!admin || admin.status !== AdminStatus.ACTIVE) {
      await this.sessions.destroyAllForSubject('ADMIN', adminId);
      throw AppException.unauthenticated();
    }
    return admin;
  }

  private isLocked(admin: AdminUser): boolean {
    return admin.lockedUntil !== null && admin.lockedUntil.getTime() > Date.now();
  }

  /** TOTP check with replay protection: each time-step is accepted once per admin. */
  private async checkTotp(adminId: string, secret: string, code: string): Promise<boolean> {
    const step = this.totp.verify(secret, code);
    if (step === null) return false;
    const fresh = await this.redis.set(
      REDIS_KEYS.totpUsedStep(
        adminId,
        createHash('sha256').update(secret).digest('hex').slice(0, 16),
        step,
      ),
      '1',
      'EX',
      180,
      'NX',
    );
    return fresh === 'OK';
  }

  /** Recovery codes are single use; concurrent use of one code succeeds at most once. */
  private async consumeRecoveryCode(admin: AdminUser, code: string): Promise<boolean> {
    const normalized = normalizeRecoveryCode(code);
    for (const h of admin.recoveryCodeHashes) {
      if (!(await this.passwords.verify(h, normalized))) continue;
      // Atomic removal: concurrent uses of different codes can't resurrect each other.
      const count = await this.prisma.$executeRaw`
        UPDATE admin_users
           SET recovery_code_hashes = array_remove(recovery_code_hashes, ${h}),
               updated_at = now()
         WHERE id = ${admin.id}::uuid AND ${h} = ANY(recovery_code_hashes)`;
      return count === 1;
    }
    return false;
  }

  /** Rotation re-auth: current password + a current TOTP code or a recovery code. */
  private async reauthenticate(
    admin: AdminUser,
    dto: AdminTotpSetupInput,
    req: Request,
  ): Promise<void> {
    if (dto.currentPassword === undefined || (dto.code ?? dto.recoveryCode) === undefined) {
      throw AppException.forbidden(ErrorCode.AUTH_REAUTH_REQUIRED);
    }
    if (this.isLocked(admin)) throw locked();
    const passwordOk = await this.passwords.verify(admin.passwordHash, dto.currentPassword);
    let factorOk = false;
    // Never consume a recovery code (or burn a TOTP step) behind a wrong password.
    if (passwordOk && admin.totpSecretEnc) {
      factorOk =
        dto.code !== undefined
          ? await this.checkTotp(
              admin.id,
              this.box.decrypt(admin.totpSecretEnc, totpAad(admin.id)),
              dto.code,
            )
          : await this.consumeRecoveryCode(admin, dto.recoveryCode ?? '');
    }
    if (passwordOk && factorOk) return;
    this.logger.warn({ adminId: admin.id, ip: req.ip }, 'admin TOTP rotation: re-auth failed');
    if (await this.registerFailure(admin.id, req)) throw locked();
    throw passwordOk ? totpInvalid() : invalidCredentials();
  }

  /** The pending enrollment secret, only for the session that started it. */
  private async pendingSetupSecret(adminId: string, sessionId: string): Promise<string | null> {
    const pending = await this.redis.get(REDIS_KEYS.totpSetup(adminId));
    if (!pending) return null;
    try {
      return this.box.decrypt(pending, setupAad(adminId, sessionId));
    } catch {
      return null;
    }
  }

  /**
   * Counts a failed password / second-factor attempt. Returns true when this attempt locked the
   * account (sessions are destroyed and the lock is audited).
   */
  private async registerFailure(adminId: string, req: Request): Promise<boolean> {
    const row = await this.prisma.adminUser.update({
      where: { id: adminId },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });
    if (row.failedLoginCount < ADMIN_MAX_FAILED_ATTEMPTS) return false;
    const lockedUntil = new Date(Date.now() + ADMIN_LOCK_MINUTES * 60_000);
    await this.prisma.$transaction(async (tx) => {
      await tx.adminUser.update({
        where: { id: adminId },
        data: { failedLoginCount: 0, lockedUntil },
      });
      await this.audit.record(
        {
          action: 'admin.account.lock',
          resourceType: 'AdminUser',
          resourceId: adminId,
          after: { lockedUntil, failedAttempts: row.failedLoginCount, ip: req.ip ?? null },
          actorType: AuditActorType.SYSTEM,
        },
        tx,
      );
    });
    await this.sessions.destroyAllForSubject('ADMIN', adminId);
    this.logger.warn({ adminId, ip: req.ip }, 'admin account locked after repeated failures');
    return true;
  }
}

function totpAad(adminId: string): string {
  return `totp:${adminId}`;
}

function setupAad(adminId: string, sessionId: string): string {
  return `totp-setup:${adminId}:${sessionId}`;
}
