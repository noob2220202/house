// Owned by the ads module team.
import { z } from 'zod';
import { isSafeAdLinkUrl } from '../ads/link';
import { BANNER_SLOT_SPECS, POPUP_MAX_DISMISS_DAYS } from '../constants/ads';
import { BannerSlot, BannerStatus, BannerTargeting, PopupPage } from '../enums/ads';
import {
  dateOnlySchema,
  dateTimeSchema,
  idSchema,
  paginationQuerySchema,
  regionCodeSchema,
} from './common';

/** Max ids per reorder request / targeting list / impression batch. */
export const ADS_LIMITS = {
  REORDER_MAX: 200,
  TARGETS_MAX: 100,
  IMPRESSION_BATCH_MAX: 20,
  STATS_MAX_DAYS: 366,
  POPUP_TARGET_PAGES_MAX: 10,
} as const;

/** https:// URL or a site-relative path (see isSafeAdLinkUrl). */
export const adLinkUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .refine(isSafeAdLinkUrl, '링크는 https:// 주소 또는 /로 시작하는 사이트 내부 경로만 허용됩니다.');

const uniq = <T extends z.ZodType>(item: T, max: number) =>
  z
    .array(item)
    .max(max)
    .transform((a) => [...new Set(a)] as z.output<T>[]);

const titleSchema = z.string().trim().min(1).max(100);
const optionalText = (max: number) => z.string().trim().max(max);

const bannerFields = {
  slot: z.enum(BannerSlot),
  title: titleSchema,
  advertiserName: optionalText(100),
  agencyId: idSchema,
  pcMediaId: idSchema,
  mobileMediaId: idSchema,
  linkUrl: adLinkUrlSchema,
  newWindow: z.boolean(),
  startAt: dateTimeSchema,
  endAt: dateTimeSchema,
  paused: z.boolean(),
  priority: z.int().min(0).max(1000),
  targeting: z.enum(BannerTargeting),
  targetRegionCodes: uniq(regionCodeSchema, ADS_LIMITS.TARGETS_MAX),
  targetComplexIds: uniq(idSchema, ADS_LIMITS.TARGETS_MAX),
  memo: optionalText(1000),
};

interface WindowLike {
  startAt?: string | undefined;
  endAt?: string | undefined;
}
interface TargetingLike {
  targeting?: BannerTargeting | undefined;
  targetRegionCodes?: string[] | undefined;
  targetComplexIds?: string[] | undefined;
}

/** Shared cross-field rules; the API re-runs them on the merged row for PATCH. */
export function checkAdWindow(v: WindowLike, ctx: z.RefinementCtx): void {
  if (v.startAt && v.endAt && Date.parse(v.startAt) >= Date.parse(v.endAt)) {
    ctx.addIssue({
      code: 'custom',
      path: ['endAt'],
      message: '종료일시는 시작일시 이후여야 합니다.',
    });
  }
}

export function checkBannerTargeting(v: TargetingLike, ctx: z.RefinementCtx): void {
  const regions = v.targetRegionCodes ?? [];
  const complexes = v.targetComplexIds ?? [];
  if (v.targeting === BannerTargeting.REGIONS && regions.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['targetRegionCodes'],
      message: '지역 타게팅에는 지역을 1개 이상 선택해야 합니다.',
    });
  }
  if (v.targeting === BannerTargeting.COMPLEXES && complexes.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['targetComplexIds'],
      message: '단지 타게팅에는 단지를 1개 이상 선택해야 합니다.',
    });
  }
  if (v.targeting !== BannerTargeting.REGIONS && regions.length > 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['targetRegionCodes'],
      message: '지역 타게팅이 아닐 때는 지역을 지정할 수 없습니다.',
    });
  }
  if (v.targeting !== BannerTargeting.COMPLEXES && complexes.length > 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['targetComplexIds'],
      message: '단지 타게팅이 아닐 때는 단지를 지정할 수 없습니다.',
    });
  }
}

