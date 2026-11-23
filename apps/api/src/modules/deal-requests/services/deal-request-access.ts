import {
  AgencyInboxScope,
  DealRequestStatus,
  DealRequestVisibility,
  UserStatus,
  type AgencyDealRequestListQuery,
} from '@house/shared';
import type { Prisma } from '@prisma/client';

export interface AgencyScope {
  agencyId: string;
  sggCode: string;
}

/**
 * Requests an agency may see:
 *  - any request it already proposed to (so it can follow up), unless the requester withdrew, and
 *  - OPEN, unexpired requests of active members that are either region-wide in its 시군구 or
 *    explicitly target it.
 * Deleted requests are never visible.
 */
export function agencyVisibleWhere(scope: AgencyScope, now: Date): Prisma.DealRequestWhereInput {
  return {
    deletedAt: null,
    OR: [
      {
        proposals: { some: { agencyId: scope.agencyId } },
        user: { status: { not: UserStatus.WITHDRAWN } },
      },
      {
        status: DealRequestStatus.OPEN,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        user: { status: UserStatus.ACTIVE },
        AND: [
          {
            OR: [
              {
                visibility: DealRequestVisibility.ALL_AGENCIES_IN_REGION,
                sggCode: scope.sggCode,
              },
              {
                visibility: DealRequestVisibility.SELECTED_AGENCIES,
                targets: { some: { agencyId: scope.agencyId } },
              },
            ],
          },
        ],
      },
    ],
  };
}

/** Inbox filters on top of the visibility rule. */
export function agencyInboxWhere(
  scope: AgencyScope,
  q: Pick<AgencyDealRequestListQuery, 'scope' | 'type' | 'assetType' | 'dealType'>,
  now: Date,
): Prisma.DealRequestWhereInput {
  const and: Prisma.DealRequestWhereInput[] = [agencyVisibleWhere(scope, now)];
  switch (q.scope) {
    case AgencyInboxScope.TARGETED:
      and.push({ targets: { some: { agencyId: scope.agencyId } } });
      break;
    case AgencyInboxScope.PROPOSED:
      and.push({ proposals: { some: { agencyId: scope.agencyId } } });
      break;
    case AgencyInboxScope.NEW:
      and.push({
        status: DealRequestStatus.OPEN,
        proposals: { none: { agencyId: scope.agencyId } },
      });
      break;
    case AgencyInboxScope.ALL:
      break;
  }
  if (q.type) and.push({ type: q.type });
  if (q.assetType?.length) and.push({ assetType: { in: q.assetType } });
  if (q.dealType?.length) and.push({ dealTypes: { hasSome: q.dealType } });
  return { AND: and };
}
