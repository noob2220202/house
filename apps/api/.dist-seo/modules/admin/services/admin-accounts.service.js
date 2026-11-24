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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminAccountsService = exports.deletedAdminEmail = void 0;
const shared_1 = require("@house/shared");
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const request_context_1 = require("../../../common/context/request-context");
const app_exception_1 = require("../../../common/errors/app.exception");
const pagination_1 = require("../../../common/pagination/pagination");
const prisma_service_1 = require("../../../prisma/prisma.service");
const auth_1 = require("../../auth");
const admin_mapper_1 = require("../admin.mapper");
/** Serializes changes that could leave the site without an active SUPER_ADMIN. */
const SUPER_ADMIN_LOCK = 'admin:super-admin-invariant';
/** Tombstoned e-mail of a soft-deleted account (frees the address for a new account). */
const deletedAdminEmail = (id) => `deleted+${id}@deleted.invalid`;
exports.deletedAdminEmail = deletedAdminEmail;
/**
 * Back-office account management (SUPER_ADMIN only). Accounts are never hard-deleted: DELETE is a
 * soft delete (DISABLED, e-mail released, credentials cleared, `admin_account_deletions` row) so
 * audit history keeps its actor; deleted accounts are hidden from every route here (404).
 * Any change to role / status / IP allowlist and every credential reset ends the account's
 * sessions.
 */
