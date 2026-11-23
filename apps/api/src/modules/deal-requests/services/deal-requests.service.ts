import {
  COMPLEX_ASSET_TYPES,
  DEAL_REQUEST_ACTIVE_STATUSES,
  DEAL_REQUEST_LIMITS,
  DealRequestStatus,
  DealRequestType,
  DealRequestVisibility,
  ErrorCode,
  NotificationType,
  ProposalStatus,
  dealRequestExpiry,
  regionCodesWithinSgg,
  type ContactGrantView,
  type DealRequestCloseInput,
  type DealRequestCreateInput,
  type MyDealRequestDetail,
  type MyDealRequestListQuery,
  type MyDealRequestView,
  type Paginated,
  type SellOrLeaseRequestInput,
  type WantedRequestInput,
} from '@house/shared';
import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { UserPrincipal } from '../../../common/auth/principal';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { DailyCapService } from '../../../common/throttle/daily-cap.service';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AgenciesService } from '../../agencies/services/agencies.service';
import { DEAL_REQUEST_JOBS, DEAL_REQUESTS_QUEUE } from '../constants';
import { DealRequestMapper } from '../deal-request.mapper';
import {
  dealRequestOwnerSelect,
  proposalOwnerSelect,
  type DealRequestOwnerRow,
} from '../deal-request.selects';
import { NotificationsService } from '../notifications/notifications.service';
import {
  DEAL_REQUEST_AGENCIES,
  type DealRequestAgencyDirectory,
} from '../ports/agency-directory.port';
import { DEAL_REQUEST_COMPLEXES, type DealRequestComplexesPort } from '../ports/complexes.port';
import { DEAL_REQUEST_MEDIA, type DealRequestMediaPort } from '../ports/media.port';
import { DealRequestLifecycleService } from './deal-request-lifecycle.service';

interface ResolvedPlace {
  emdCode: string | null;
  lat: number | null;
  lng: number | null;
}

const toDate = (d: string | undefined): Date | null => (d ? new Date(`${d}T00:00:00.000Z`) : null);

/**
 * 내놓기/구하기 from the requester's side: create (login + rate limit + daily cap + active cap),
 * own list/detail with proposals, cancel/close, and per-agency contact consent.
 */
@Injectable()
export class DealRequestsService {
  private readonly logger = new Logger(DealRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly dailyCaps: DailyCapService,
    private readonly mapper: DealRequestMapper,
    private readonly notifications: NotificationsService,
    private readonly lifecycle: DealRequestLifecycleService,
    private readonly agencyService: AgenciesService,
    @Inject(DEAL_REQUEST_AGENCIES) private readonly agencies: DealRequestAgencyDirectory,
    @Inject(DEAL_REQUEST_COMPLEXES) private readonly complexes: DealRequestComplexesPort,
    @Inject(DEAL_REQUEST_MEDIA) private readonly media: DealRequestMediaPort,
    @InjectQueue(DEAL_REQUESTS_QUEUE) private readonly queue: Queue,
  ) {}

  async create(
    user: UserPrincipal,
    input: DealRequestCreateInput,
    now: Date = new Date(),
  ): Promise<MyDealRequestView> {
    const sggCode = this.config.get('REGION_SGG_CODE');
    const active = await this.prisma.dealRequest.count({
      where: {
        userId: user.userId,
        status: { in: [...DEAL_REQUEST_ACTIVE_STATUSES] },
        deletedAt: null,
      },
    });
    if (active >= DEAL_REQUEST_LIMITS.MAX_ACTIVE_PER_USER) {
      throw AppException.badRequest(ErrorCode.DEAL_REQUEST_ACTIVE_LIMIT, {
        limit: DEAL_REQUEST_LIMITS.MAX_ACTIVE_PER_USER,
      });
    }
    const place =
      input.type === DealRequestType.SELL_OR_LEASE
        ? await this.resolveSellPlace(input, sggCode)
        : await this.validateWanted(input, sggCode);
    if (input.visibility === DealRequestVisibility.SELECTED_AGENCIES) {
      const approved = await this.agencies.approvedIds(input.targetAgencyIds);
      const invalid = input.targetAgencyIds.filter((id) => !approved.has(id));
      if (invalid.length > 0) {
        throw AppException.badRequest(ErrorCode.DEAL_REQUEST_TARGET_INVALID, {
          agencyIds: invalid,
        });
      }
    }
    const photoIds = input.type === DealRequestType.SELL_OR_LEASE ? input.photoMediaIds : [];
    await this.media.assertPhotosUsable(photoIds, user.userId);

    // Counted only once the request is known to be valid (the attempt is what we cap).
    await this.dailyCaps.consume('DEAL_REQUEST_CREATE', user.userId, now);

    const id = await this.prisma.$transaction(async (tx) => {
      await this.media.assertPhotosUsable(photoIds, user.userId, tx);
      const row = await tx.dealRequest.create({
        data: this.createData(user.userId, input, sggCode, place, now),
        select: { id: true },
      });
      if (input.visibility === DealRequestVisibility.SELECTED_AGENCIES) {
        await tx.dealRequestTarget.createMany({
          data: input.targetAgencyIds.map((agencyId) => ({ dealRequestId: row.id, agencyId })),
        });
      }
      if (photoIds.length > 0) {
        await tx.dealRequestPhoto.createMany({
          data: photoIds.map((mediaId, i) => ({ dealRequestId: row.id, mediaId, sortOrder: i })),
        });
      }
      return row.id;
    });
    await this.enqueueFanout(id);
    return this.mapper.owner(await this.loadOwned(user.userId, id));
  }

