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
import { Injectable } from '@nestjs/common';
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

/**
 * Back-office account management (SUPER_ADMIN only). Accounts are never deleted — they are
 * DISABLED so audit history keeps its actor. Any change to role / status / IP allowlist and every
 * credential reset ends the account's sessions.
 */
@Injectable()
export class AdminAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
  ) {}

  async list(q: AdminAccountListQuery): Promise<Paginated<AdminAccountView>> {
    const where: Prisma.AdminUserWhereInput = {
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
    const row = await db.adminUser.findUnique({ where: { id } });
    if (!row) throw AppException.notFound(ErrorCode.ADMIN_ACCOUNT_NOT_FOUND);
    return row;
  }
}
