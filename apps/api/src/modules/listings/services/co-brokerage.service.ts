import {
  ErrorCode,
  ListingAgencyStatus,
  NotificationType,
  PUBLIC_LISTING_STATUSES,
  type AgencyListingDetail,
  type CoBrokerJoinInput,
  type CoBrokerRequestResult,
} from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { UserPrincipal } from '../../../common/auth/principal';
import { AppException } from '../../../common/errors/app.exception';
import { PrismaService } from '../../../prisma/prisma.service';
import { DISCLOSABLE_AGENCY_WHERE } from '../listing.selects';
import {
  LISTING_AGENCY_MEMBERSHIP,
  type AgencyMembershipPort,
} from '../ports/agency-membership.port';
import { LISTING_NOTIFIER, type ListingNotifierPort } from '../ports/listing-notifier.port';
import { AgencyListingsService } from './agency-listings.service';
import { ListingCountersService } from './listing-counters.service';

/**
 * 공동중개 needs both sides' consent: another agency *requests* to co-broker a publicly advertised
 * listing (PENDING, no rights, not public) and the primary agency accepts or rejects it. Co-brokers
 * may leave (WITHDRAWN, may request again); the primary may remove them (REMOVED: they cannot
 * request again, but the primary can still accept them back). The primary row never changes here.
 */
