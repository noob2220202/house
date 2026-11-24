import { type AgencyDealRequestListQuery } from '@house/shared';
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
 * Deleted requests and requests an admin flagged as spam are never visible (not even to an agency
 * that already proposed), so they leave every inbox, scope (incl. TARGETED), detail and proposal path.
 */
export declare function agencyVisibleWhere(scope: AgencyScope, now: Date): Prisma.DealRequestWhereInput;
/** Inbox filters on top of the visibility rule. */
export declare function agencyInboxWhere(scope: AgencyScope, q: Pick<AgencyDealRequestListQuery, 'scope' | 'type' | 'assetType' | 'dealType'>, now: Date): Prisma.DealRequestWhereInput;
