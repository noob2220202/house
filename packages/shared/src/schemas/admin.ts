// Owned by the admin module team. Content, reports, terms, site settings, audit log.
// Back-office-only schemas (admin accounts, members, listing moderation) live in ../admin.
import { z } from 'zod';
import {
  AuditActorType,
  FaqCategory,
  ReportAction,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  SiteSettingKey,
} from '../enums/admin';
import { TermsType } from '../enums/user';
import { parseYoutubeVideoId } from '../utils/url';
import {
  dateTimeSchema,
  idSchema,
  linkUrlSchema,
  paginationQuerySchema,
  phoneSchema,
  queryBoolean,
  regionCodeSchema,
} from './common';

// ---------- 허위매물 신고 ----------

export const reportCreateSchema = z
  .object({
    targetType: z.enum(ReportTargetType),
    targetId: idSchema,
    reason: z.enum(ReportReason),
    detail: z.string().trim().max(2000).optional(),
    /** Optional callback number typed by the reporter (format-checked only, never verified). */
    reporterPhone: phoneSchema.optional(),
  })
  .refine((v) => v.reason !== ReportReason.OTHER || (v.detail?.length ?? 0) >= 5, {
    message: '기타 사유는 내용을 5자 이상 입력해 주세요.',
    path: ['detail'],
  });
export type ReportCreateInput = z.infer<typeof reportCreateSchema>;

export const reportListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(ReportStatus).optional(),
  targetType: z.enum(ReportTargetType).optional(),
  reason: z.enum(ReportReason).optional(),
  listingId: idSchema.optional(),
  agencyId: idSchema.optional(),
});
export type ReportListQuery = z.infer<typeof reportListQuerySchema>;

/** PATCH /admin/reports/:id — take a report into review and/or update the internal note. */
export const reportReviewSchema = z
  .object({
    status: z.literal(ReportStatus.IN_REVIEW).optional(),
    note: z.string().trim().max(2000).optional(),
  })
  .refine((v) => v.status !== undefined || v.note !== undefined, '변경할 내용을 입력해 주세요.');
export type ReportReviewInput = z.infer<typeof reportReviewSchema>;

/** POST /admin/reports/:id/resolve — final decision (RESOLVED with an action, or REJECTED). */
export const reportResolveSchema = z
  .object({
    status: z.enum([ReportStatus.RESOLVED, ReportStatus.REJECTED]),
    action: z.enum(ReportAction).default(ReportAction.NONE),
    note: z.string().trim().max(2000).optional(),
  })
  .refine((v) => v.status !== ReportStatus.REJECTED || v.action === ReportAction.NONE, {
    message: '반려 시에는 조치를 선택할 수 없습니다.',
    path: ['action'],
  });
export type ReportResolveInput = z.infer<typeof reportResolveSchema>;

// ---------- 공지사항 ----------

const noticeShape = {
  title: z.string().trim().min(1).max(200),
  content: z.string().min(1).max(50_000),
  isPinned: z.boolean(),
  isPublished: z.boolean(),
};
export const noticeInputSchema = z.object({
  ...noticeShape,
  isPinned: noticeShape.isPinned.default(false),
  isPublished: noticeShape.isPublished.default(false),
});
export type NoticeInput = z.infer<typeof noticeInputSchema>;
export const noticeUpdateSchema = z
  .object(noticeShape)
  .partial()
  .refine((v) => Object.keys(v).length > 0, '변경할 내용을 입력해 주세요.');
export type NoticeUpdateInput = z.infer<typeof noticeUpdateSchema>;

export const noticeAdminListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(100).optional(),
  isPublished: queryBoolean,
});
export type NoticeAdminListQuery = z.infer<typeof noticeAdminListQuerySchema>;

// ---------- FAQ ----------

const faqShape = {
  category: z.enum(FaqCategory),
  question: z.string().trim().min(1).max(500),
  answer: z.string().min(1).max(20_000),
  isPublished: z.boolean(),
  sortOrder: z.int().min(0).max(100_000),
};
export const faqInputSchema = z.object({
  ...faqShape,
  isPublished: faqShape.isPublished.default(true),
  sortOrder: faqShape.sortOrder.optional(),
});
export type FaqInput = z.infer<typeof faqInputSchema>;
export const faqUpdateSchema = z
  .object(faqShape)
  .partial()
  .refine((v) => Object.keys(v).length > 0, '변경할 내용을 입력해 주세요.');
export type FaqUpdateInput = z.infer<typeof faqUpdateSchema>;

/** PUT /admin/faqs/order — FAQ ids in their new display order (sortOrder = index). */
export const faqOrderSchema = z.object({
  ids: z
    .array(idSchema)
    .min(1)
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length, '중복된 항목이 있습니다.'),
});
export type FaqOrderInput = z.infer<typeof faqOrderSchema>;

export const faqListQuerySchema = paginationQuerySchema.extend({
  category: z.enum(FaqCategory).optional(),
  q: z.string().trim().min(1).max(100).optional(),
});
export type FaqListQuery = z.infer<typeof faqListQuerySchema>;
export const faqAdminListQuerySchema = faqListQuerySchema.extend({ isPublished: queryBoolean });
export type FaqAdminListQuery = z.infer<typeof faqAdminListQuerySchema>;

// ---------- 지역 영상 (YouTube) ----------

/** YouTube watch / youtu.be / embed / shorts / live URL (https only). */
export const youtubeUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (u) => u.startsWith('https://') && parseYoutubeVideoId(u) !== null,
    '올바른 YouTube 영상 주소가 아닙니다.',
  );

