import { NotificationType } from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { PrismaTx } from '../../../prisma/prisma.service';
import { INQUIRY_DIRECTORY, type InquiryDirectory } from './inquiry-directory.port';

export interface InquiryReceivedNotice {
  agencyId: string;
  inquiryId: string;
  title: string;
  body: string;
  followUp: boolean;
  /** The customer, when they are a member of the office too (never notified of their own text). */
  excludeUserId: string | null;
}

export interface InquiryRepliedNotice {
  userId: string;
  inquiryId: string;
  agencyName: string;
  title: string;
  body: string;
}

/**
 * In-app notices of the inquiry flow, written to the shared `notifications` table inside the
 * caller's transaction (read via /me/notifications; no external delivery yet).
 *
 * A direct write like the listings and agencies modules: the notifications writer lives in the
 * deal-requests module, which depends on this one (console dashboard), so importing it here would
 * make a cycle. Routing follows the B5 rule of NotificationsService:
 *  - INQUIRY_RECEIVED goes to every ACTIVE member of the office and carries `data.agencyId`
 *    (an agency-only type, console feed);
 *  - INQUIRY_REPLIED goes to the customer's own feed, so its data must never carry `agencyId`.
 */
export interface InquiryNotifierPort {
  inquiryReceived(db: PrismaTx, notice: InquiryReceivedNotice): Promise<number>;
  inquiryReplied(db: PrismaTx, notice: InquiryRepliedNotice): Promise<void>;
}

export const INQUIRY_NOTIFIER = Symbol('INQUIRY_NOTIFIER');

@Injectable()
export class PrismaInquiryNotifier implements InquiryNotifierPort {
  constructor(@Inject(INQUIRY_DIRECTORY) private readonly directory: InquiryDirectory) {}

  async inquiryReceived(db: PrismaTx, n: InquiryReceivedNotice): Promise<number> {
    const userIds = (await this.directory.memberUserIds(n.agencyId, db)).filter(
      (id) => id !== n.excludeUserId,
    );
    if (userIds.length === 0) return 0;
    const { count } = await db.notification.createMany({
      data: [...new Set(userIds)].map((userId) => ({
        userId,
        type: NotificationType.INQUIRY_RECEIVED,
        title: n.title,
        body: n.body,
        data: {
          agencyId: n.agencyId,
          inquiryId: n.inquiryId,
          ...(n.followUp ? { followUp: true } : {}),
        },
      })),
    });
    return count;
  }

  async inquiryReplied(db: PrismaTx, n: InquiryRepliedNotice): Promise<void> {
    await db.notification.create({
      data: {
        userId: n.userId,
        type: NotificationType.INQUIRY_REPLIED,
        title: n.title,
        body: n.body,
        data: { inquiryId: n.inquiryId, agencyName: n.agencyName },
      },
    });
  }
}
