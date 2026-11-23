import {
  ErrorCode,
  type AgencyDealRequestListQuery,
  type AgencyDealRequestView,
  type Paginated,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { UserPrincipal } from '../../../common/auth/principal';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { PrismaService } from '../../../prisma/prisma.service';
import { canSeeContact, DealRequestMapper } from '../deal-request.mapper';
import {
  dealRequestAgencySelect,
  dealRequestContactSelect,
  type DealRequestAgencyRow,
  type DealRequestContactRow,
} from '../deal-request.selects';
import { AgencyActorService } from './agency-actor.service';
import { agencyInboxWhere, agencyVisibleWhere } from './deal-request-access';

/**
 * The agency inbox (/agency/deal-requests). Requests are filtered by the visibility rule; contact
 * fields are loaded in a separate query only for requests whose requester granted this agency.
 */
@Injectable()
export class AgencyInboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: DealRequestMapper,
    private readonly actors: AgencyActorService,
  ) {}

  async list(
    user: UserPrincipal,
    q: AgencyDealRequestListQuery,
    now: Date = new Date(),
  ): Promise<Paginated<AgencyDealRequestView>> {
    const actor = await this.actors.resolve(user);
    const where = agencyInboxWhere(actor, q, now);
    const select = dealRequestAgencySelect(actor.agencyId);
    const page = await paginate(
      q,
      (args) =>
        this.prisma.dealRequest.findMany({
          where,
          select,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...args,
        }),
      () => this.prisma.dealRequest.count({ where }),
    );
    const contacts = await this.contactsFor(page.items);
    return {
      ...page,
      items: page.items.map((r) => this.mapper.agency(r, contacts.get(r.id) ?? null)),
    };
  }

  async get(
    user: UserPrincipal,
    id: string,
    now: Date = new Date(),
  ): Promise<AgencyDealRequestView> {
    const actor = await this.actors.resolve(user);
    const row = await this.prisma.dealRequest.findFirst({
      where: { AND: [agencyVisibleWhere(actor, now), { id }] },
      select: dealRequestAgencySelect(actor.agencyId),
    });
    if (!row) throw AppException.notFound(ErrorCode.DEAL_REQUEST_NOT_FOUND);
    const contacts = await this.contactsFor([row]);
    return this.mapper.agency(row, contacts.get(row.id) ?? null);
  }

  private async contactsFor(
    rows: readonly DealRequestAgencyRow[],
  ): Promise<Map<string, DealRequestContactRow>> {
    const ids = rows.filter(canSeeContact).map((r) => r.id);
    if (ids.length === 0) return new Map();
    const contacts = await this.prisma.dealRequest.findMany({
      where: { id: { in: ids } },
      select: dealRequestContactSelect,
    });
    return new Map(contacts.map((c) => [c.id, c]));
  }
}
