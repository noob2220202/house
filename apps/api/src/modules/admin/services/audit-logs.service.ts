import { type AuditLogQuery, type AuditLogView, ErrorCode, type Paginated } from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { PrismaService } from '../../../prisma/prisma.service';
import { auditLogSelect, toAuditLogView } from '../admin.mapper';

/** Read side of the append-only audit log (written by AuditService / the audit interceptors). */
@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: AuditLogQuery): Promise<Paginated<AuditLogView>> {
    const where: Prisma.AuditLogWhereInput = {
      ...(q.action
        ? q.action.endsWith('.')
          ? { action: { startsWith: q.action } }
          : { action: q.action }
        : {}),
      ...(q.actorType ? { actorType: q.actorType } : {}),
      ...(q.resourceType ? { resourceType: q.resourceType } : {}),
      ...(q.resourceId ? { resourceId: q.resourceId } : {}),
      ...(q.adminUserId ? { adminUserId: q.adminUserId } : {}),
      ...(q.from || q.to
        ? {
            createdAt: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lt: new Date(q.to) } : {}),
            },
          }
        : {}),
    };
    const page = await paginate(
      q,
      (args) =>
        this.prisma.auditLog.findMany({
          where,
          select: auditLogSelect,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...args,
        }),
      () => this.prisma.auditLog.count({ where }),
    );
    return { ...page, items: page.items.map(toAuditLogView) };
  }

  async detail(id: string): Promise<AuditLogView> {
    const row = await this.prisma.auditLog.findUnique({ where: { id }, select: auditLogSelect });
    if (!row) throw AppException.notFound(ErrorCode.AUDIT_LOG_NOT_FOUND);
    return toAuditLogView(row);
  }
}
