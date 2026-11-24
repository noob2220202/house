import type { PrismaTx } from '../../../prisma/prisma.service';
/**
 * Transaction-scoped advisory lock serializing agency membership changes of one user (register,
 * join, leave), so "one live agency per user" holds under concurrent requests.
 */
export declare function lockUserMembership(tx: PrismaTx, userId: string): Promise<void>;
/** Serializes status decisions / owner edits of one agency. */
export declare function lockAgency(tx: PrismaTx, agencyId: string): Promise<void>;
/**
 * Serializes approvals of agencies sharing one 등록번호 key, so two pending applications for the
 * same number cannot both go live. Taken after lockAgency; never wait on an agency lock while
 * holding it.
 */
export declare function lockRegistrationKey(tx: PrismaTx, registrationKey: string): Promise<void>;