let AdminAccountsService = class AdminAccountsService {
    constructor(prisma, passwords, sessions) {
        this.prisma = prisma;
        this.passwords = passwords;
        this.sessions = sessions;
    }
    async list(q) {
        const deleted = await this.deletedIds();
        const where = {
            ...(deleted.length ? { id: { notIn: deleted } } : {}),
            ...(q.role ? { role: q.role } : {}),
            ...(q.status ? { status: q.status } : {}),
            ...(q.q
                ? {
                    OR: [
                        { email: { contains: q.q, mode: 'insensitive' } },
                        { name: { contains: q.q, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };
        const page = await (0, pagination_1.paginate)(q, (args) => this.prisma.adminUser.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            ...args,
        }), () => this.prisma.adminUser.count({ where }));
        const now = new Date();
        return { ...page, items: page.items.map((a) => (0, admin_mapper_1.toAdminAccountView)(a, now)) };
    }
    async detail(id) {
        return (0, admin_mapper_1.toAdminAccountView)(await this.load(id));
    }
    async create(dto) {
        const passwordHash = await this.passwords.hash(dto.password);
        try {
            const created = await this.prisma.adminUser.create({
                data: {
                    email: dto.email,
                    name: dto.name,
                    role: dto.role,
                    passwordHash,
                    passwordChangedAt: new Date(),
                    ipAllowlist: dto.ipAllowlist,
                },
            });
            return (0, admin_mapper_1.toAdminAccountView)(created);
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw app_exception_1.AppException.conflict(shared_1.ErrorCode.ADMIN_ACCOUNT_DUPLICATE);
            }
            throw err;
        }
    }
    async update(actor, id, dto) {
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${SUPER_ADMIN_LOCK}))`;
            const current = await this.load(id, tx);
            const roleChanges = dto.role !== undefined && dto.role !== current.role;
            const statusChanges = dto.status !== undefined && dto.status !== current.status;
            if (id === actor.adminId && (roleChanges || statusChanges)) {
                throw app_exception_1.AppException.forbidden(shared_1.ErrorCode.ADMIN_SELF_MODIFICATION);
            }
            await this.assertKeepsSuperAdmin(tx, current, {
                role: dto.role ?? current.role,
                status: dto.status ?? current.status,
            });
            request_context_1.RequestContext.setAuditBefore((0, admin_mapper_1.toAdminAccountView)(current));
            return tx.adminUser.update({
                where: { id },
                data: {
                    ...(dto.name !== undefined ? { name: dto.name } : {}),
                    ...(dto.role !== undefined ? { role: dto.role } : {}),
                    ...(dto.status !== undefined ? { status: dto.status } : {}),
                    ...(dto.ipAllowlist !== undefined ? { ipAllowlist: dto.ipAllowlist } : {}),
                },
            });
        });
        if (dto.role !== undefined || dto.status !== undefined || dto.ipAllowlist !== undefined) {
            await this.sessions.destroyAllForSubject('ADMIN', id);
        }
        return (0, admin_mapper_1.toAdminAccountView)(updated);
    }
    async resetPassword(actor, id, dto) {
        this.assertNotSelf(actor, id);
        const current = await this.load(id);
        request_context_1.RequestContext.setAuditBefore((0, admin_mapper_1.toAdminAccountView)(current));
        const updated = await this.prisma.adminUser.update({
            where: { id },
            data: {
                passwordHash: await this.passwords.hash(dto.password),
                passwordChangedAt: new Date(),
                failedLoginCount: 0,
                lockedUntil: null,
            },
        });
        await this.sessions.destroyAllForSubject('ADMIN', id);
        return (0, admin_mapper_1.toAdminAccountView)(updated);
    }
    /** Clears TOTP + recovery codes; the admin enrolls again at the next login. */
    async resetTotp(actor, id) {
        this.assertNotSelf(actor, id);
        const current = await this.load(id);
        request_context_1.RequestContext.setAuditBefore((0, admin_mapper_1.toAdminAccountView)(current));
        const updated = await this.prisma.adminUser.update({
            where: { id },
            data: { totpSecretEnc: null, totpEnabledAt: null, recoveryCodeHashes: [] },
        });
        await this.sessions.destroyAllForSubject('ADMIN', id);
        return (0, admin_mapper_1.toAdminAccountView)(updated);
    }
    async unlock(id) {
        const current = await this.load(id);
        request_context_1.RequestContext.setAuditBefore((0, admin_mapper_1.toAdminAccountView)(current));
        const updated = await this.prisma.adminUser.update({
            where: { id },
            data: { failedLoginCount: 0, lockedUntil: null },
        });
        return (0, admin_mapper_1.toAdminAccountView)(updated);
    }
    /**
     * Soft delete (SUPER_ADMIN): not oneself, not the last active SUPER_ADMIN. The row stays for the
     * audit trail but is DISABLED, its e-mail tombstoned, password / TOTP / recovery codes cleared,
     * and all its sessions end.
     */
    async remove(actor, id) {
        if (actor.adminId === id) {
            throw new app_exception_1.AppException(shared_1.ErrorCode.ADMIN_SELF_MODIFICATION, {
                status: common_1.HttpStatus.FORBIDDEN,
                message: '본인 계정은 삭제할 수 없습니다.',
            });
        }
        // Unusable random password (hashed before taking the lock: argon2 is slow on purpose).
        const passwordHash = await this.passwords.hash((0, node_crypto_1.randomBytes)(32).toString('base64url'));
        await this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${SUPER_ADMIN_LOCK}))`;
            const current = await this.load(id, tx);
            await this.assertKeepsSuperAdmin(tx, current, {
                role: current.role,
                status: shared_1.AdminStatus.DISABLED,
            });
            request_context_1.RequestContext.setAuditBefore((0, admin_mapper_1.toAdminAccountView)(current));
            await tx.adminAccountDeletion.create({
                data: { adminUserId: id, originalEmail: current.email, deletedByAdminId: actor.adminId },
            });
            await tx.adminUser.update({
                where: { id },
                data: {
                    status: shared_1.AdminStatus.DISABLED,
                    email: (0, exports.deletedAdminEmail)(id),
                    passwordHash,
                    totpSecretEnc: null,
                    totpEnabledAt: null,
                    recoveryCodeHashes: [],
                    ipAllowlist: [],
                    failedLoginCount: 0,
                    lockedUntil: null,
                },
            });
        });
        await this.sessions.destroyAllForSubject('ADMIN', id);
    }
    async deletedIds(db = this.prisma) {
        const rows = await db.adminAccountDeletion.findMany({ select: { adminUserId: true } });
        return rows.map((r) => r.adminUserId);
    }
    assertNotSelf(actor, id) {
        // Own credentials go through /admin/auth/password and the TOTP flow (they need the old factor).
        if (actor.adminId === id)
            throw app_exception_1.AppException.forbidden(shared_1.ErrorCode.ADMIN_SELF_MODIFICATION);
    }
    async assertKeepsSuperAdmin(tx, current, next) {
        const wasActiveSuper = current.role === shared_1.AdminRole.SUPER_ADMIN && current.status === shared_1.AdminStatus.ACTIVE;
        const staysActiveSuper = next.role === shared_1.AdminRole.SUPER_ADMIN && next.status === shared_1.AdminStatus.ACTIVE;
        if (!wasActiveSuper || staysActiveSuper)
            return;
        const others = await tx.adminUser.count({
            where: { id: { not: current.id }, role: shared_1.AdminRole.SUPER_ADMIN, status: shared_1.AdminStatus.ACTIVE },
        });
        if (others === 0)
            throw app_exception_1.AppException.conflict(shared_1.ErrorCode.ADMIN_LAST_SUPER_ADMIN);
    }
    async load(id, db = this.prisma) {
        const [row, deleted] = await Promise.all([
            db.adminUser.findUnique({ where: { id } }),
            db.adminAccountDeletion.findUnique({
                where: { adminUserId: id },
                select: { adminUserId: true },
            }),
        ]);
        if (!row || deleted)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.ADMIN_ACCOUNT_NOT_FOUND);
        return row;
    }
};
exports.AdminAccountsService = AdminAccountsService;
exports.AdminAccountsService = AdminAccountsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        auth_1.PasswordService,
        auth_1.SessionService])
], AdminAccountsService);
//# sourceMappingURL=admin-accounts.service.js.map