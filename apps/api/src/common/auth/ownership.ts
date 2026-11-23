import { ErrorCode } from '@house/shared';
import { AppException } from '../errors/app.exception';
import type { UserPrincipal } from './principal';

/**
 * Ownership checks. Respond 404 (not 403) when the caller doesn't own the resource,
 * so ids of other users' resources can't be probed.
 */
export function assertOwnedBy(
  principal: UserPrincipal,
  ownerUserId: string | null | undefined,
  notFoundCode: ErrorCode = ErrorCode.NOT_FOUND,
): void {
  if (!ownerUserId || ownerUserId !== principal.userId) throw AppException.notFound(notFoundCode);
}

/** The principal acts for `agencyId` (its session agency). Membership status is checked by AgenciesService. */
export function assertActsForAgency(
  principal: UserPrincipal,
  agencyId: string | null | undefined,
  notFoundCode: ErrorCode = ErrorCode.NOT_FOUND,
): void {
  if (!agencyId || principal.agencyId !== agencyId) throw AppException.notFound(notFoundCode);
}
