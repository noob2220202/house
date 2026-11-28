import {
  InquiryChannel,
  UserStatus,
  applicablePrices,
  type AgencyInquiryView,
  type InquiryListingRef,
  type InquiryMessageView,
  type MyInquiryDetail,
  type MyInquiryListItem,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { MediaService } from '../media/media.service';
import { PREVIEW_LENGTH } from './constants';
import { listingTitle } from './domain/customer';
import type {
  AgencyInquiryDetailRow,
  AgencyInquiryRow,
  InquiryListingRow,
  InquiryMessageRow,
  MyInquiryDetailRow,
  MyInquiryListRow,
} from './inquiry.selects';

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

interface LogoRef {
  storageKey: string;
  variants: Prisma.JsonValue | null;
  deletedAt: Date | null;
}

/**
 * Whether the office can answer in the thread: a written inquiry of a member who still has an
 * account, before retention erased it. Guests are called back on the number they left.
 */
export function canReply(row: {
  channel: InquiryChannel;
  userId: string | null;
  user: { status: UserStatus } | null;
  piiScrubbedAt: Date | null;
}): boolean {
  return (
    row.channel === InquiryChannel.MESSAGE &&
    row.userId !== null &&
    row.user !== null &&
    row.user.status !== UserStatus.WITHDRAWN &&
    row.piiScrubbedAt === null
  );
}

/** First `max` characters of a text on one line ("…" when cut). */
export function preview(text: string | null | undefined, max: number = PREVIEW_LENGTH): string {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim();
  const chars = [...flat];
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : flat;
}

/** DB rows → response views (explicit field picking). */
@Injectable()
export class InquiryMapper {
  constructor(private readonly media: MediaService) {}

  listing(row: InquiryListingRow | null): InquiryListingRef | null {
    if (!row || row.deletedAt) return null;
    const prices = applicablePrices(row.dealType, row);
    const cover = row.photos[0];
    return {
      id: row.id,
      title: listingTitle(row),
      assetType: row.assetType,
      dealType: row.dealType,
      salePrice: prices.salePrice,
      deposit: prices.deposit,
      monthlyRent: prices.monthlyRent,
      presalePrice: prices.presalePrice,
      coverPhotoUrl: cover ? this.media.url(cover.media, 'thumb') : null,
    };
  }

  message(row: InquiryMessageRow): InquiryMessageView {
    return {
      id: row.id,
      author: row.author,
      body: row.body,
      authorName: row.authorName,
      createdAt: row.createdAt.toISOString(),
    };
  }

  agency(row: AgencyInquiryRow): AgencyInquiryView {
    const handler = row.handledBy;
    return {
      id: row.id,
      channel: row.channel,
      status: row.status,
      source: row.source,
      listing: this.listing(row.listing),
      customerName: row.customerName,
      customerPhone: row.channel === InquiryChannel.MESSAGE ? row.customerPhone : null,
      isMember: row.userId !== null,
      canReply: canReply(row),
      message: row.message,
      memo: row.memo,
      handledByName: handler
        ? (handler.agencyMemberships[0]?.displayName ?? handler.name ?? null)
        : null,
      readAt: iso(row.readAt),
      lastMessageAt: row.lastMessageAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  agencyDetail(row: AgencyInquiryDetailRow): AgencyInquiryView {
    return { ...this.agency(row), messages: row.messages.map((m) => this.message(m)) };
  }

  myListItem(row: MyInquiryListRow, latestReplyAt: Date | undefined): MyInquiryListItem {
    return {
      id: row.id,
      agency: { id: row.agency.id, name: row.agency.name, logoUrl: this.logoUrl(row.agency.logo) },
      listing: this.listing(row.listing),
      status: row.status,
      preview: preview(row.messages[0]?.body ?? row.message),
      replyCount: row._count.messages,
      hasUnreadReply:
        latestReplyAt !== undefined && (!row.customerReadAt || latestReplyAt > row.customerReadAt),
      lastMessageAt: row.lastMessageAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
  }

  myDetail(row: MyInquiryDetailRow): MyInquiryDetail {
    return {
      id: row.id,
      agency: {
        id: row.agency.id,
        name: row.agency.name,
        phone: row.agency.phone,
        logoUrl: this.logoUrl(row.agency.logo),
      },
      listing: this.listing(row.listing),
      status: row.status,
      name: row.customerName,
      phone: row.customerPhone,
      message: row.message ?? '',
      messages: row.messages.map((m) => this.message(m)),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private logoUrl(logo: LogoRef | null): string | null {
    return logo && !logo.deletedAt ? this.media.url(logo, 'thumb') : null;
  }
}