@Injectable()
export class CoBrokerageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listings: AgencyListingsService,
    private readonly counters: ListingCountersService,
    @Inject(LISTING_AGENCY_MEMBERSHIP) private readonly membership: AgencyMembershipPort,
    @Inject(LISTING_NOTIFIER) private readonly notifier: ListingNotifierPort,
  ) {}

  async join(
    principal: UserPrincipal,
    listingId: string,
    dto: CoBrokerJoinInput,
  ): Promise<CoBrokerRequestResult> {
    const actor = await this.membership.resolveActor(principal);
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, deletedAt: null },
      select: {
        id: true,
        status: true,
        primaryAgencyId: true,
        agencies: {
          where: { agencyId: actor.agencyId },
          select: { id: true, status: true },
        },
      },
    });
    const own = listing?.agencies[0];
    if (!listing || (!PUBLIC_LISTING_STATUSES.includes(listing.status) && !own)) {
      // Drafts and hidden listings are invisible to outsiders.
      throw AppException.notFound(ErrorCode.LISTING_NOT_FOUND);
    }
    if (own?.status === ListingAgencyStatus.ACTIVE) {
      throw AppException.conflict(ErrorCode.LISTING_CO_BROKER_DUPLICATE);
    }
    if (own?.status === ListingAgencyStatus.PENDING) {
      throw AppException.conflict(ErrorCode.LISTING_CO_BROKER_PENDING);
    }
    if (own?.status === ListingAgencyStatus.REMOVED) {
      throw AppException.forbidden(ErrorCode.LISTING_CO_BROKER_REMOVED);
    }
    if (!PUBLIC_LISTING_STATUSES.includes(listing.status)) {
      throw AppException.badRequest(ErrorCode.LISTING_CO_BROKER_NOT_ALLOWED);
    }
    const contact = await this.listings.resolveContact(actor, dto);
    const requestedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (own) {
        // WITHDRAWN → PENDING; the status guard keeps a concurrent removal from being undone.
        const { count } = await tx.listingAgency.updateMany({
          where: { id: own.id, status: ListingAgencyStatus.WITHDRAWN },
          data: {
            ...contact,
            status: ListingAgencyStatus.PENDING,
            joinedAt: requestedAt,
            withdrawnAt: null,
          },
        });
        if (count === 0) throw AppException.conflict(ErrorCode.LISTING_CONCURRENT_MODIFICATION);
      } else {
        await tx.listingAgency.create({
          data: {
            listingId,
            agencyId: actor.agencyId,
            isPrimary: false,
            status: ListingAgencyStatus.PENDING,
            joinedAt: requestedAt,
            ...contact,
          },
        });
      }
      await this.notifier.notifyAgencyOwners(tx, [listing.primaryAgencyId], {
        type: NotificationType.CO_BROKER_REQUESTED,
        title: '공동중개 참여 요청이 도착했습니다.',
        body: '다른 중개사무소가 매물의 공동중개 참여를 요청했습니다. 수락 또는 거절해 주세요.',
        listingId,
      });
    });
    return {
      listingId,
      agencyId: actor.agencyId,
      status: ListingAgencyStatus.PENDING,
      requestedAt: requestedAt.toISOString(),
    };
  }

  /** The primary accepts a request (PENDING) or takes back an agency it removed (REMOVED). */
  async accept(
    principal: UserPrincipal,
    listingId: string,
    agencyId: string,
  ): Promise<AgencyListingDetail> {
    const actor = await this.membership.resolveActor(principal);
    const listing = await this.listings.loadForActor(listingId, actor, { primaryOnly: true });
    if (!PUBLIC_LISTING_STATUSES.includes(listing.status)) {
      throw AppException.badRequest(ErrorCode.LISTING_CO_BROKER_NOT_ALLOWED);
    }
    const row = await this.prisma.listingAgency.findFirst({
      where: {
        listingId,
        agencyId,
        isPrimary: false,
        status: { in: [ListingAgencyStatus.PENDING, ListingAgencyStatus.REMOVED] },
        agency: DISCLOSABLE_AGENCY_WHERE,
      },
      select: { id: true, status: true },
    });
    if (!row) throw AppException.notFound(ErrorCode.LISTING_CO_BROKER_NOT_FOUND);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.listingAgency.updateMany({
        where: { id: row.id, status: row.status },
        data: { status: ListingAgencyStatus.ACTIVE, joinedAt: new Date(), withdrawnAt: null },
      });
      if (count === 0) throw AppException.conflict(ErrorCode.LISTING_CONCURRENT_MODIFICATION);
      await this.counters.refresh(tx, { agencyIds: [agencyId] });
    });
    await this.counters.invalidateSearch();
    return this.listings.detail(listingId, actor);
  }

  /** The primary rejects a pending request; the requester cannot ask again on its own. */
  async reject(principal: UserPrincipal, listingId: string, agencyId: string): Promise<void> {
    const actor = await this.membership.resolveActor(principal);
    await this.listings.loadForActor(listingId, actor, { primaryOnly: true });
    await this.end(listingId, agencyId, [ListingAgencyStatus.PENDING], ListingAgencyStatus.REMOVED);
  }

  /** The acting agency leaves a listing it co-brokers, or cancels its pending request. */
  async leave(principal: UserPrincipal, listingId: string): Promise<void> {
    const actor = await this.membership.resolveActor(principal);
    await this.end(
      listingId,
      actor.agencyId,
      [ListingAgencyStatus.ACTIVE, ListingAgencyStatus.PENDING],
      ListingAgencyStatus.WITHDRAWN,
    );
  }

  /** The primary agency removes a co-broker (or drops a pending request). */
  async removeAgency(principal: UserPrincipal, listingId: string, agencyId: string): Promise<void> {
    const actor = await this.membership.resolveActor(principal);
    await this.listings.loadForActor(listingId, actor, { primaryOnly: true });
    await this.end(
      listingId,
      agencyId,
      [ListingAgencyStatus.ACTIVE, ListingAgencyStatus.PENDING],
      ListingAgencyStatus.REMOVED,
    );
  }

  private async end(
    listingId: string,
    agencyId: string,
    from: ListingAgencyStatus[],
    to: ListingAgencyStatus,
  ): Promise<void> {
    const row = await this.prisma.listingAgency.findFirst({
      where: { listingId, agencyId, status: { in: from }, listing: { deletedAt: null } },
      select: { id: true, isPrimary: true, status: true },
    });
    if (!row) throw AppException.notFound(ErrorCode.LISTING_CO_BROKER_NOT_FOUND);
    if (row.isPrimary) throw AppException.badRequest(ErrorCode.LISTING_PRIMARY_CANNOT_LEAVE);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.listingAgency.updateMany({
        where: { id: row.id, status: row.status },
        data: { status: to, withdrawnAt: new Date() },
      });
      if (count === 0) throw AppException.conflict(ErrorCode.LISTING_CONCURRENT_MODIFICATION);
      await this.counters.refresh(tx, { agencyIds: [agencyId] });
    });
    if (row.status === ListingAgencyStatus.ACTIVE) await this.counters.invalidateSearch();
  }
}
