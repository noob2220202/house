// Owned by the admin module team. Back-office-only request schemas.
import { z } from 'zod';
import { AgencyStatus } from '../enums/agency';
import { AssetType, DealType, ListingStatus } from '../enums/listing';
import { AdminRole, AdminStatus, UserRole, UserStatus } from '../enums/user';
import { adminPasswordSchema } from '../schemas/auth';
import { idSchema, paginationQuerySchema } from '../schemas/common';
import { isValidIpOrCidr } from './rules';

const searchTermSchema = z.string().trim().min(1).max(100);

// ---------- 관리자 계정 (SUPER_ADMIN) ----------

export const ipAllowlistSchema = z
  .array(z.string().trim().max(64).refine(isValidIpOrCidr, 'IP 주소 또는 CIDR 형식이 아닙니다.'))
  .max(50);

export const adminAccountCreateSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((e) => e.toLowerCase()),
  name: z.string().trim().min(1).max(50),
  role: z.enum(AdminRole),
  /** Initial password set by the SUPER_ADMIN; TOTP is enrolled by the new admin at first login. */
  password: adminPasswordSchema,
  ipAllowlist: ipAllowlistSchema.default([]),
});
export type AdminAccountCreateInput = z.infer<typeof adminAccountCreateSchema>;

export const adminAccountUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(50),
    role: z.enum(AdminRole),
    status: z.enum(AdminStatus),
    ipAllowlist: ipAllowlistSchema,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, '변경할 내용을 입력해 주세요.');
export type AdminAccountUpdateInput = z.infer<typeof adminAccountUpdateSchema>;

export const adminPasswordResetSchema = z.object({ password: adminPasswordSchema });
export type AdminPasswordResetInput = z.infer<typeof adminPasswordResetSchema>;

export const adminAccountListQuerySchema = paginationQuerySchema.extend({
  q: searchTermSchema.optional(),
  role: z.enum(AdminRole).optional(),
  status: z.enum(AdminStatus).optional(),
});
export type AdminAccountListQuery = z.infer<typeof adminAccountListQuerySchema>;

// ---------- 회원 ----------

export const memberListQuerySchema = paginationQuerySchema.extend({
  /** nickname / name / email / phone (digits) */
  q: searchTermSchema.optional(),
  status: z.enum(UserStatus).optional(),
  role: z.enum(UserRole).optional(),
});
export type MemberListQuery = z.infer<typeof memberListQuerySchema>;

export const memberSuspendSchema = z.object({
  reason: z.string().trim().min(2).max(500),
});
export type MemberSuspendInput = z.infer<typeof memberSuspendSchema>;

// ---------- 매물 관리 ----------

export const adminListingListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(ListingStatus).optional(),
  dealType: z.enum(DealType).optional(),
  assetType: z.enum(AssetType).optional(),
  agencyId: idSchema.optional(),
  complexId: idSchema.optional(),
  /** address or title */
  q: searchTermSchema.optional(),
});
export type AdminListingListQuery = z.infer<typeof adminListingListQuerySchema>;

export const adminListingModerationSchema = z.object({
  reason: z.string().trim().min(2).max(500),
});
export type AdminListingModerationInput = z.infer<typeof adminListingModerationSchema>;

// ---------- 대시보드 ----------

/** Agency statuses the dashboard counts as "review queue". */
export const AGENCY_REVIEW_QUEUE_STATUSES: readonly AgencyStatus[] = [AgencyStatus.PENDING];
