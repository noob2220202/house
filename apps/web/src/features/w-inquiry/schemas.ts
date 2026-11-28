import {
  AssetType,
  DealType,
  InquiryAuthor,
  InquiryStatus,
  type InquiryCreated,
  type InquiryListingRef,
  type InquiryMessageView,
  type MyInquiryDetail,
  type MyInquiryListItem,
} from '@house/shared';
import { z } from 'zod';

/**
 * Response shapes of the inquiries API (packages/shared/src/inquiries/types.ts) as the web parses
 * them. Each response is parsed by exactly one schema below; the mock handlers under
 * `app/mock-api/v1/{inquiries,me/inquiries,agency/inquiries}` answer the same shapes.
 * Optional extras default instead of failing, so an additive API change never breaks a page.
 */

const nullableString = z.string().nullable().default(null);
const nullableNumber = z.number().nullable().default(null);

/** `InquiryListingRef` — the listing an inquiry is about (compact card). Money in 만원. */
export const inquiryListingRefSchema = z.object({
  id: z.string(),
  title: z.string(),
  assetType: z.enum(AssetType),
  dealType: z.enum(DealType),
  salePrice: nullableNumber,
  deposit: nullableNumber,
  monthlyRent: nullableNumber,
  presalePrice: nullableNumber,
  coverPhotoUrl: nullableString,
}) satisfies z.ZodType<InquiryListingRef, unknown>;
export type InquiryListing = z.infer<typeof inquiryListingRefSchema>;

/** `InquiryMessageView` — a follow-up or reply (the opening text is the inquiry's `message`). */
export const inquiryMessageSchema = z.object({
  id: z.string(),
  author: z.enum(InquiryAuthor),
  body: z.string(),
  authorName: nullableString,
  createdAt: z.string(),
}) satisfies z.ZodType<InquiryMessageView, unknown>;
export type InquiryMessage = z.infer<typeof inquiryMessageSchema>;

/** POST /inquiries → 201 `InquiryCreated`. */
export const inquiryCreatedSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  member: z.boolean(),
}) satisfies z.ZodType<InquiryCreated, unknown>;

const myInquiryAgencySchema = z.object({
  id: z.string(),
  name: z.string(),
  logoUrl: nullableString,
});

/** Row of GET /me/inquiries (`MyInquiryListItem`). */
export const myInquiryListItemSchema = z.object({
  id: z.string(),
  agency: myInquiryAgencySchema,
  listing: inquiryListingRefSchema.nullable().default(null),
  status: z.enum(InquiryStatus).catch(InquiryStatus.NEW),
  preview: z.string().default(''),
  replyCount: z.number().default(0),
  hasUnreadReply: z.boolean().default(false),
  lastMessageAt: z.string(),
  createdAt: z.string(),
}) satisfies z.ZodType<MyInquiryListItem, unknown>;
export type MyInquiryItem = z.infer<typeof myInquiryListItemSchema>;

export const myInquiryPageSchema = z.object({
  items: z.array(myInquiryListItemSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});
export type MyInquiryPage = z.infer<typeof myInquiryPageSchema>;

/** GET /me/inquiries/:id (`MyInquiryDetail`) — opening it marks the office's replies read. */
export const myInquiryDetailSchema = z.object({
  id: z.string(),
  agency: myInquiryAgencySchema.extend({ phone: z.string().default('') }),
  listing: inquiryListingRefSchema.nullable().default(null),
  status: z.enum(InquiryStatus).catch(InquiryStatus.NEW),
  name: nullableString,
  phone: nullableString,
  message: z.string(),
  messages: z.array(inquiryMessageSchema).default([]),
  createdAt: z.string(),
  /**
   * Whether POST /me/inquiries/:id/messages would take a follow-up (the office is still approved
   * and retention has not erased the thread). Optional until the API sends it: without it the
   * thread view derives the erased case (`message` is empty) and learns the rest from a 409.
   */
  canFollowUp: z.boolean().optional(),
}) satisfies z.ZodType<MyInquiryDetail, unknown>;
export type MyInquiry = z.infer<typeof myInquiryDetailSchema>;
