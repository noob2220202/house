// Owned by the admin module team.
import { z } from 'zod';
import {
  FaqCategory,
  ReportAction,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  SiteSettingKey,
} from '../enums/admin';
import { TermsType } from '../enums/user';
import {
  dateTimeSchema,
  idSchema,
  paginationQuerySchema,
  phoneSchema,
  regionCodeSchema,
} from './common';

export const reportCreateSchema = z.object({
  targetType: z.enum(ReportTargetType),
  targetId: idSchema,
  reason: z.enum(ReportReason),
  detail: z.string().trim().max(2000).optional(),
  reporterPhone: phoneSchema.optional(),
});
export type ReportCreateInput = z.infer<typeof reportCreateSchema>;

export const reportListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(ReportStatus).optional(),
  targetType: z.enum(ReportTargetType).optional(),
});

export const reportResolveSchema = z.object({
  status: z.enum([ReportStatus.IN_REVIEW, ReportStatus.RESOLVED, ReportStatus.REJECTED]),
  action: z.enum(ReportAction).default(ReportAction.NONE),
  note: z.string().trim().max(2000).optional(),
});

export const noticeInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().min(1).max(50_000),
  isPinned: z.boolean().default(false),
  isPublished: z.boolean().default(false),
});

export const faqInputSchema = z.object({
  category: z.enum(FaqCategory),
  question: z.string().trim().min(1).max(500),
  answer: z.string().min(1).max(20_000),
  isPublished: z.boolean().default(true),
});

export const localVideoInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  youtubeUrl: z.url().max(500),
  description: z.string().max(2000).optional(),
  regionCode: regionCodeSchema.optional(),
  complexId: idSchema.optional(),
  isPublished: z.boolean().default(true),
});

export const termsDocumentInputSchema = z.object({
  type: z.enum(TermsType),
  version: z.string().trim().min(1).max(20),
  title: z.string().trim().min(1).max(200),
  content: z.string().min(1).max(200_000),
  isRequired: z.boolean(),
  effectiveAt: dateTimeSchema,
});

/** 사업자 정보 (footer / 전자상거래법 표시사항). */
export const businessInfoSchema = z.object({
  companyName: z.string().max(100), // 상호
  ceoName: z.string().max(50), // 대표
  businessNumber: z.string().max(20), // 사업자등록번호
  mailOrderNumber: z.string().max(50).optional(), // 통신판매업 신고번호
  address: z.string().max(200),
  privacyOfficer: z.string().max(50), // 개인정보보호책임자
  phone: z.string().max(30),
  email: z.email().max(254),
});

export const siteSettingSchemas = {
  [SiteSettingKey.BUSINESS_INFO]: businessInfoSchema,
  [SiteSettingKey.CONTACT]: z.object({
    phone: z.string().max(30),
    email: z.email().max(254),
    hours: z.string().max(100).optional(),
    kakaoChannelUrl: z.url().optional(),
  }),
  [SiteSettingKey.SEO]: z.object({
    title: z.string().max(100),
    description: z.string().max(300),
    ogImageMediaId: idSchema.optional(),
  }),
  [SiteSettingKey.FEATURES]: z.record(z.string(), z.boolean()),
} as const satisfies Record<SiteSettingKey, z.ZodType>;

export const auditLogQuerySchema = paginationQuerySchema.extend({
  resourceType: z.string().max(50).optional(),
  resourceId: z.string().max(64).optional(),
  adminUserId: idSchema.optional(),
  from: dateTimeSchema.optional(),
  to: dateTimeSchema.optional(),
});
