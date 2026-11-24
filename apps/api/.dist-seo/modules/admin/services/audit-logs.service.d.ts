import { type AuditLogQuery, type AuditLogView, type Paginated } from '@house/shared';
import { PrismaService } from '../../../prisma/prisma.service';
/** Read side of the append-only audit log (written by AuditService / the audit interceptors). */
export declare class AuditLogsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(q: AuditLogQuery): Promise<Paginated<AuditLogView>>;
    detail(id: string): Promise<AuditLogView>;
}
