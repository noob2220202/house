import {
  ErrorCode,
  InquiryAuthor,
  InquiryStatus,
  type AgencyInquiryDeleteInput,
  type AgencyInquiryListQuery,
  type AgencyInquiryPage,
  type AgencyInquiryReadAllResult,
  type AgencyInquiryUpdateInput,
  type AgencyInquiryView,
  type InquiryReplyInput,
} from '@house/shared';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { UserPrincipal } from '../../../common/auth/principal';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { AgenciesService, type ActiveMember } from '../../agencies/services/agencies.service';
import { phoneDigits } from '../domain/customer';
import { canReply, InquiryMapper } from '../inquiry.mapper';
import { agencyInquiryDetailSelect, agencyInquirySelect } from '../inquiry.selects';
import { INQUIRY_DIRECTORY, type InquiryDirectory } from '../ports/inquiry-directory.port';
import { INQUIRY_NOTIFIER, type InquiryNotifierPort } from '../ports/inquiry-notifier.port';

const newestFirst: Prisma.InquiryOrderByWithRelationInput[] = [
  { lastMessageAt: 'desc' },
  { id: 'desc' },
];

/** Rows of the office's inbox (soft-deleted ones never show). */
export function inboxWhere(agencyId: string): Prisma.InquiryWhereInput {
  return { agencyId, deletedAt: null };
}

/**
 * Filters of GET /agency/inquiries except `status` (the status tabs count under the other
 * filters). `q` matches the customer name, phone (digits), opening text, thread messages and
 * every name the row's listing card can show (`listingTitle`: title, 단지, building, address).
 */
export function inboxFilterWhere(
  agencyId: string,
  q: Omit<AgencyInquiryListQuery, 'page' | 'pageSize' | 'status'>,
): Prisma.InquiryWhereInput {
  const and: Prisma.InquiryWhereInput[] = [inboxWhere(agencyId)];
  if (q.channel) and.push({ channel: q.channel });
  if (q.source) and.push({ source: q.source });
  if (q.unread) and.push({ readAt: null });
  if (q.q) {
    const text = { contains: q.q, mode: 'insensitive' } as const;
    const digits = phoneDigits(q.q);
    and.push({
      OR: [
        { customerName: text },
        { message: text },
        { messages: { some: { body: text } } },
        { listing: { title: text } },
        { listing: { complex: { name: text } } },
        { listing: { property: { buildingName: text } } },
        { listing: { property: { roadAddress: text } } },
        ...(digits ? [{ customerPhone: { contains: digits } }] : []),
      ],
    });
  }
  return and.length === 1 ? and[0]! : { AND: and };
}

/**
 * The broker console inbox (/agency/inquiries): ACTIVE members of an APPROVED office see and
 * handle every inquiry of that office (403 otherwise; other offices' rows answer 404).
 */
