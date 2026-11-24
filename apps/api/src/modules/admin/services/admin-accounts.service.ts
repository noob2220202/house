import {
  type AdminAccountCreateInput,
  type AdminAccountListQuery,
  type AdminAccountUpdateInput,
  type AdminAccountView,
  type AdminPasswordResetInput,
  AdminRole,
  AdminStatus,
  ErrorCode,
  type Paginated,
} from '@house/shared';
import { randomBytes } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, type AdminUser } from '@prisma/client';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { RequestContext } from '../../../common/context/request-context';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { PasswordService, SessionService } from '../../auth';
import { toAdminAccountView } from '../admin.mapper';

/** Serializes changes that could leave the site without an active SUPER_ADMIN. */
const SUPER_ADMIN_LOCK = 'admin:super-admin-invariant';

/** Tombstoned e-mail of a soft-deleted account (frees the address for a new account). */
export const deletedAdminEmail = (id: string): string => `deleted+${id}@deleted.invalid`;

/**
 * Back-office account management (SUPER_ADMIN only). Accounts are never hard-deleted: DELETE is a
 * soft delete (DISABLED, e-mail released, credentials cleared, `admin_account_deletions` row) so
 * audit history keeps its actor; deleted accounts are hidden from every route here (404).
 * Any change to role / status / IP allowlist and every credential reset ends the account's
 * sessions.
 */
@Injectable()
export class AdminAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
  ) {}

  async list(q: AdminAccountListQuery): Promise<Paginated<AdminAccountView>> {
    const deleted = await this.deletedIds();
    const where: Prisma.AdminUserWhereInput = {
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
    const page = await paginate(
      q,
      (args) =>
        this.prisma.adminUser.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...args,
        }),
      () => this.prisma.adminUser.count({ where }),
    );
    const now = new Date();
    return { ...page, items: page.items.map((a) => toAdminAccountView(a, now)) };
  }

  async detail(id: string): Promise<AdminAccountView> {
    return toAdminAccountView(await this.load(id));
  }

  async create(dto: AdminAccountCreateInput): Promise<AdminAccountView> {
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
      return toAdminAccountView(created);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw AppException.conflict(ErrorCode.ADMIN_ACCOUNT_DUPLICATE);
      }
      throw err;
    }
  }

  async update(
    actor: AdminPrincipal,
    id: string,
    dto: AdminAccountUpdateInput,
  ): Promise<AdminAccountView> {
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${SUPER_ADMIN_LOCK}))`;
      const current = await this.load(id, tx);
      const roleChanges = dto.role !== undefined && dto.role !== current.role;
      const statusChanges = dto.status !== undefined && dto.status !== current.status;
      if (id === actor.adminId && (roleChanges || statusChanges)) {
        throw AppException.forbidden(ErrorCode.ADMIN_SELF_MODIFICATION);
      }
      await this.assertKeepsSuperAdmin(tx, current, {
        role: dto.role ?? current.role,
        status: dto.status ?? current.status,
      });
      RequestContext.setAuditBefore(toAdminAccountView(current));
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
    return toAdminAccountView(updated);
  }

  async resetPassword(
    actor: AdminPrincipal,
    id: string,
    dto: AdminPasswordResetInput,
  ): Promise<AdminAccountView> {
    this.assertNotSelf(actor, id);
    const current = await this.load(id);
    RequestContext.setAuditBefore(toAdminAccountView(current));
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
    return toAdminAccountView(updated);
  }

  /** Clears TOTP + recovery codes; the admin enrolls again at the next login. */
  async resetTotp(actor: AdminPrincipal, id: string): Promise<AdminAccountView> {
    this.assertNotSelf(actor, id);
    const current = await this.load(id);
    RequestContext.setAuditBefore(toAdminAccountView(current));
    const updated = await this.prisma.adminUser.update({
      where: { id },
      data: { totpSecretEnc: null, totpEnabledAt: null, recoveryCodeHashes: [] },
    });
    await this.sessions.destroyAllForSubject('ADMIN', id);
    return toAdminAccountView(updated);
  }

  async unlock(id: string): Promise<AdminAccountView> {
    const current = await this.load(id);
    RequestContext.setAuditBefore(toAdminAccountView(current));
    const updated = await this.prisma.adminUser.update({
      where: { id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
    return toAdminAccountView(updated);
  }

  /**
   * Soft delete (SUPER_ADMIN): not oneself, not the last active SUPER_ADMIN. The row stays for the
   * audit trail but is DISABLED, its e-mail tombstoned, password / TOTP / recovery codes cleared,
   * and all its sessions end.
   */
  async remove(actor: AdminPrincipal, id: string): Promise<void> {
    if (actor.adminId === id) {
      throw new AppException(ErrorCode.ADMIN_SELF_MODIFICATION, {
        status: HttpStatus.FORBIDDEN,
        message: '본인 계정은 삭제할 수 없습니다.',
      });
    }
    // Unusable random password (hashed before taking the lock: argon2 is slow on purpose).
    const passwordHash = await this.passwords.hash(randomBytes(32).toString('base64url'));
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${SUPER_ADMIN_LOCK}))`;
      const current = await this.load(id, tx);
      await this.assertKeepsSuperAdmin(tx, current, {
        role: current.role,
        status: AdminStatus.DISABLED,
      });
      RequestContext.setAuditBefore(toAdminAccountView(current));
      await tx.adminAccountDeletion.create({
        data: { adminUserId: id, originalEmail: current.email, deletedByAdminId: actor.adminId },
      });
      await tx.adminUser.update({
        where: { id },
        data: {
          status: AdminStatus.DISABLED,
          email: deletedAdminEmail(id),
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

  private async deletedIds(db: PrismaTx = this.prisma): Promise<string[]> {
    const rows = await db.adminAccountDeletion.findMany({ select: { adminUserId: true } });
    return rows.map((r) => r.adminUserId);
  }

  private assertNotSelf(actor: AdminPrincipal, id: string): void {
    // Own credentials go through /admin/auth/password and the TOTP flow (they need the old factor).
    if (actor.adminId === id) throw AppException.forbidden(ErrorCode.ADMIN_SELF_MODIFICATION);
  }

  private async assertKeepsSuperAdmin(
    tx: PrismaTx,
    current: AdminUser,
    next: { role: AdminRole; status: AdminStatus },
  ): Promise<void> {
    const wasActiveSuper =
      current.role === AdminRole.SUPER_ADMIN && current.status === AdminStatus.ACTIVE;
    const staysActiveSuper =
      next.role === AdminRole.SUPER_ADMIN && next.status === AdminStatus.ACTIVE;
    if (!wasActiveSuper || staysActiveSuper) return;
    const others = await tx.adminUser.count({
      where: { id: { not: current.id }, role: AdminRole.SUPER_ADMIN, status: AdminStatus.ACTIVE },
    });
    if (others === 0) throw AppException.conflict(ErrorCode.ADMIN_LAST_SUPER_ADMIN);
  }

  private async load(id: string, db: PrismaTx = this.prisma): Promise<AdminUser> {
    const [row, deleted] = await Promise.all([
      db.adminUser.findUnique({ where: { id } }),
      db.adminAccountDeletion.findUnique({
        where: { adminUserId: id },
        select: { adminUserId: true },
      }),
    ]);
    if (!row || deleted) throw AppException.notFound(ErrorCode.ADMIN_ACCOUNT_NOT_FOUND);
    return row;
  }
}
