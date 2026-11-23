import {
  ErrorCode,
  ListingAgencyStatus,
  PUBLIC_LISTING_STATUSES,
  type AgencyListingDetail,
  type CoBrokerJoinInput,
} from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { UserPrincipal } from '../../../common/auth/principal';
import { AppException } from '../../../common/errors/app.exception';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  LISTING_AGENCY_MEMBERSHIP,
  type AgencyMembershipPort,
} from '../ports/agency-membership.port';
import { AgencyListingsService } from './agency-listings.service';
import { ListingCountersService } from './listing-counters.service';

/**
 * 공동중개: other agencies join a publicly advertised listing as co-brokers and can leave it;
 * the primary agency can remove co-brokers. The primary row never changes here.
 */
@Injectable()
export class CoBrokerageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listings: AgencyListingsService,
    private readonly counters: ListingCountersService,
    @Inject(LISTING_AGENCY_MEMBERSHIP) private readonly membership: AgencyMembershipPort,
  ) {}

  async join(
    principal: UserPrincipal,
    listingId: string,
    dto: CoBrokerJoinInput,
  ): Promise<AgencyListingDetail> {
    const actor = await this.membership.resolveActor(principal);
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, deletedAt: null },
      select: {
        id: true,
        status: true,
        complexId: true,
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
    if (!PUBLIC_LISTING_STATUSES.includes(listing.status)) {
      throw AppException.badRequest(ErrorCode.LISTING_CO_BROKER_NOT_ALLOWED);
    }
    const contact = await this.listings.resolveContact(actor, dto);

    await this.prisma.$transaction(async (tx) => {
      if (own) {
        await tx.listingAgency.update({
          where: { id: own.id },
          data: {
            ...contact,
            status: ListingAgencyStatus.ACTIVE,
            joinedAt: new Date(),
            withdrawnAt: null,
          },
        });
      } else {
        await tx.listingAgency.create({
          data: { listingId, agencyId: actor.agencyId, isPrimary: false, ...contact },
        });
      }
      await this.counters.refresh(tx, { agencyIds: [actor.agencyId] });
    });
    await this.counters.invalidateSearch();
    return this.listings.detail(listingId, actor);
  }

  /** The acting agency withdraws from a listing it co-brokers. */
  async leave(principal: UserPrincipal, listingId: string): Promise<void> {
    const actor = await this.membership.resolveActor(principal);
    await this.withdraw(listingId, actor.agencyId);
  }

  /** The primary agency removes another agency from the listing. */
  async removeAgency(principal: UserPrincipal, listingId: string, agencyId: string): Promise<void> {
    const actor = await this.membership.resolveActor(principal);
    await this.listings.loadForActor(listingId, actor, { primaryOnly: true });
    await this.withdraw(listingId, agencyId);
  }

  private async withdraw(listingId: string, agencyId: string): Promise<void> {
    const row = await this.prisma.listingAgency.findFirst({
      where: {
        listingId,
        agencyId,
        status: ListingAgencyStatus.ACTIVE,
        listing: { deletedAt: null },
      },
      select: { id: true, isPrimary: true },
    });
    if (!row) throw AppException.notFound(ErrorCode.LISTING_CO_BROKER_NOT_FOUND);
    if (row.isPrimary) throw AppException.badRequest(ErrorCode.LISTING_PRIMARY_CANNOT_LEAVE);
    await this.prisma.$transaction(async (tx) => {
      await tx.listingAgency.update({
        where: { id: row.id },
        data: { status: ListingAgencyStatus.WITHDRAWN, withdrawnAt: new Date() },
      });
      await this.counters.refresh(tx, { agencyIds: [agencyId] });
    });
    await this.counters.invalidateSearch();
  }
}
