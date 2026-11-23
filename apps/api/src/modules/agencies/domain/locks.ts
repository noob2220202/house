import type { PrismaTx } from '../../../prisma/prisma.service';

/**
 * Transaction-scoped advisory lock serializing agency membership changes of one user (register,
 * join, leave), so "one live agency per user" holds under concurrent requests.
 */
export async function lockUserMembership(tx: PrismaTx, userId: string): Promise<void> {
  const key = `agency-membership:${userId}`;
  await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${key}))`;
}

/** Serializes status decisions / owner edits of one agency. */
export async function lockAgency(tx: PrismaTx, agencyId: string): Promise<void> {
  const key = `agency:${agencyId}`;
  await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${key}))`;
}
