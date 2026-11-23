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

// ---------- 게시물 본문 형식 (공지·FAQ·약관) ----------

/**
 * Notice content, FAQ answers and terms content are **Markdown without raw HTML** (CommonMark/GFM).
 * Frontends must render them with a Markdown renderer that does not pass raw HTML through
 * (e.g. react-markdown without rehype-raw, keeping its default urlTransform) and must never put
 * them into dangerouslySetInnerHTML. The checks below enforce the same contract on write, so a
 * low-privilege operator cannot store markup that would run in a SUPER_ADMIN's session even if a
 * renderer is misconfigured.
 */
export const ADMIN_CONTENT_FORMAT = 'markdown' as const;

/** The HTML tokenizer opens a tag (or comment / doctype / PI) at `<` + letter, `/`, `!` or `?`. */
const HTML_TAG_OPEN = /<[A-Za-z!/?]/;

const NAMED_ENTITIES: Record<string, string> = {
  colon: ':',
  tab: '\t',
  newline: '\n',
  sol: '/',
  amp: '&',
  lpar: '(',
  rpar: ')',
};

const codePoint = (n: number): string =>
  Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '\ufffd';

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (m, body: string) => {
    const lower = body.toLowerCase();
    if (lower.startsWith('#x')) return codePoint(parseInt(lower.slice(2), 16));
    if (lower.startsWith('#')) return codePoint(parseInt(lower.slice(1), 10));
    return NAMED_ENTITIES[lower] ?? m;
  });
}

const SAFE_LINK_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);

/** A Markdown link destination is safe when it is relative or uses http(s)/mailto/tel. */
export function isSafeMarkdownLink(destination: string): boolean {
  // Entities are decoded inside link destinations; browsers drop control chars and whitespace.
  // eslint-disable-next-line no-control-regex
  const url = decodeEntities(destination).replace(/[\u0000-\u0020\u007f]/g, '');
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url);
  return !scheme || SAFE_LINK_SCHEMES.has((scheme[1] ?? '').toLowerCase());
}

/** Destinations of inline links/images `[x](dest "title")` and reference definitions `[x]: dest`. */
const LINK_DESTINATIONS = [/\]\(\s*<?([^\s)>]*)/g, /^[ \t]{0,3}\[[^\]\n]+\]:[ \t]*<?([^\s>]*)/gm];

/** Problems with a Markdown body (empty when it is acceptable). */
export function markdownContentIssues(value: string): string[] {
  const issues: string[] = [];
  if (HTML_TAG_OPEN.test(value)) {
    issues.push('HTML 태그는 사용할 수 없습니다. 마크다운으로 작성해 주세요.');
  }
  const unsafe = LINK_DESTINATIONS.some((re) =>
    [...value.matchAll(re)].some((m) => !isSafeMarkdownLink(m[1] ?? '')),
  );
  if (unsafe) issues.push('링크는 http(s)·mailto·tel 또는 사이트 내부 주소만 사용할 수 있습니다.');
  return issues;
}

/** Markdown body (no raw HTML, safe links only). */
export function markdownContentSchema(max: number) {
  return z
    .string()
    .min(1)
    .max(max)
    .superRefine((value, ctx) => {
      for (const message of markdownContentIssues(value)) ctx.addIssue({ code: 'custom', message });
    });
}

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
  /** Markdown (ADMIN_CONTENT_FORMAT) */
  content: markdownContentSchema(50_000),
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
  /** Markdown (ADMIN_CONTENT_FORMAT) */
  answer: markdownContentSchema(20_000),
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
  /** Markdown (ADMIN_CONTENT_FORMAT) */
  content: markdownContentSchema(200_000),
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

/**
 * POST /admin/terms/:id/publish. A new version of an already published type must be published at
 * least TERMS_NOTICE_DAYS before it takes effect (사전 공지); `urgent` + `reason` overrides that
 * (e.g. a change forced by law) and is recorded in the audit log. Never retroactive.
 */
export const termsPublishSchema = z.preprocess(
  (v) => v ?? {},
  z
    .object({
      urgent: z.boolean().default(false),
      reason: z.string().trim().min(5).max(500).optional(),
    })
    .refine((v) => !v.urgent || v.reason !== undefined, {
      message: '긴급 게시 사유를 5자 이상 입력해 주세요.',
      path: ['reason'],
    }),
);
export type TermsPublishInput = z.infer<typeof termsPublishSchema>;

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
