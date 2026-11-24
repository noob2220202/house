import { ErrorCode } from '@house/shared';
import type { UserPrincipal } from './principal';
/**
 * Ownership checks. Respond 404 (not 403) when the caller doesn't own the resource,
 * so ids of other users' resources can't be probed.
 */
export declare function assertOwnedBy(principal: UserPrincipal, ownerUserId: string | null | undefined, notFoundCode?: ErrorCode): void;
/** The principal acts for `agencyId` (its session agency). Membership status is checked by AgenciesService. */
export declare function assertActsForAgency(principal: UserPrincipal, agencyId: string | null | undefined, notFoundCode?: ErrorCode): void;