@Injectable()
export class AgencyInquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agencies: AgenciesService,
    private readonly mapper: InquiryMapper,
    @Inject(INQUIRY_DIRECTORY) private readonly directory: InquiryDirectory,
    @Inject(INQUIRY_NOTIFIER) private readonly notifier: InquiryNotifierPort,
  ) {}

  async list(user: UserPrincipal, q: AgencyInquiryListQuery): Promise<AgencyInquiryPage> {
    const actor = await this.actor(user);
    const base = inboxFilterWhere(actor.agencyId, q);
    const where: Prisma.InquiryWhereInput = q.status ? { AND: [base, { status: q.status }] } : base;
    const select = agencyInquirySelect(actor.agencyId);
    const [page, grouped, unreadCount] = await Promise.all([
      paginate(
        q,
        (args) => this.prisma.inquiry.findMany({ where, select, orderBy: newestFirst, ...args }),
        () => this.prisma.inquiry.count({ where }),
      ),
      this.prisma.inquiry.groupBy({ by: ['status'], where: base, _count: { _all: true } }),
      this.unreadCount(actor.agencyId),
    ]);
    const statusCounts: Record<InquiryStatus, number> = { NEW: 0, IN_PROGRESS: 0, DONE: 0 };
    for (const g of grouped) statusCounts[g.status] = g._count._all;
    return {
      ...page,
      items: page.items.map((r) => this.mapper.agency(r)),
      unreadCount,
      statusCounts,
    };
  }

  async get(user: UserPrincipal, id: string): Promise<AgencyInquiryView> {
    const actor = await this.actor(user);
    return this.detail(actor.agencyId, id);
  }

  /** Status (the caller becomes the handler), internal memo, read flag. */
  async update(
    user: UserPrincipal,
    id: string,
    input: AgencyInquiryUpdateInput,
    now: Date = new Date(),
  ): Promise<AgencyInquiryView> {
    const actor = await this.actor(user);
    const row = await this.prisma.inquiry.findFirst({
      where: { id, ...inboxWhere(actor.agencyId) },
      select: { status: true, readAt: true },
    });
    if (!row) throw AppException.notFound(ErrorCode.INQUIRY_NOT_FOUND);
    const data: Prisma.InquiryUncheckedUpdateManyInput = {};
    if (input.status !== undefined && input.status !== row.status) {
      data.status = input.status;
      data.handledByUserId = actor.userId;
    }
    if (input.memo !== undefined) data.memo = input.memo;
    if (input.read === true && !row.readAt) data.readAt = now;
    if (input.read === false) data.readAt = null;
    if (Object.keys(data).length > 0) {
      const { count } = await this.prisma.inquiry.updateMany({
        where: { id, ...inboxWhere(actor.agencyId) },
        data,
      });
      if (count === 0) throw AppException.notFound(ErrorCode.INQUIRY_NOT_FOUND);
    }
    return this.detail(actor.agencyId, id);
  }

  /**
   * The office's answer in the thread — members only (guests are called back on their number):
   * 409 INQUIRY_REPLY_NOT_ALLOWED otherwise. A new inquiry moves to 응대 중 and is read.
   */
  async reply(
    user: UserPrincipal,
    id: string,
    input: InquiryReplyInput,
    now: Date = new Date(),
  ): Promise<AgencyInquiryView> {
    const actor = await this.actor(user);
    await this.prisma.$transaction(async (tx) => {
      const row = await this.lockOwn(tx, actor.agencyId, id);
      if (!canReply(row) || !row.userId) {
        throw new AppException(ErrorCode.INQUIRY_REPLY_NOT_ALLOWED, {
          status: HttpStatus.CONFLICT,
        });
      }
      await tx.inquiryMessage.create({
        data: {
          inquiryId: id,
          author: InquiryAuthor.AGENCY,
          body: input.message,
          authorUserId: actor.userId,
          authorName: actor.displayName,
          createdAt: now,
        },
      });
      await tx.inquiry.update({
        where: { id },
        data: {
          lastMessageAt: now,
          readAt: row.readAt ?? now,
          ...(row.status === InquiryStatus.NEW
            ? { status: InquiryStatus.IN_PROGRESS, handledByUserId: actor.userId }
            : {}),
        },
      });
      const agency = await this.directory.approvedAgency(actor.agencyId, tx);
      const agencyName = agency?.name ?? '중개사무소';
      await this.notifier.inquiryReplied(tx, {
        userId: row.userId,
        inquiryId: id,
        agencyName,
        title: '문의에 답변이 도착했습니다.',
        body: `${agencyName}에서 답변을 남겼어요.`,
      });
    });
    return this.detail(actor.agencyId, id);
  }

  /** "모두 읽음" of the inbox. */
  async readAll(user: UserPrincipal, now: Date = new Date()): Promise<AgencyInquiryReadAllResult> {
    const actor = await this.actor(user);
    const { count } = await this.prisma.inquiry.updateMany({
      where: { ...inboxWhere(actor.agencyId), readAt: null },
      data: { readAt: now },
    });
    return { updated: count, unreadCount: await this.unreadCount(actor.agencyId) };
  }

  /** Soft delete (스팸 처리 / 정리): gone from the inbox and from the customer's MY page. */
  async remove(
    user: UserPrincipal,
    id: string,
    input: AgencyInquiryDeleteInput,
    now: Date = new Date(),
  ): Promise<void> {
    const actor = await this.actor(user);
    const { count } = await this.prisma.inquiry.updateMany({
      where: { id, ...inboxWhere(actor.agencyId) },
      data: { deletedAt: now, deleteReason: input.reason ?? null },
    });
    if (count === 0) throw AppException.notFound(ErrorCode.INQUIRY_NOT_FOUND);
  }

  unreadCount(agencyId: string): Promise<number> {
    return this.prisma.inquiry.count({ where: { ...inboxWhere(agencyId), readAt: null } });
  }

  private actor(user: UserPrincipal): Promise<ActiveMember> {
    return this.agencies.assertActiveMember(user.userId, user.agencyId);
  }

  private async detail(agencyId: string, id: string): Promise<AgencyInquiryView> {
    const row = await this.prisma.inquiry.findFirst({
      where: { id, ...inboxWhere(agencyId) },
      select: agencyInquiryDetailSelect(agencyId),
    });
    if (!row) throw AppException.notFound(ErrorCode.INQUIRY_NOT_FOUND);
    return this.mapper.agencyDetail(row);
  }

  /** The office's row under a row lock (serializes replies with the retention scrub). */
  private async lockOwn(tx: PrismaTx, agencyId: string, id: string) {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM inquiries
      WHERE id = ${id}::uuid AND agency_id = ${agencyId}::uuid AND deleted_at IS NULL
      FOR UPDATE`;
    if (locked.length === 0) throw AppException.notFound(ErrorCode.INQUIRY_NOT_FOUND);
    return tx.inquiry.findUniqueOrThrow({
      where: { id },
      select: {
        channel: true,
        status: true,
        userId: true,
        readAt: true,
        piiScrubbedAt: true,
        user: { select: { status: true } },
      },
    });
  }
}