  async listMine(
    user: UserPrincipal,
    q: MyDealRequestListQuery,
  ): Promise<Paginated<MyDealRequestView>> {
    const where: Prisma.DealRequestWhereInput = {
      userId: user.userId,
      deletedAt: null,
      ...(q.status?.length ? { status: { in: q.status } } : {}),
      ...(q.type ? { type: q.type } : {}),
    };
    const page = await paginate(
      q,
      (args) =>
        this.prisma.dealRequest.findMany({
          where,
          select: dealRequestOwnerSelect,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...args,
        }),
      () => this.prisma.dealRequest.count({ where }),
    );
    return { ...page, items: page.items.map((r) => this.mapper.owner(r)) };
  }

  /** Own request with its proposals; opening it marks SENT proposals as VIEWED (read receipt). */
  async getMine(
    user: UserPrincipal,
    id: string,
    now: Date = new Date(),
  ): Promise<MyDealRequestDetail> {
    const row = await this.loadOwned(user.userId, id);
    await this.prisma.proposal.updateMany({
      where: { dealRequestId: id, status: ProposalStatus.SENT },
      data: { status: ProposalStatus.VIEWED, viewedAt: now },
    });
    const proposals = await this.prisma.proposal.findMany({
      where: { dealRequestId: id, status: { not: ProposalStatus.WITHDRAWN } },
      select: proposalOwnerSelect,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const disclosures = await this.agencyService.getDisclosures(proposals.map((p) => p.agencyId));
    const granted = new Set(row.contactGrants.map((g) => g.agencyId));
    return {
      ...this.mapper.owner(row),
      proposals: proposals.map((p) =>
        this.mapper.proposalForOwner(
          p,
          disclosures.get(p.agencyId) ?? null,
          granted.has(p.agencyId),
        ),
      ),
    };
  }

  cancel(user: UserPrincipal, id: string, now: Date = new Date()): Promise<MyDealRequestView> {
    return this.end(user, id, DealRequestStatus.CANCELLED, null, now);
  }

  /**
   * Extends an OPEN request, or reopens an EXPIRED one, for another TTL_DAYS (at most
   * MAX_EXTENSIONS times). Reopening counts toward MAX_ACTIVE_PER_USER; requests whose contact was
   * already erased cannot come back. Serialized per member so concurrent calls cannot exceed caps.
   */
  async extend(
    user: UserPrincipal,
    id: string,
    now: Date = new Date(),
  ): Promise<MyDealRequestView> {
    await this.prisma.$transaction(async (tx) => {
      const lockKey = `deal-request-active:${user.userId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const req = await tx.dealRequest.findFirst({
        where: { id, userId: user.userId, deletedAt: null },
        select: { status: true, extensionCount: true, contactScrubbedAt: true },
      });
      if (!req) throw AppException.notFound(ErrorCode.DEAL_REQUEST_NOT_FOUND);
      const extendable: DealRequestStatus[] = [DealRequestStatus.OPEN, DealRequestStatus.EXPIRED];
      if (!extendable.includes(req.status) || req.contactScrubbedAt !== null) {
        throw AppException.badRequest(ErrorCode.DEAL_REQUEST_STATE_INVALID);
      }
      if (req.extensionCount >= DEAL_REQUEST_LIMITS.MAX_EXTENSIONS) {
        throw AppException.badRequest(ErrorCode.DEAL_REQUEST_EXTEND_LIMIT, {
          limit: DEAL_REQUEST_LIMITS.MAX_EXTENSIONS,
        });
      }
      if (req.status === DealRequestStatus.EXPIRED) {
        const active = await tx.dealRequest.count({
          where: {
            userId: user.userId,
            status: { in: [...DEAL_REQUEST_ACTIVE_STATUSES] },
            deletedAt: null,
          },
        });
        if (active >= DEAL_REQUEST_LIMITS.MAX_ACTIVE_PER_USER) {
          throw AppException.badRequest(ErrorCode.DEAL_REQUEST_ACTIVE_LIMIT, {
            limit: DEAL_REQUEST_LIMITS.MAX_ACTIVE_PER_USER,
          });
        }
      }
      const { count } = await tx.dealRequest.updateMany({
        where: {
          id,
          status: req.status,
          extensionCount: req.extensionCount,
          contactScrubbedAt: null,
        },
        data: {
          status: DealRequestStatus.OPEN,
          expiresAt: dealRequestExpiry(now, DEAL_REQUEST_LIMITS.TTL_DAYS),
          closedAt: null,
          extensionCount: { increment: 1 },
        },
      });
      if (count === 0) throw AppException.badRequest(ErrorCode.DEAL_REQUEST_STATE_INVALID);
    });
    return this.mapper.owner(await this.loadOwned(user.userId, id));
  }

  close(
    user: UserPrincipal,
    id: string,
    input: DealRequestCloseInput,
    now: Date = new Date(),
  ): Promise<MyDealRequestView> {
    return this.end(user, id, DealRequestStatus.CLOSED, input.reason ?? null, now);
  }

  /**
   * The requester's consent to reveal contact name/phone and 동·호 to one agency. Allowed for agencies
   * the requester selected or that sent a (non-withdrawn) proposal. Idempotent.
   */
  async grantContact(
    user: UserPrincipal,
    id: string,
    agencyId: string,
    now: Date = new Date(),
  ): Promise<ContactGrantView> {
    const req = await this.findOwned(user.userId, id);
    if (!DEAL_REQUEST_ACTIVE_STATUSES.includes(req.status)) {
      throw AppException.badRequest(ErrorCode.DEAL_REQUEST_STATE_INVALID);
    }
    const [approved, related] = await Promise.all([
      this.agencies.approvedIds([agencyId]),
      this.prisma.dealRequest.count({
        where: {
          id,
          OR: [
            { targets: { some: { agencyId } } },
            { proposals: { some: { agencyId, status: { not: ProposalStatus.WITHDRAWN } } } },
          ],
        },
      }),
    ]);
    if (!approved.has(agencyId) || related === 0) {
      throw AppException.badRequest(ErrorCode.DEAL_REQUEST_GRANT_INVALID);
    }
    const sent = await this.prisma.$transaction(async (tx) => {
      const created = await this.lifecycle.grant(tx, id, agencyId, now);
      if (!created) return [];
      const recipients = (await this.agencies.memberUserIds([agencyId], tx)).filter(
        (u) => u !== user.userId,
      );
      return this.notifications.createFor(
        recipients,
        {
          type: NotificationType.CONTACT_GRANTED,
          title: '요청자가 연락처를 공개했습니다.',
          data: { dealRequestId: id },
        },
        tx,
      );
    });
    await this.notifications.dispatch(sent);
    const grant = await this.prisma.dealRequestContactGrant.findUniqueOrThrow({
      where: { dealRequestId_agencyId: { dealRequestId: id, agencyId } },
      select: { agencyId: true, grantedAt: true, agency: { select: { name: true } } },
    });
    return {
      agencyId: grant.agencyId,
      agencyName: grant.agency.name,
      grantedAt: grant.grantedAt.toISOString(),
    };
  }

  async revokeContact(
    user: UserPrincipal,
    id: string,
    agencyId: string,
    now: Date = new Date(),
  ): Promise<void> {
    await this.findOwned(user.userId, id);
    const { count } = await this.prisma.dealRequestContactGrant.updateMany({
      where: { dealRequestId: id, agencyId, revokedAt: null },
      data: { revokedAt: now },
    });
    if (count === 0) throw AppException.notFound(ErrorCode.DEAL_REQUEST_GRANT_NOT_FOUND);
  }

  // ---------------------------------------------------------------------------------------------

  private async end(
    user: UserPrincipal,
    id: string,
    to: typeof DealRequestStatus.CLOSED | typeof DealRequestStatus.CANCELLED,
    reason: string | null,
    now: Date,
  ): Promise<MyDealRequestView> {
    await this.findOwned(user.userId, id);
    const sent = await this.prisma.$transaction((tx) =>
      this.lifecycle.end(tx, {
        dealRequestId: id,
        to,
        reason,
        revokeGrants: to === DealRequestStatus.CANCELLED,
        actorUserId: user.userId,
        now,
      }),
    );
    await this.notifications.dispatch(sent);
    return this.mapper.owner(await this.loadOwned(user.userId, id));
  }

  private async findOwned(
    userId: string,
    id: string,
  ): Promise<{ id: string; status: DealRequestStatus }> {
    const row = await this.prisma.dealRequest.findFirst({
      where: { id, userId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!row) throw AppException.notFound(ErrorCode.DEAL_REQUEST_NOT_FOUND);
    return row;
  }

  private async loadOwned(userId: string, id: string): Promise<DealRequestOwnerRow> {
    const row = await this.prisma.dealRequest.findFirst({
      where: { id, userId, deletedAt: null },
      select: dealRequestOwnerSelect,
    });
    if (!row) throw AppException.notFound(ErrorCode.DEAL_REQUEST_NOT_FOUND);
    return row;
  }

  private async resolveSellPlace(
    input: SellOrLeaseRequestInput,
    sggCode: string,
  ): Promise<ResolvedPlace> {
    if (input.emdCode && !regionCodesWithinSgg([input.emdCode], sggCode)) {
      throw AppException.badRequest(ErrorCode.DEAL_REQUEST_REGION_INVALID, { path: ['emdCode'] });
    }
    let complex: { emdCode: string | null; lat: number; lng: number } | null = null;
    if (input.complexId) {
      const [row] = await this.complexes.findActive([input.complexId]);
      if (!row || row.sggCode !== sggCode || row.assetType !== input.assetType) {
        throw AppException.badRequest(ErrorCode.DEAL_REQUEST_COMPLEX_INVALID, {
          complexIds: [input.complexId],
        });
      }
      complex = row;
    }
    return {
      emdCode: input.emdCode ?? complex?.emdCode ?? null,
      lat: input.lat ?? complex?.lat ?? null,
      lng: input.lng ?? complex?.lng ?? null,
    };
  }

  private async validateWanted(input: WantedRequestInput, sggCode: string): Promise<ResolvedPlace> {
    if (!regionCodesWithinSgg(input.regionCodes, sggCode)) {
      throw AppException.badRequest(ErrorCode.DEAL_REQUEST_REGION_INVALID, {
        path: ['regionCodes'],
      });
    }
    if (input.complexIds.length > 0) {
      const ids = [...new Set(input.complexIds)];
      const rows = await this.complexes.findActive(ids);
      const ok = new Set(
        rows
          .filter(
            (r) =>
              r.sggCode === sggCode &&
              r.assetType === input.assetType &&
              COMPLEX_ASSET_TYPES.includes(r.assetType),
          )
          .map((r) => r.id),
      );
      const invalid = ids.filter((id) => !ok.has(id));
      if (invalid.length > 0) {
        throw AppException.badRequest(ErrorCode.DEAL_REQUEST_COMPLEX_INVALID, {
          complexIds: invalid,
        });
      }
    }
    return { emdCode: null, lat: null, lng: null };
  }

  private createData(
    userId: string,
    input: DealRequestCreateInput,
    sggCode: string,
    place: ResolvedPlace,
    now: Date,
  ): Prisma.DealRequestUncheckedCreateInput {
    const common = {
      type: input.type,
      userId,
      status: DealRequestStatus.OPEN,
      assetType: input.assetType,
      dealTypes: input.dealTypes,
      visibility: input.visibility,
      sggCode,
      contactName: input.contactName,
      contactPhone: input.contactPhone,
      description: input.description ?? null,
      moveInDate: toDate(input.moveInDate),
      expiresAt: dealRequestExpiry(now, DEAL_REQUEST_LIMITS.TTL_DAYS),
      emdCode: place.emdCode,
      lat: place.lat,
      lng: place.lng,
    };
    if (input.type === DealRequestType.SELL_OR_LEASE) {
      return {
        ...common,
        roadAddress: input.roadAddress,
        addressDetail: input.addressDetail ?? null,
        complexId: input.complexId ?? null,
        exclusiveArea: input.exclusiveArea ?? null,
        floor: input.floor ?? null,
        desiredSalePrice: input.desiredSalePrice ?? null,
        desiredDeposit: input.desiredDeposit ?? null,
        desiredMonthlyRent: input.desiredMonthlyRent ?? null,
      };
    }
    return {
      ...common,
      regionCodes: [...new Set(input.regionCodes)],
      complexIds: [...new Set(input.complexIds)],
      priceMin: input.priceMin ?? null,
      priceMax: input.priceMax ?? null,
      depositMin: input.depositMin ?? null,
      depositMax: input.depositMax ?? null,
      rentMin: input.rentMin ?? null,
      rentMax: input.rentMax ?? null,
      areaMin: input.areaMin ?? null,
      areaMax: input.areaMax ?? null,
      roomsMin: input.roomsMin ?? null,
    };
  }

  /** Fan-out runs in the worker; a failed enqueue only delays agency notifications. */
  private async enqueueFanout(dealRequestId: string): Promise<void> {
    try {
      await this.queue.add(
        DEAL_REQUEST_JOBS.FANOUT,
        { dealRequestId },
        { jobId: `fanout-${dealRequestId}` },
      );
    } catch (err) {
      this.logger.warn({ err, dealRequestId }, 'deal request fan-out enqueue failed');
    }
  }
}
