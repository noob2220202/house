import { Injectable, Logger } from '@nestjs/common';
import { AuditActorType } from '@house/shared';
import { Prisma } from '@prisma/client';
import { PrismaService, type PrismaTx } from '../../prisma/prisma.service';
import { isAdminPrincipal, isUserPrincipal } from '../auth/principal';
import { RequestContext } from '../context/request-context';

const REDACTED_KEYS = new Set([
  'passwordHash',
  'password',
  'totpSecretEnc',
  'recoveryCodeHashes',
  'contactPhone',
  'phone',
  'ho',
]);

export interface AuditRecordInput {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  /** Override actor (defaults to the request principal; SYSTEM for jobs). */
  actorType?: AuditActorType;
}

/** Strips secrets/PII and converts to JSON-safe values (Decimal/Date/BigInt). */
export function sanitizeForAudit(value: unknown, depth = 0): Prisma.InputJsonValue | null {
  if (value === null || value === undefined) return null;
  if (depth > 6) return '[depth]';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (Prisma.Decimal.isDecimal(value)) return value.toString();
  if (Array.isArray(value)) return value.slice(0, 200).map((v) => sanitizeForAudit(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACTED_KEYS.has(k)
        ? v == null
          ? null
          : '[redacted]'
        : sanitizeForAudit(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string') return value.length > 5000 ? `${value.slice(0, 5000)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Writes an audit row. Pass `tx` to make it part of the mutation's transaction. */
  async record(input: AuditRecordInput, tx?: PrismaTx): Promise<void> {
    const ctx = RequestContext.current();
    const principal = ctx?.principal;
    const actorType =
      input.actorType ??
      (isAdminPrincipal(principal)
        ? AuditActorType.ADMIN
        : principal
          ? AuditActorType.USER
          : AuditActorType.SYSTEM);
    const db = tx ?? this.prisma;
    await db.auditLog.create({
      data: {
        actorType,
        adminUserId: isAdminPrincipal(principal) ? principal.adminId : null,
        userId: isUserPrincipal(principal) ? principal.userId : null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        before: sanitizeForAudit(input.before) ?? Prisma.JsonNull,
        after: sanitizeForAudit(input.after) ?? Prisma.JsonNull,
        ip: ctx?.ip ?? null,
        userAgent: ctx?.userAgent ?? null,
        requestId: ctx?.requestId ?? null,
      },
    });
  }

  /** Fire-and-forget variant for non-transactional paths; failures are logged, never thrown. */
  recordSafe(input: AuditRecordInput): void {
    this.record(input).catch((err: unknown) =>
      this.logger.error({ err, action: input.action }, 'failed to write audit log'),
    );
  }
}
