// Owned by the inquiries module team. Response shapes of the inquiries API.
import type { InquiryAuthor, InquiryChannel, InquirySource, InquiryStatus } from '../enums/inquiry';
import type { AssetType, DealType } from '../enums/listing';
import type { Paginated } from '../schemas/common';

/** The listing an inquiry is about (compact card). */
export interface InquiryListingRef {
  id: string;
  title: string;
  assetType: AssetType;
  dealType: DealType;
  salePrice: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  presalePrice: number | null;
  coverPhotoUrl: string | null;
}

/** A follow-up or reply in a thread (the opening text is the inquiry's own `message`). */
export interface InquiryMessageView {
  id: string;
  author: InquiryAuthor;
  body: string;
  /** AGENCY: the member's display name; CUSTOMER: the customer name. */
  authorName: string | null;
  createdAt: string;
}

/** Row (and, with `messages`, detail) of the console inbox. */
export interface AgencyInquiryView {
  id: string;
  channel: InquiryChannel;
  status: InquiryStatus;
  source: InquirySource;
  /** null = sent from the office page / office site home. */
  listing: InquiryListingRef | null;
  /** MESSAGE: as submitted; contact events: always null (no consent to name the visitor). */
  customerName: string | null;
  /** MESSAGE only. */
  customerPhone: string | null;
  isMember: boolean;
  /** MESSAGE && member && member not withdrawn. */
  canReply: boolean;
  message: string | null;
  memo: string | null;
  handledByName: string | null;
  readAt: string | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  /** Detail only: follow-ups and replies, oldest first. */
  messages?: InquiryMessageView[];
}

/** GET /agency/inquiries */
export interface AgencyInquiryPage extends Paginated<AgencyInquiryView> {
  unreadCount: number;
  statusCounts: Record<InquiryStatus, number>;
}

/** POST /agency/inquiries/read */
export interface AgencyInquiryReadAllResult {
  updated: number;
  unreadCount: number;
}

/** Row of GET /me/inquiries */
export interface MyInquiryListItem {
  id: string;
  agency: { id: string; name: string; logoUrl: string | null };
  listing: InquiryListingRef | null;
  status: InquiryStatus;
  /** Start of the latest message. */
  preview: string;
  replyCount: number;
  hasUnreadReply: boolean;
  lastMessageAt: string;
  createdAt: string;
}

/** GET /me/inquiries/:id */
export interface MyInquiryDetail {
  id: string;
  agency: { id: string; name: string; phone: string; logoUrl: string | null };
  listing: InquiryListingRef | null;
  status: InquiryStatus;
  name: string | null;
  phone: string | null;
  message: string;
  messages: InquiryMessageView[];
  createdAt: string;
}

/** POST /inquiries → 201 */
export interface InquiryCreated {
  id: string;
  createdAt: string;
  /** Sent by a signed-in member (the answer appears under MY > 문의 내역). */
  member: boolean;
}
