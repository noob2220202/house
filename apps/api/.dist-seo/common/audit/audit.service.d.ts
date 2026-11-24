import { AuditActorType } from '@house/shared';
import { Prisma } from '@prisma/client';
import { PrismaService, type PrismaTx } from '../../prisma/prisma.service';
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
export declare function sanitizeForAudit(value: unknown, depth?: number): Prisma.InputJsonValue | null;
export declare class AuditService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    /** Writes an audit row. Pass `tx` to make it part of the mutation's transaction. */
    record(input: AuditRecordInput, tx?: PrismaTx): Promise<void>;
    /** Fire-and-forget variant for non-transactional paths; failures are logged, never thrown. */
    recordSafe(input: AuditRecordInput): void;
}