const localVideoShape = {
  title: z.string().trim().min(1).max(200),
  youtubeUrl: youtubeUrlSchema,
  description: z.string().trim().max(2000).nullable(),
  regionCode: regionCodeSchema.nullable(),
  complexId: idSchema.nullable(),
  sortOrder: z.int().min(0).max(100_000),
  isPublished: z.boolean(),
};
export const localVideoInputSchema = z.object({
  ...localVideoShape,
  description: localVideoShape.description.optional(),
  regionCode: localVideoShape.regionCode.optional(),
  complexId: localVideoShape.complexId.optional(),
  sortOrder: localVideoShape.sortOrder.default(0),
  isPublished: localVideoShape.isPublished.default(true),
});
export type LocalVideoInput = z.infer<typeof localVideoInputSchema>;
export const localVideoUpdateSchema = z
  .object(localVideoShape)
  .partial()
  .refine((v) => Object.keys(v).length > 0, '변경할 내용을 입력해 주세요.');
export type LocalVideoUpdateInput = z.infer<typeof localVideoUpdateSchema>;

export const localVideoListQuerySchema = paginationQuerySchema.extend({
  regionCode: regionCodeSchema.optional(),
  complexId: idSchema.optional(),
});
export type LocalVideoListQuery = z.infer<typeof localVideoListQuerySchema>;
export const localVideoAdminListQuerySchema = localVideoListQuerySchema.extend({
  isPublished: queryBoolean,
  q: z.string().trim().min(1).max(100).optional(),
});
export type LocalVideoAdminListQuery = z.infer<typeof localVideoAdminListQuerySchema>;

// ---------- 약관 ----------

const termsShape = {
  type: z.enum(TermsType),
  version: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[0-9A-Za-z._-]+$/, '버전은 영문·숫자·.-_ 만 사용할 수 있습니다.'),
  title: z.string().trim().min(1).max(200),
  content: z.string().min(1).max(200_000),
  isRequired: z.boolean(),
  effectiveAt: dateTimeSchema,
};
export const termsDocumentInputSchema = z.object(termsShape);
export type TermsDocumentInput = z.infer<typeof termsDocumentInputSchema>;
/** Drafts only; `type` is fixed once created. */
export const termsDocumentUpdateSchema = z
  .object(termsShape)
  .omit({ type: true })
  .partial()
  .refine((v) => Object.keys(v).length > 0, '변경할 내용을 입력해 주세요.');
export type TermsDocumentUpdateInput = z.infer<typeof termsDocumentUpdateSchema>;

export const termsAdminListQuerySchema = paginationQuerySchema.extend({
  type: z.enum(TermsType).optional(),
  published: queryBoolean,
});
export type TermsAdminListQuery = z.infer<typeof termsAdminListQuerySchema>;

// ---------- 사이트 설정 ----------

/** 사업자 정보 (footer / 전자상거래법 표시사항). */
export const businessInfoSchema = z.object({
  companyName: z.string().trim().min(1).max(100), // 상호
  ceoName: z.string().trim().min(1).max(50), // 대표
  businessNumber: z
    .string()
    .trim()
    .regex(/^\d{3}-?\d{2}-?\d{5}$/, '사업자등록번호 형식이 올바르지 않습니다.'), // 사업자등록번호
  mailOrderNumber: z.string().trim().max(50).optional(), // 통신판매업 신고번호
  address: z.string().trim().min(1).max(200),
  privacyOfficer: z.string().trim().min(1).max(50), // 개인정보보호책임자
  phone: z.string().trim().min(1).max(30),
  email: z.email().max(254),
});
export type BusinessInfo = z.infer<typeof businessInfoSchema>;

export const footerSettingSchema = z.object({
  links: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(50),
        url: linkUrlSchema,
        newWindow: z.boolean().default(false),
      }),
    )
    .max(20)
    .default([]),
  copyright: z.string().trim().max(200).optional(),
  disclaimer: z.string().trim().max(2000).optional(),
});
export type FooterSetting = z.infer<typeof footerSettingSchema>;

export const siteSettingSchemas = {
  [SiteSettingKey.BUSINESS_INFO]: businessInfoSchema,
  [SiteSettingKey.CONTACT]: z.object({
    phone: z.string().trim().min(1).max(30),
    email: z.email().max(254),
    hours: z.string().trim().max(100).optional(),
    kakaoChannelUrl: linkUrlSchema.optional(),
  }),
  [SiteSettingKey.SEO]: z.object({
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().max(300),
    ogImageMediaId: idSchema.optional(),
  }),
  [SiteSettingKey.FEATURES]: z.record(z.string().regex(/^[a-zA-Z][\w.-]{0,49}$/), z.boolean()),
  [SiteSettingKey.FOOTER]: footerSettingSchema,
} as const satisfies Record<SiteSettingKey, z.ZodType>;
export type SiteSettingValue<K extends SiteSettingKey> = z.output<(typeof siteSettingSchemas)[K]>;

export const siteSettingKeyParamSchema = z.object({ key: z.enum(SiteSettingKey) });

// ---------- 감사 로그 ----------

export const auditLogQuerySchema = paginationQuerySchema.extend({
  /** Exact action ("report.resolve") or a prefix ending in "." ("report."). */
  action: z
    .string()
    .trim()
    .max(100)
    .regex(/^[\w.:-]+$/)
    .optional(),
  actorType: z.enum(AuditActorType).optional(),
  resourceType: z.string().max(50).optional(),
  resourceId: z.string().max(64).optional(),
  adminUserId: idSchema.optional(),
  from: dateTimeSchema.optional(),
  to: dateTimeSchema.optional(),
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