interface SlotRulesLike {
  slot: BannerSlot;
  agencyId?: string | null | undefined;
  targeting?: BannerTargeting | undefined;
}

/** What the slot means (BANNER_SLOT_SPECS): mandatory advertiser agency and/or targeting. */
export function checkBannerSlotRules(v: SlotRulesLike, ctx: z.RefinementCtx): void {
  const spec = BANNER_SLOT_SPECS[v.slot];
  if (spec.requiresAgency && !v.agencyId) {
    ctx.addIssue({
      code: 'custom',
      path: ['agencyId'],
      message: `'${spec.label}' 영역 배너에는 광고주 중개사무소를 지정해야 합니다.`,
    });
  }
  if (spec.requiredTargeting && v.targeting !== spec.requiredTargeting) {
    const label = spec.requiredTargeting === BannerTargeting.COMPLEXES ? '단지' : '지역';
    ctx.addIssue({
      code: 'custom',
      path: ['targeting'],
      message: `'${spec.label}' 영역 배너는 ${label} 타게팅만 사용할 수 있습니다.`,
    });
  }
}

export const bannerCreateSchema = z
  .object({
    ...bannerFields,
    advertiserName: bannerFields.advertiserName.optional(),
    agencyId: bannerFields.agencyId.optional(),
    mobileMediaId: bannerFields.mobileMediaId.optional(),
    linkUrl: bannerFields.linkUrl.optional(),
    memo: bannerFields.memo.optional(),
    newWindow: bannerFields.newWindow.default(false),
    paused: bannerFields.paused.default(false),
    priority: bannerFields.priority.default(0),
    targeting: bannerFields.targeting.default(BannerTargeting.ALL),
    targetRegionCodes: bannerFields.targetRegionCodes.default([]),
    targetComplexIds: bannerFields.targetComplexIds.default([]),
  })
  .superRefine((v, ctx) => {
    checkAdWindow(v, ctx);
    checkBannerTargeting(v, ctx);
    checkBannerSlotRules(v, ctx);
  });
export type BannerCreateInput = z.output<typeof bannerCreateSchema>;

/** PATCH: every field optional; nullable fields accept null to clear. Slot is immutable. */
export const bannerUpdateSchema = z
  .object({
    title: bannerFields.title.optional(),
    advertiserName: bannerFields.advertiserName.nullable().optional(),
    agencyId: bannerFields.agencyId.nullable().optional(),
    pcMediaId: bannerFields.pcMediaId.optional(),
    mobileMediaId: bannerFields.mobileMediaId.nullable().optional(),
    linkUrl: bannerFields.linkUrl.nullable().optional(),
    newWindow: bannerFields.newWindow.optional(),
    startAt: bannerFields.startAt.optional(),
    endAt: bannerFields.endAt.optional(),
    paused: bannerFields.paused.optional(),
    priority: bannerFields.priority.optional(),
    targeting: bannerFields.targeting.optional(),
    targetRegionCodes: bannerFields.targetRegionCodes.optional(),
    targetComplexIds: bannerFields.targetComplexIds.optional(),
    memo: bannerFields.memo.nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, '변경할 항목이 없습니다.')
  .superRefine((v, ctx) => checkAdWindow(v, ctx));
export type BannerUpdateInput = z.output<typeof bannerUpdateSchema>;

export const bannerReorderSchema = z.object({
  slot: z.enum(BannerSlot),
  ids: uniq(idSchema, ADS_LIMITS.REORDER_MAX).pipe(z.array(idSchema).min(1)),
});
export type BannerReorderInput = z.output<typeof bannerReorderSchema>;

export const popupReorderSchema = z.object({
  ids: uniq(idSchema, ADS_LIMITS.REORDER_MAX).pipe(z.array(idSchema).min(1)),
});
export type PopupReorderInput = z.output<typeof popupReorderSchema>;

const searchText = z.string().trim().min(1).max(100).optional();

export const adminBannerListQuerySchema = paginationQuerySchema.extend({
  slot: z.enum(BannerSlot).optional(),
  status: z.enum(BannerStatus).optional(),
  agencyId: idSchema.optional(),
  q: searchText,
});
export type AdminBannerListQuery = z.output<typeof adminBannerListQuerySchema>;

export const bannerSlotParamSchema = z.object({ slot: z.enum(BannerSlot) });

export const bannerSlotUpdateSchema = z
  .object({
    maxActive: z.int().min(0).max(100).optional(),
    isEnabled: z.boolean().optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, '변경할 항목이 없습니다.');
export type BannerSlotUpdateInput = z.output<typeof bannerSlotUpdateSchema>;

/** Stats range in KST dates; defaults (last 30 days) are applied by the API. */
export const bannerStatsQuerySchema = z
  .object({ from: dateOnlySchema.optional(), to: dateOnlySchema.optional() })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: '시작일은 종료일보다 늦을 수 없습니다.',
    path: ['from'],
  });
