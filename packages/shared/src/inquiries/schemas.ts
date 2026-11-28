// Owned by the inquiries module team. Request schemas (API validation + frontend forms).
import { z } from 'zod';
import {
  INQUIRY_CONTACT_CHANNELS,
  InquiryChannel,
  InquirySource,
  InquiryStatus,
} from '../enums/inquiry';
import { ACTION_CONSENT_TERMS } from '../enums/user';
import { actionConsentsSchema } from '../schemas/auth';
import { contactPhoneSchema, idSchema, queryBoolean } from '../schemas/common';
import { INQUIRY_LIMITS as L } from './constants';

const nonEmpty = (o: Record<string, unknown>) => Object.values(o).some((v) => v !== undefined);

/**
 * POST /inquiries — a written inquiry to an office (members and guests). A guest must leave a
 * phone number (INQUIRY_PHONE_REQUIRED, checked by the server, which alone knows whether the
 * caller is signed in). `website` is a honeypot the form hides from people: the server refuses any
 * non-empty value with INQUIRY_REJECTED (not a validation error, so a bot learns nothing).
 */
export const inquiryCreateSchema = z.object({
  agencyId: idSchema,
  /** The listing asked about; null/absent = the office itself (office page / site home). */
  listingId: idSchema.nullable().optional(),
  name: z
    .string()
    .trim()
    .min(1, '이름을 입력해 주세요.')
    .max(L.NAME_MAX, `이름은 ${L.NAME_MAX}자 이하로 입력해 주세요.`),
  /** Any Korean contact number (format only, never verified), stored as digits. */
  phone: contactPhoneSchema.nullable().optional(),
  message: z
    .string()
    .trim()
    .min(L.MESSAGE_MIN, `문의 내용을 ${L.MESSAGE_MIN}자 이상 입력해 주세요.`)
    .max(L.MESSAGE_MAX, `문의 내용은 ${L.MESSAGE_MAX}자 이하로 입력해 주세요.`),
  source: z.enum(InquirySource),
  /** 문의 개인정보 수집·이용 및 제공 동의 (INQUIRY_PRIVACY, current version) — required by the server. */
  consents: actionConsentsSchema(ACTION_CONSENT_TERMS.INQUIRY),
  /** Honeypot: must be empty or absent. */
  website: z.string().max(2000).optional(),
});
export type InquiryCreateInput = z.infer<typeof inquiryCreateSchema>;

/** POST /inquiries/contact-events — 전화 / 문자 / 번호 복사 pressed (no PII is sent or stored). */
export const inquiryContactEventSchema = z.object({
  agencyId: idSchema,
  listingId: idSchema.nullable().optional(),
  channel: z.enum(INQUIRY_CONTACT_CHANNELS),
  source: z.enum(InquirySource),
});
export type InquiryContactEventInput = z.infer<typeof inquiryContactEventSchema>;

/** GET /agency/inquiries — console inbox (newest lastMessageAt first). */
export const agencyInquiryListQuerySchema = z.object({
  status: z.enum(InquiryStatus).optional(),
  channel: z.enum(InquiryChannel).optional(),
  source: z.enum(InquirySource).optional(),
  /** true = only rows the office has not read yet. */
  unread: queryBoolean,
  /** Customer name / phone / message / listing title. */
  q: z.string().trim().min(1).max(L.SEARCH_MAX).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(L.PAGE_SIZE_MAX).default(L.PAGE_SIZE_DEFAULT),
});
export type AgencyInquiryListQuery = z.infer<typeof agencyInquiryListQuerySchema>;

/** PATCH /agency/inquiries/:id */
export const agencyInquiryUpdateSchema = z
  .object({
    status: z.enum(InquiryStatus).optional(),
    /** Internal note of the office (never shown to the customer); an empty string clears it. */
    memo: z
      .string()
      .trim()
      .max(L.MEMO_MAX, `메모는 ${L.MEMO_MAX}자 이하로 입력해 주세요.`)
      .transform((s) => (s === '' ? null : s))
      .nullable()
      .optional(),
    read: z.boolean().optional(),
  })
  .refine(nonEmpty, { message: '변경할 항목을 입력해 주세요.' });
export type AgencyInquiryUpdateInput = z.infer<typeof agencyInquiryUpdateSchema>;

/**
 * POST /agency/inquiries/:id/replies (the office's answer) and POST /me/inquiries/:id/messages
 * (the member's follow-up).
 */
export const inquiryReplySchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, '내용을 입력해 주세요.')
    .max(L.REPLY_MAX, `내용은 ${L.REPLY_MAX}자 이하로 입력해 주세요.`),
});
export type InquiryReplyInput = z.infer<typeof inquiryReplySchema>;

/** POST /agency/inquiries/read — marks every inquiry of the office read. */
export const agencyInquiryReadAllSchema = z.object({ all: z.literal(true) });
export type AgencyInquiryReadAllInput = z.infer<typeof agencyInquiryReadAllSchema>;

/** DELETE /agency/inquiries/:id — soft delete (스팸 처리 / 정리); the body may be absent. */
export const agencyInquiryDeleteSchema = z.preprocess(
  (v) => v ?? {},
  z.object({
    reason: z
      .string()
      .trim()
      .max(L.DELETE_REASON_MAX, `사유는 ${L.DELETE_REASON_MAX}자 이하로 입력해 주세요.`)
      .optional(),
  }),
);
export type AgencyInquiryDeleteInput = z.infer<typeof agencyInquiryDeleteSchema>;
