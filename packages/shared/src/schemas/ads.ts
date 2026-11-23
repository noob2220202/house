// Owned by the ads module team.
import { z } from 'zod';
import { POPUP_MAX_DISMISS_DAYS } from '../constants/ads';
import { BannerSlot, BannerTargeting, PopupPage } from '../enums/ads';
import { dateTimeSchema, idSchema, linkUrlSchema, regionCodeSchema } from './common';

const window = z
  .object({ startAt: dateTimeSchema, endAt: dateTimeSchema })
  .refine((v) => new Date(v.startAt) < new Date(v.endAt), {
    message: '종료일시는 시작일시 이후여야 합니다.',
    path: ['endAt'],
  });

export const bannerInputSchema = z
  .object({
    slot: z.enum(BannerSlot),
    title: z.string().trim().min(1).max(100),
    advertiserName: z.string().trim().max(100).optional(),
    agencyId: idSchema.optional(),
    pcMediaId: idSchema,
    mobileMediaId: idSchema.optional(),
    linkUrl: linkUrlSchema.optional(),
    newWindow: z.boolean().default(false),
    startAt: dateTimeSchema,
    endAt: dateTimeSchema,
    paused: z.boolean().default(false),
    priority: z.int().min(0).max(1000).default(0),
    targeting: z.enum(BannerTargeting).default(BannerTargeting.ALL),
    targetRegionCodes: z.array(regionCodeSchema).max(100).default([]),
    targetComplexIds: z.array(idSchema).max(100).default([]),
    memo: z.string().max(1000).optional(),
  })
  .and(window);
export type BannerInput = z.infer<typeof bannerInputSchema>;

export const reorderSchema = z.object({
  ids: z.array(idSchema).min(1).max(200),
});

export const bannerServeQuerySchema = z.object({
  slot: z.enum(BannerSlot),
  regionCode: regionCodeSchema.optional(),
  complexId: idSchema.optional(),
});

export const popupInputSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    mediaId: idSchema,
    linkUrl: linkUrlSchema.optional(),
    newWindow: z.boolean().default(false),
    targetPages: z.array(z.enum(PopupPage)).min(1).max(10),
    startAt: dateTimeSchema,
    endAt: dateTimeSchema,
    paused: z.boolean().default(false),
    dismissDays: z.int().min(0).max(POPUP_MAX_DISMISS_DAYS).default(1),
  })
  .and(window);

export const popupServeQuerySchema = z.object({
  page: z.enum(PopupPage),
});
