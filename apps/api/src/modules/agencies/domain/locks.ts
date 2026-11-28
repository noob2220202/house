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

/**
 * Serializes approvals of agencies sharing one 등록번호 key, so two pending applications for the
 * same number cannot both go live. Taken after lockAgency; never wait on an agency lock while
 * holding it.
 */
export async function lockRegistrationKey(tx: PrismaTx, registrationKey: string): Promise<void> {
  const key = `agency-registration:${registrationKey}`;
  await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${key}))`;
}

/**
 * Serializes claims of one 사무소 홈페이지 slug (owner requests, admin approvals) across agencies,
 * so the "taken" check and the write cannot interleave. Taken after lockAgency.
 */
export async function lockSiteSlug(tx: PrismaTx, slug: string): Promise<void> {
  const key = `agency-site-slug:${slug}`;
  await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${key}))`;
}
