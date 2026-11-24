"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AdminAuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminAuthService = void 0;
exports.toAdminMe = toAdminMe;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const common_2 = require("@nestjs/common");
const audit_service_1 = require("../../../common/audit/audit.service");
const app_exception_1 = require("../../../common/errors/app.exception");
const prisma_service_1 = require("../../../prisma/prisma.service");
const redis_constants_1 = require("../../../redis/redis.constants");
const auth_constants_1 = require("../auth.constants");
const session_service_1 = require("../session/session.service");
const ip_allowlist_1 = require("./ip-allowlist");
const password_service_1 = require("./password.service");
const secret_box_1 = require("./secret-box");
const totp_service_1 = require("./totp.service");
const invalidCredentials = () => new app_exception_1.AppException(shared_1.ErrorCode.AUTH_INVALID_CREDENTIALS, { status: common_2.HttpStatus.UNAUTHORIZED });
const totpInvalid = () => new app_exception_1.AppException(shared_1.ErrorCode.AUTH_TOTP_INVALID, { status: common_2.HttpStatus.UNAUTHORIZED });
const locked = () => new app_exception_1.AppException(shared_1.ErrorCode.AUTH_ACCOUNT_LOCKED, { status: common_2.HttpStatus.LOCKED });
function toAdminMe(a) {
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
let AdminAuthService = AdminAuthService_1 = class AdminAuthService {
    constructor(prisma, sessions, passwords, totp, box, audit, redis) {
        this.prisma = prisma;
        this.sessions = sessions;
        this.passwords = passwords;
        this.totp = totp;
        this.box = box;
        this.audit = audit;
        this.redis = redis;
        this.logger = new common_1.Logger(AdminAuthService_1.name);
    }
    /**
     * Password step. Every refusal (unknown email, disabled, outside the account's IP allowlist,
     * locked, wrong password) is the same 401 after the same argon2 work, so the endpoint reveals
     * neither which emails exist nor whether a password is right while the account or this client
     * is locked, or the caller is outside its allowlist. Only wrong passwords from an allowed network
     * count, and only toward this client's lock. No counter is reset here: only a completed second
     * factor resets them, so "right password, then a few wrong codes" cannot be repeated forever.
     */
    async login(dto, req, res) {
        const admin = await this.prisma.adminUser.findUnique({ where: { email: dto.email } });
        const refusal = !admin
            ? 'unknown email'
            : admin.status !== shared_1.AdminStatus.ACTIVE
                ? 'account not active'
                : !(0, ip_allowlist_1.ipAllowed)(admin.ipAllowlist, req.ip)
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
        const failKey = auth_constants_1.REDIS_KEYS.adminPasswordFailures(admin.id, (0, ip_allowlist_1.clientIpBucket)(req.ip));
        if (Number((await this.redis.get(failKey)) ?? 0) >= auth_constants_1.ADMIN_MAX_PASSWORD_FAILURES) {
            this.logger.warn({ adminId: admin.id, ip: req.ip }, 'admin login refused: client locked');
            throw invalidCredentials();
        }
        if (!ok) {
            await this.registerPasswordFailure(admin.id, failKey, req);
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
    async setupTotp(principal, dto, req) {
        const admin = await this.loadActive(principal.adminId);
        if (admin.totpEnabledAt) {
            if (!principal.mfaVerified)
                throw app_exception_1.AppException.unauthenticated(shared_1.ErrorCode.AUTH_TOTP_REQUIRED);
            await this.reauthenticate(admin, dto, req);
        }
        const secret = this.totp.generateSecret();
        await this.redis.set(auth_constants_1.REDIS_KEYS.totpSetup(admin.id), this.box.encrypt(secret, setupAad(admin.id, principal.sessionId)), 'EX', auth_constants_1.TOTP_SETUP_TTL_SECONDS);
        if (admin.totpEnabledAt) {
            this.logger.log({ adminId: admin.id, ip: req.ip }, 'admin TOTP rotation started');
        }
        return {
            secret,
            otpauthUrl: this.totp.keyUri(admin.email, secret),
            expiresInSeconds: auth_constants_1.TOTP_SETUP_TTL_SECONDS,
        };
    }
    /** Confirms enrollment with a first code; returns the one-time recovery codes (shown once). */
    async activateTotp(principal, code, req, res) {
        const admin = await this.loadActive(principal.adminId);
        if (this.isLocked(admin))
            throw locked();
        if (admin.totpEnabledAt && !principal.mfaVerified) {
            throw app_exception_1.AppException.unauthenticated(shared_1.ErrorCode.AUTH_TOTP_REQUIRED);
        }
        const secret = await this.pendingSetupSecret(admin.id, principal.sessionId);
        if (!secret)
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.AUTH_TOTP_SETUP_EXPIRED);
        if (!(await this.checkTotp(admin.id, secret, code))) {
            if (await this.registerFailure(admin.id, req))
                throw locked();
            throw totpInvalid();
        }
        const recoveryCodes = this.passwords.generateRecoveryCodes(auth_constants_1.RECOVERY_CODE_COUNT);
        const hashes = await Promise.all(recoveryCodes.map((c) => this.passwords.hash((0, password_service_1.normalizeRecoveryCode)(c))));
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
            await this.audit.record({
                action: admin.totpEnabledAt ? 'admin.totp.rotate' : 'admin.totp.enable',
                resourceType: 'AdminUser',
                resourceId: admin.id,
                before: { totpEnabledAt: admin.totpEnabledAt },
                after: { totpEnabledAt: row.totpEnabledAt, ip: req.ip ?? null },
            }, tx);
            return row;
        });
        await this.redis.del(auth_constants_1.REDIS_KEYS.totpSetup(admin.id), auth_constants_1.REDIS_KEYS.adminPasswordFailures(admin.id, (0, ip_allowlist_1.clientIpBucket)(req.ip)));
        // New second factor: every older session (possibly verified with the old secret) goes away.
        await this.sessions.destroyAllForSubject('ADMIN', admin.id);
        const csrfToken = await this.issueSession(req, res, updated, true);
        return { recoveryCodes, admin: toAdminMe(updated), csrfToken };
    }
    /** Second factor for an enrolled admin: TOTP code or a one-time recovery code. */
    async verifyTotp(principal, dto, req, res) {
        const admin = await this.loadActive(principal.adminId);
        if (!admin.totpEnabledAt || !admin.totpSecretEnc) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.AUTH_TOTP_NOT_ENROLLED);
        }
        if (this.isLocked(admin))
            throw locked();
        let ok = false;
        if (dto.code !== undefined) {
            ok = await this.checkTotp(admin.id, this.box.decrypt(admin.totpSecretEnc, totpAad(admin.id)), dto.code);
        }
        else if (dto.recoveryCode !== undefined) {
            ok = await this.consumeRecoveryCode(admin, dto.recoveryCode);
        }
        if (!ok) {
            this.logger.warn({ adminId: admin.id, ip: req.ip }, 'admin TOTP verification failed');
            // The caller already proved the password, so saying "locked" here leaks nothing.
            if (await this.registerFailure(admin.id, req))
                throw locked();
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
        await this.redis.del(auth_constants_1.REDIS_KEYS.adminPasswordFailures(admin.id, (0, ip_allowlist_1.clientIpBucket)(req.ip)));
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
    async me(principal) {
        return toAdminMe(await this.loadActive(principal.adminId));
    }
    async logout(req, res) {
        const token = (0, session_service_1.readSessionCookie)(req, 'ADMIN');
        if (token)
            await this.sessions.destroy(token);
        this.sessions.clearCookies(res, 'ADMIN');
    }
    async changePassword(principal, dto, req, res) {
        const admin = await this.loadActive(principal.adminId);
        if (!(await this.passwords.verify(admin.passwordHash, dto.currentPassword))) {
            if (await this.registerFailure(admin.id, req))
                throw locked();
            throw invalidCredentials();
        }
        const passwordHash = await this.passwords.hash(dto.newPassword);
        const updated = await this.prisma.$transaction(async (tx) => {
            const row = await tx.adminUser.update({
                where: { id: admin.id },
                data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0 },
            });
            await this.audit.record({
                action: 'admin.password.change',
                resourceType: 'AdminUser',
                resourceId: admin.id,
                before: { passwordChangedAt: admin.passwordChangedAt },
                after: { passwordChangedAt: row.passwordChangedAt },
            }, tx);
            return row;
        });
        await this.sessions.destroyAllForSubject('ADMIN', admin.id);
        const csrfToken = await this.issueSession(req, res, updated, true);
        return { admin: toAdminMe(updated), csrfToken };
    }
    async issueSession(req, res, admin, mfaVerified) {
        const previous = (0, session_service_1.readSessionCookie)(req, 'ADMIN');
        if (previous)
            await this.sessions.destroy(previous);
        const ua = req.headers['user-agent'];
        const { token, record } = await this.sessions.create({
            kind: 'ADMIN',
            adminId: admin.id,
            role: admin.role,
            mfaVerified,
            ipAllowlist: admin.ipAllowlist,
            idleTtlSeconds: mfaVerified ? undefined : auth_constants_1.ADMIN_PRE_MFA_IDLE_TTL_SECONDS,
            ip: req.ip,
            userAgent: typeof ua === 'string' ? ua : undefined,
        });
        this.sessions.setCookies(res, 'ADMIN', token, record);
        return record.csrfToken;
    }
    async loadActive(adminId) {
        const admin = await this.prisma.adminUser.findUnique({ where: { id: adminId } });
        if (!admin || admin.status !== shared_1.AdminStatus.ACTIVE) {
            await this.sessions.destroyAllForSubject('ADMIN', adminId);
            throw app_exception_1.AppException.unauthenticated();
        }
        return admin;
    }
    isLocked(admin) {
        return admin.lockedUntil !== null && admin.lockedUntil.getTime() > Date.now();
    }
    /** TOTP check with replay protection: each time-step is accepted once per admin. */
    async checkTotp(adminId, secret, code) {
        const step = this.totp.verify(secret, code);
        if (step === null)
            return false;
        const fresh = await this.redis.set(auth_constants_1.REDIS_KEYS.totpUsedStep(adminId, (0, node_crypto_1.createHash)('sha256').update(secret).digest('hex').slice(0, 16), step), '1', 'EX', 180, 'NX');
        return fresh === 'OK';
    }
    /** Recovery codes are single use; concurrent use of one code succeeds at most once. */
    async consumeRecoveryCode(admin, code) {
        const normalized = (0, password_service_1.normalizeRecoveryCode)(code);
        for (const h of admin.recoveryCodeHashes) {
            if (!(await this.passwords.verify(h, normalized)))
                continue;
            // Atomic removal: concurrent uses of different codes can't resurrect each other.
            const count = await this.prisma.$executeRaw `
        UPDATE admin_users
           SET recovery_code_hashes = array_remove(recovery_code_hashes, ${h}),
               updated_at = now()
         WHERE id = ${admin.id}::uuid AND ${h} = ANY(recovery_code_hashes)`;
            return count === 1;
        }
        return false;
    }
    /** Rotation re-auth: current password + a current TOTP code or a recovery code. */
    async reauthenticate(admin, dto, req) {
        if (dto.currentPassword === undefined || (dto.code ?? dto.recoveryCode) === undefined) {
            throw app_exception_1.AppException.forbidden(shared_1.ErrorCode.AUTH_REAUTH_REQUIRED);
        }
        if (this.isLocked(admin))
            throw locked();
        const passwordOk = await this.passwords.verify(admin.passwordHash, dto.currentPassword);
        let factorOk = false;
        // Never consume a recovery code (or burn a TOTP step) behind a wrong password.
        if (passwordOk && admin.totpSecretEnc) {
            factorOk =
                dto.code !== undefined
                    ? await this.checkTotp(admin.id, this.box.decrypt(admin.totpSecretEnc, totpAad(admin.id)), dto.code)
                    : await this.consumeRecoveryCode(admin, dto.recoveryCode ?? '');
        }
        if (passwordOk && factorOk)
            return;
        this.logger.warn({ adminId: admin.id, ip: req.ip }, 'admin TOTP rotation: re-auth failed');
        if (await this.registerFailure(admin.id, req))
            throw locked();
        throw passwordOk ? totpInvalid() : invalidCredentials();
    }
    /** The pending enrollment secret, only for the session that started it. */
    async pendingSetupSecret(adminId, sessionId) {
        const pending = await this.redis.get(auth_constants_1.REDIS_KEYS.totpSetup(adminId));
        if (!pending)
            return null;
        try {
            return this.box.decrypt(pending, setupAad(adminId, sessionId));
        }
        catch {
            return null;
        }
    }
    /**
     * Counts a wrong password at the login step for one (admin, client IP bucket). The counter lives
     * in a fixed window that starts at the first failure; the attempt that reaches the limit locks
     * the pair for ADMIN_CLIENT_LOCK_SECONDS (audited). Never touches the account or its sessions:
     * this step proves nothing about the caller, so it must not let them lock the admin out.
     */
    async registerPasswordFailure(adminId, key, req) {
        const results = await this.redis
            .multi()
            .incr(key)
            .expire(key, auth_constants_1.ADMIN_PASSWORD_FAILURE_WINDOW_SECONDS, 'NX')
            .exec();
        const [err, value] = results?.[0] ?? [new Error('redis transaction aborted'), null];
        if (err)
            throw err;
        if (Number(value) !== auth_constants_1.ADMIN_MAX_PASSWORD_FAILURES)
            return;
        await this.redis.expire(key, auth_constants_1.ADMIN_CLIENT_LOCK_SECONDS);
        await this.audit.record({
            action: 'admin.login.client_lock',
            resourceType: 'AdminUser',
            resourceId: adminId,
            after: {
                ip: req.ip ?? null,
                ipBucket: (0, ip_allowlist_1.clientIpBucket)(req.ip),
                failedAttempts: auth_constants_1.ADMIN_MAX_PASSWORD_FAILURES,
                lockedForSeconds: auth_constants_1.ADMIN_CLIENT_LOCK_SECONDS,
            },
            actorType: shared_1.AuditActorType.SYSTEM,
        });
        this.logger.warn({ adminId, ip: req.ip }, 'admin login locked for this client after failures');
    }
    /**
     * Counts a failed attempt by a caller who already knows the password (second factor, or the
     * password on re-auth from a verified session). Returns true when this attempt locked the
     * account (sessions are destroyed and the lock is audited).
     */
    async registerFailure(adminId, req) {
        const row = await this.prisma.adminUser.update({
            where: { id: adminId },
            data: { failedLoginCount: { increment: 1 } },
            select: { failedLoginCount: true },
        });
        if (row.failedLoginCount < auth_constants_1.ADMIN_MAX_FAILED_ATTEMPTS)
            return false;
        const lockedUntil = new Date(Date.now() + auth_constants_1.ADMIN_LOCK_MINUTES * 60_000);
        await this.prisma.$transaction(async (tx) => {
            await tx.adminUser.update({
                where: { id: adminId },
                data: { failedLoginCount: 0, lockedUntil },
            });
            await this.audit.record({
                action: 'admin.account.lock',
                resourceType: 'AdminUser',
                resourceId: adminId,
                after: { lockedUntil, failedAttempts: row.failedLoginCount, ip: req.ip ?? null },
                actorType: shared_1.AuditActorType.SYSTEM,
            }, tx);
        });
        await this.sessions.destroyAllForSubject('ADMIN', adminId);
        this.logger.warn({ adminId, ip: req.ip }, 'admin account locked after repeated failures');
        return true;
    }
};
exports.AdminAuthService = AdminAuthService;
exports.AdminAuthService = AdminAuthService = AdminAuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(6, (0, common_1.Inject)(redis_constants_1.REDIS)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        session_service_1.SessionService,
        password_service_1.PasswordService,
        totp_service_1.TotpService,
        secret_box_1.SecretBox,
        audit_service_1.AuditService, Function])
], AdminAuthService);
function totpAad(adminId) {
    return `totp:${adminId}`;
}
function setupAad(adminId, sessionId) {
    return `totp-setup:${adminId}:${sessionId}`;
}
//# sourceMappingURL=admin-auth.service.js.map