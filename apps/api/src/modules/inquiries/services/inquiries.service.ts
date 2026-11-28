import {
  ACTION_CONSENT_TERMS,
  ErrorCode,
  INQUIRY_LIMITS,
  INQUIRY_SOURCE_LABEL,
  InquiryChannel,
  InquiryStatus,
  type InquiryContactEventInput,
  type InquiryCreateInput,
  type InquiryCreated,
} from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import type { Principal } from '../../../common/auth/principal';
import { AppException } from '../../../common/errors/app.exception';
import { DailyCapService } from '../../../common/throttle/daily-cap.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { InjectRedis } from '../../../redis/redis.constants';
import { TermsService } from '../../auth';
import { CONTACT_EVENT_KEY } from '../constants';
import {
  INQUIRY_DIRECTORY,
  type InquiryDirectory,
  type InquiryListing,
} from '../ports/inquiry-directory.port';
import { INQUIRY_NOTIFIER, type InquiryNotifierPort } from '../ports/inquiry-notifier.port';
import { consumeInquiryCap } from './inquiry-caps';
import { InquiryVisitorService } from './inquiry-visitor.service';

/** Notification text for the office: what the inquiry is about, never who sent it. */
export function receivedBody(listing: InquiryListing | null, source: string): string {
  return listing ? `매물 문의 · ${listing.title}` : `${source}에서 보낸 사무소 문의`;
}

/**
 * The customer's side of 문의 (members and guests; the office sites are anonymous, so guests are
 * first-class): written inquiries with consent, honeypot, throttle + daily cap, and contact
 * events (전화 / 문자 / 번호 복사) logged once per visitor and window.
 */
@Injectable()
export class InquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly terms: TermsService,
    private readonly caps: DailyCapService,
    private readonly visitors: InquiryVisitorService,
    @InjectRedis() private readonly redis: Redis,
    @Inject(INQUIRY_DIRECTORY) private readonly directory: InquiryDirectory,
    @Inject(INQUIRY_NOTIFIER) private readonly notifier: InquiryNotifierPort,
  ) {}

  /**
   * POST /inquiries. Order: honeypot → office / listing → guest phone → consents → daily cap →
   * transaction (member consent row, inquiry, notices to every ACTIVE member of the office).
   * The cap counts only requests that would otherwise succeed, as deal requests do.
   */
  async create(
    principal: Principal | undefined,
    input: InquiryCreateInput,
    now: Date = new Date(),
  ): Promise<InquiryCreated> {
    if (input.website !== undefined && input.website.trim() !== '') {
      throw AppException.badRequest(ErrorCode.INQUIRY_REJECTED);
    }
    const agency = await this.directory.approvedAgency(input.agencyId);
    if (!agency) throw AppException.notFound(ErrorCode.INQUIRY_AGENCY_NOT_FOUND);
    const listing = input.listingId
      ? await this.directory.publicListing(input.listingId, agency.id)
      : null;
    if (input.listingId && !listing)
      throw AppException.notFound(ErrorCode.INQUIRY_LISTING_NOT_FOUND);

    const visitor = this.visitors.current(principal);
    const phone = input.phone ?? null;
    if (!visitor.userId && !phone) throw AppException.badRequest(ErrorCode.INQUIRY_PHONE_REQUIRED);

    const types = ACTION_CONSENT_TERMS.INQUIRY;
    // 문의 개인정보 수집·이용 및 제공 동의: checked before the daily cap is consumed.
    const decisions = await this.terms.verifyActionConsents(types, input.consents, now);
    // A guest without a known address (never behind nginx) shares one bucket.
    await consumeInquiryCap(
      this.caps,
      'INQUIRY_CREATE',
      this.visitors.subject(visitor) ?? 'ip:unknown',
      now,
    );

    const row = await this.prisma.$transaction(async (tx) => {
      // Members: a user_consents row with the submission. Guests have no account to hang it on,
      // so the verified documents are kept on the inquiry itself.
      if (visitor.userId) {
        await this.terms.consentForAction(tx, visitor.userId, types, input.consents, now);
      }
      const created = await tx.inquiry.create({
        data: {
          agencyId: agency.id,
          listingId: listing?.id ?? null,
          userId: visitor.userId,
          channel: InquiryChannel.MESSAGE,
          status: InquiryStatus.NEW,
          source: input.source,
          customerName: input.name,
          customerPhone: phone,
          message: input.message,
          lastMessageAt: now,
          consentTermsDocumentIds: visitor.userId ? [] : decisions.map((d) => d.termsDocumentId),
          visitorHash: visitor.visitorHash,
          createdAt: now,
        },
        select: { id: true, createdAt: true },
      });
      await this.notifier.inquiryReceived(tx, {
        agencyId: agency.id,
        inquiryId: created.id,
        title: '새 문의가 도착했습니다.',
        body: receivedBody(listing, INQUIRY_SOURCE_LABEL[input.source]),
        followUp: false,
        excludeUserId: visitor.userId,
      });
      return created;
    });
    return { id: row.id, createdAt: row.createdAt.toISOString(), member: visitor.userId !== null };
  }

  /**
   * POST /inquiries/contact-events: one CALL / SMS / COPY row per visitor (member id or hashed
   * address) + office + listing + channel and CONTACT_EVENT_DEDUPE_HOURS, without PII: no name,
   * not even a masked one (nobody consented to giving it to the office; `isMember` still shows
   * from `userId`). A log line, not a case: stored as DONE and read, so it never fills the
   * 새 문의 tab, its count or the unread badge. No notification. Presses by the office's own
   * members and by visitors that cannot be identified are not logged. Returns whether a row was
   * written.
   */
  async contactEvent(
    principal: Principal | undefined,
    input: InquiryContactEventInput,
    now: Date = new Date(),
  ): Promise<boolean> {
    const agency = await this.directory.approvedAgency(input.agencyId);
    if (!agency) throw AppException.notFound(ErrorCode.INQUIRY_AGENCY_NOT_FOUND);
    const listing = input.listingId
      ? await this.directory.publicListing(input.listingId, agency.id)
      : null;
    if (input.listingId && !listing)
      throw AppException.notFound(ErrorCode.INQUIRY_LISTING_NOT_FOUND);

    const visitor = this.visitors.current(principal);
    const subject = this.visitors.subject(visitor);
    if (!subject) return false;
    if (visitor.userId && (await this.directory.isMember(agency.id, visitor.userId))) return false;

    const key = `${CONTACT_EVENT_KEY}:${subject}:${agency.id}:${listing?.id ?? 'office'}:${input.channel}`;
    const ttl = INQUIRY_LIMITS.CONTACT_EVENT_DEDUPE_HOURS * 3600;
    if ((await this.redis.set(key, '1', 'EX', ttl, 'NX')) !== 'OK') return false;
    try {
      await this.prisma.inquiry.create({
        data: {
          agencyId: agency.id,
          listingId: listing?.id ?? null,
          userId: visitor.userId,
          channel: input.channel,
          // Logged as handled and read: only written inquiries are worked in the 문의함 (a busy
          // listing would otherwise fill 새 문의 and the badge with every 전화 / 번호 복사 press).
          status: InquiryStatus.DONE,
          source: input.source,
          customerName: null,
          lastMessageAt: now,
          visitorHash: visitor.visitorHash,
          readAt: now,
          createdAt: now,
        },
        select: { id: true },
      });
    } catch (err) {
      // Not logged: let the next press within the window try again.
      await this.redis.del(key);
      throw err;
    }
    return true;
  }
}