export type BannerStatsQuery = z.output<typeof bannerStatsQuerySchema>;

export const bannerServeQuerySchema = z.object({
  slot: z.enum(BannerSlot),
  regionCode: regionCodeSchema.optional(),
  complexId: idSchema.optional(),
});
export type BannerServeQuery = z.output<typeof bannerServeQuerySchema>;

export const bannerImpressionBatchSchema = z.object({
  ids: uniq(idSchema, ADS_LIMITS.IMPRESSION_BATCH_MAX).pipe(z.array(idSchema).min(1)),
});
export type BannerImpressionBatchInput = z.output<typeof bannerImpressionBatchSchema>;

const popupFields = {
  title: titleSchema,
  mediaId: idSchema,
  linkUrl: adLinkUrlSchema,
  newWindow: z.boolean(),
  targetPages: uniq(z.enum(PopupPage), ADS_LIMITS.POPUP_TARGET_PAGES_MAX).pipe(
    z.array(z.enum(PopupPage)).min(1, '노출 페이지를 1개 이상 선택해야 합니다.'),
  ),
  startAt: dateTimeSchema,
  endAt: dateTimeSchema,
  paused: z.boolean(),
  dismissDays: z.int().min(0).max(POPUP_MAX_DISMISS_DAYS),
};

export const popupCreateSchema = z
  .object({
    ...popupFields,
    linkUrl: popupFields.linkUrl.optional(),
    newWindow: popupFields.newWindow.default(false),
    paused: popupFields.paused.default(false),
    dismissDays: popupFields.dismissDays.default(1),
  })
  .superRefine((v, ctx) => checkAdWindow(v, ctx));
export type PopupCreateInput = z.output<typeof popupCreateSchema>;

export const popupUpdateSchema = z
  .object({
    title: popupFields.title.optional(),
    mediaId: popupFields.mediaId.optional(),
    linkUrl: popupFields.linkUrl.nullable().optional(),
    newWindow: popupFields.newWindow.optional(),
    targetPages: popupFields.targetPages.optional(),
    startAt: popupFields.startAt.optional(),
    endAt: popupFields.endAt.optional(),
    paused: popupFields.paused.optional(),
    dismissDays: popupFields.dismissDays.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, '변경할 항목이 없습니다.')
  .superRefine((v, ctx) => checkAdWindow(v, ctx));
export type PopupUpdateInput = z.output<typeof popupUpdateSchema>;

export const adminPopupListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(BannerStatus).optional(),
  targetPage: z.enum(PopupPage).optional(),
  q: searchText,
});
export type AdminPopupListQuery = z.output<typeof adminPopupListQuerySchema>;

export const popupServeQuerySchema = z.object({
  page: z.enum(PopupPage),
});
export type PopupServeQuery = z.output<typeof popupServeQuerySchema>;
