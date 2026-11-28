// Owned by the agencies module team. Request schemas of 사무소 홈페이지 and office subscriptions.
import { z } from 'zod';
import { AgencySiteStatus, SubscriptionProduct } from '../enums/agency';
import { paginationQuerySchema } from '../schemas/common';
import { AGENCY_SITE_TAGLINE_MAX, agencySiteColorSchema, siteSlugSchema } from './site';

const nonEmpty = (o: Record<string, unknown>) => Object.values(o).some((v) => v !== undefined);

/** 한 줄 소개: trimmed; an empty string clears it (→ null). */
const taglineSchema = z
  .string()
  .trim()
  .max(AGENCY_SITE_TAGLINE_MAX, `한 줄 소개는 ${AGENCY_SITE_TAGLINE_MAX}자 이하로 입력해 주세요.`)
  .transform((s) => (s === '' ? null : s))
  .nullable()
  .optional();

/**
 * POST /agencies/mine/site — the owner requests (or re-requests / changes a pending request for)
 * an office site at `<slug>.<root domain>`.
 */
export const agencySiteRequestSchema = z.object({
  slug: siteSlugSchema,
  color: agencySiteColorSchema.optional(),
  tagline: taglineSchema,
});
export type AgencySiteRequestInput = z.infer<typeof agencySiteRequestSchema>;

/** PATCH /agencies/mine/site — brand colour and 한 줄 소개 (the slug changes only by request). */
export const agencySiteUpdateSchema = z
  .object({
    color: agencySiteColorSchema.optional(),
    tagline: taglineSchema,
  })
  .refine(nonEmpty, { message: '변경할 항목을 입력해 주세요.' });
export type AgencySiteUpdateInput = z.infer<typeof agencySiteUpdateSchema>;

/**
 * GET /agencies/mine/site/availability?slug= — raw input on purpose: the answer says why a slug
 * is unusable (`SiteSlugAvailability.reason`) instead of failing validation.
 */
export const agencySiteAvailabilityQuerySchema = z.object({
  slug: z.string().trim().min(1, '홈페이지 주소를 입력해 주세요.').max(100),
});
export type AgencySiteAvailabilityQuery = z.infer<typeof agencySiteAvailabilityQuerySchema>;

// ---------- admin ----------

export const AgencySiteDecisionAction = {
  /** REQUESTED → ACTIVE (slug = body.slug ?? requestedSlug). */
  APPROVE: 'APPROVE',
  /** REQUESTED → REJECTED (reason required). */
  REJECT: 'REJECT',
  /** ACTIVE → SUSPENDED (reason required). */
  SUSPEND: 'SUSPEND',
  /** SUSPENDED → ACTIVE. */
  RESUME: 'RESUME',
} as const;
export type AgencySiteDecisionAction =
  (typeof AgencySiteDecisionAction)[keyof typeof AgencySiteDecisionAction];

export const AGENCY_SITE_DECISION_ACTION_LABEL: Record<AgencySiteDecisionAction, string> = {
  APPROVE: '승인',
  REJECT: '반려',
  SUSPEND: '정지',
  RESUME: '정지 해제',
};

export const AGENCY_SITE_DECISION_REASON_MAX = 500;

/** POST /admin/agencies/:id/site/decision */
export const adminAgencySiteDecisionSchema = z
  .object({
    action: z.enum(AgencySiteDecisionAction),
    /** APPROVE only: the slug to grant when it differs from the requested one. */
    slug: siteSlugSchema.optional(),
    reason: z
      .string()
      .trim()
      .max(
        AGENCY_SITE_DECISION_REASON_MAX,
        `사유는 ${AGENCY_SITE_DECISION_REASON_MAX}자 이하로 입력해 주세요.`,
      )
      // Blank = no reason (then required for REJECT / SUSPEND below).
      .transform((s) => (s === '' ? undefined : s))
      .optional(),
  })
  .superRefine((d, ctx) => {
    if (d.slug !== undefined && d.action !== AgencySiteDecisionAction.APPROVE) {
      ctx.addIssue({
        code: 'custom',
        path: ['slug'],
        message: '주소는 승인할 때만 바꿀 수 있습니다.',
      });
    }
    const needsReason =
      d.action === AgencySiteDecisionAction.REJECT || d.action === AgencySiteDecisionAction.SUSPEND;
    if (needsReason && !d.reason) {
      ctx.addIssue({
        code: 'custom',
        path: ['reason'],
        message: '반려·정지 사유를 입력해 주세요.',
      });
    }
  });
export type AdminAgencySiteDecisionInput = z.infer<typeof adminAgencySiteDecisionSchema>;

/** GET /admin/agency-sites — REQUESTED is listed oldest request first. */
export const adminAgencySiteListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(AgencySiteStatus).optional(),
  /** Office name, 대표 or slug. */
  q: z.string().trim().min(1).max(50).optional(),
});
export type AdminAgencySiteListQuery = z.infer<typeof adminAgencySiteListQuerySchema>;

export const AGENCY_SUBSCRIPTION_MEMO_MAX = 500;
/** Upper bound of a recorded amount (원): 10억, far above any real fee. */
export const AGENCY_SUBSCRIPTION_AMOUNT_MAX = 1_000_000_000;

const subscriptionDate = z.iso.date({ error: '날짜는 YYYY-MM-DD 형식으로 입력해 주세요.' });
const memoSchema = z
  .string()
  .trim()
  .max(
    AGENCY_SUBSCRIPTION_MEMO_MAX,
    `메모는 ${AGENCY_SUBSCRIPTION_MEMO_MAX}자 이하로 입력해 주세요.`,
  )
  .transform((s) => (s === '' ? null : s))
  .nullable()
  .optional();

/** POST /admin/agencies/:id/subscriptions — records a period paid offline (bank transfer). */
export const adminSubscriptionCreateSchema = z
  .object({
    product: z.enum(SubscriptionProduct),
    startsOn: subscriptionDate,
    /** Inclusive last day; null/absent = open-ended. */
    endsOn: subscriptionDate.nullable().optional(),
    /** Amount received in 원 (not 만원); null = free / not recorded. */
    amountWon: z
      .int('금액은 원 단위 정수로 입력해 주세요.')
      .min(0, '금액은 0원 이상이어야 합니다.')
      .max(
        AGENCY_SUBSCRIPTION_AMOUNT_MAX,
        `금액은 ${AGENCY_SUBSCRIPTION_AMOUNT_MAX / 100_000_000}억 원 이하로 입력해 주세요.`,
      )
      .nullable()
      .optional(),
    memo: memoSchema,
  })
  .refine((s) => !s.endsOn || s.endsOn >= s.startsOn, {
    message: '종료일은 시작일과 같거나 그 이후여야 합니다.',
    path: ['endsOn'],
  });
export type AdminSubscriptionCreateInput = z.infer<typeof adminSubscriptionCreateSchema>;

/**
 * PATCH /admin/subscriptions/:id — end (endsOn), edit the memo, or cancel. The server checks
 * endsOn ≥ startsOn (AGENCY_SUBSCRIPTION_INVALID_PERIOD).
 */
export const adminSubscriptionUpdateSchema = z
  .object({
    endsOn: subscriptionDate.nullable().optional(),
    memo: memoSchema,
    cancel: z.literal(true).optional(),
  })
  .refine(nonEmpty, { message: '변경할 항목을 입력해 주세요.' });
export type AdminSubscriptionUpdateInput = z.infer<typeof adminSubscriptionUpdateSchema>;
