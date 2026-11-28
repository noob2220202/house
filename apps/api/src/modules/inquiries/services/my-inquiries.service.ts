import {
  ErrorCode,
  INQUIRY_SOURCE_LABEL,
  InquiryAuthor,
  InquiryChannel,
  InquiryStatus,
  type InquiryReplyInput,
  type MyInquiryDetail,
  type MyInquiryListItem,
  type Paginated,
  type PaginationQuery,
} from '@house/shared';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { UserPrincipal } from '../../../common/auth/principal';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { DailyCapService } from '../../../common/throttle/daily-cap.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { listingTitle } from '../domain/customer';
import { InquiryMapper } from '../inquiry.mapper';
import { myInquiryDetailSelect, myInquiryListSelect } from '../inquiry.selects';
import { INQUIRY_DIRECTORY, type InquiryDirectory } from '../ports/inquiry-directory.port';
import { INQUIRY_NOTIFIER, type InquiryNotifierPort } from '../ports/inquiry-notifier.port';
import { receivedBody } from './inquiries.service';
import { consumeInquiryCap } from './inquiry-caps';

/** The member's own written inquiries (contact events and rows the office deleted never show). */
function ownWhere(userId: string): Prisma.InquiryWhereInput {
  return { userId, channel: InquiryChannel.MESSAGE, deletedAt: null };
}

const notAllowed = (): AppException =>
  new AppException(ErrorCode.INQUIRY_REPLY_NOT_ALLOWED, { status: HttpStatus.CONFLICT });

/** MY > 문의 내역 (/me/inquiries): threads with the office's answers, follow-ups. */
@Injectable()
export class MyInquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caps: DailyCapService,
    private readonly mapper: InquiryMapper,
    @Inject(INQUIRY_DIRECTORY) private readonly directory: InquiryDirectory,
    @Inject(INQUIRY_NOTIFIER) private readonly notifier: InquiryNotifierPort,
  ) {}

  async list(user: UserPrincipal, q: PaginationQuery): Promise<Paginated<MyInquiryListItem>> {
    const where = ownWhere(user.userId);
    const page = await paginate(
      q,
      (args) =>
        this.prisma.inquiry.findMany({
          where,
          select: myInquiryListSelect,
          orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
          ...args,
        }),
      () => this.prisma.inquiry.count({ where }),
    );
    const ids = page.items.map((r) => r.id);
    const replies =
      ids.length === 0
        ? []
        : await this.prisma.inquiryMessage.groupBy({
            by: ['inquiryId'],
            where: { inquiryId: { in: ids }, author: InquiryAuthor.AGENCY },
            _max: { createdAt: true },
          });
    const latestReply = new Map(replies.map((r) => [r.inquiryId, r._max.createdAt ?? undefined]));
    return {
      ...page,
      items: page.items.map((r) => this.mapper.myListItem(r, latestReply.get(r.id))),
    };
  }

  /** Opening the thread marks the office's answers read (the MY badge). */
  async get(user: UserPrincipal, id: string, now: Date = new Date()): Promise<MyInquiryDetail> {
    const { count } = await this.prisma.inquiry.updateMany({
      where: { id, ...ownWhere(user.userId) },
      data: { customerReadAt: now },
    });
    if (count === 0) throw AppException.notFound(ErrorCode.INQUIRY_NOT_FOUND);
    return this.detail(user.userId, id);
  }

  /**
   * A follow-up in the member's own thread: the inquiry is new and unread for the office again,
   * and every ACTIVE member is told. 409 once retention erased the thread or the office can no
   * longer take inquiries.
   */
  async followUp(
    user: UserPrincipal,
    id: string,
    input: InquiryReplyInput,
    now: Date = new Date(),
  ): Promise<MyInquiryDetail> {
    const own = await this.prisma.inquiry.findFirst({
      where: { id, ...ownWhere(user.userId) },
      select: { agencyId: true },
    });
    if (!own) throw AppException.notFound(ErrorCode.INQUIRY_NOT_FOUND);
    if (!(await this.directory.approvedAgency(own.agencyId))) throw notAllowed();
    await consumeInquiryCap(this.caps, 'INQUIRY_FOLLOW_UP', `u:${user.userId}`, now);

    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM inquiries
        WHERE id = ${id}::uuid AND user_id = ${user.userId}::uuid AND deleted_at IS NULL
        FOR UPDATE`;
      if (locked.length === 0) throw AppException.notFound(ErrorCode.INQUIRY_NOT_FOUND);
      const row = await tx.inquiry.findUniqueOrThrow({
        where: { id },
        select: {
          agencyId: true,
          source: true,
          customerName: true,
          piiScrubbedAt: true,
          listing: {
            select: {
              id: true,
              title: true,
              complex: { select: { name: true } },
              property: { select: { buildingName: true, roadAddress: true } },
            },
          },
        },
      });
      if (row.piiScrubbedAt) throw notAllowed();
      await tx.inquiryMessage.create({
        data: {
          inquiryId: id,
          author: InquiryAuthor.CUSTOMER,
          body: input.message,
          authorUserId: user.userId,
          authorName: row.customerName,
          createdAt: now,
        },
      });
      await tx.inquiry.update({
        where: { id },
        data: {
          status: InquiryStatus.NEW,
          readAt: null,
          lastMessageAt: now,
          customerReadAt: now,
        },
      });
      const l = row.listing;
      await this.notifier.inquiryReceived(tx, {
        agencyId: row.agencyId,
        inquiryId: id,
        title: '고객이 문의에 메시지를 더 남겼습니다.',
        body: receivedBody(
          l ? { id: l.id, title: listingTitle(l) } : null,
          INQUIRY_SOURCE_LABEL[row.source],
        ),
        followUp: true,
        excludeUserId: user.userId,
      });
    });
    return this.detail(user.userId, id);
  }

  private async detail(userId: string, id: string): Promise<MyInquiryDetail> {
    const row = await this.prisma.inquiry.findFirst({
      where: { id, ...ownWhere(userId) },
      select: myInquiryDetailSelect,
    });
    if (!row) throw AppException.notFound(ErrorCode.INQUIRY_NOT_FOUND);
    return this.mapper.myDetail(row);
  }
}
