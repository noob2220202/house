import {
  AgencyDocumentType,
  AgencyMemberRole,
  AgencyMemberStatus,
  AgencyStatus,
  AssetType,
  DealType,
  MediaPurpose,
  contactPhoneSchema,
  phoneSchema,
} from '@house/shared';
import { z } from 'zod';
import {
  agencyDealRequestSchema,
  inquirySchema,
  type AgencyDealRequest,
  type Inquiry,
} from '@/features/a-inbox/api/schemas';
import { businessHoursSchema } from '../lib/business-hours';
import { SERVICE_AREA, SERVICE_AREA_MESSAGE } from '../lib/location';
import {
  isPlausibleRegistrationNumber,
  isValidBusinessNumber,
  normalizeRegistrationNumber,
} from '../lib/registration';

/*
 * Response shapes of the agencies module as the broker console consumes them.
 * The backend controllers are not implemented yet (README + Prisma only), so these are ASSUMED
 * shapes derived from apps/api/prisma/schema/agencies.prisma — see
 * docs/frontend-integration/a-agency.md. Fix the schema and the mock fixture together.
 */

// ---- media -------------------------------------------------------------------------------------

const mediaVariantSchema = z.object({ url: z.string(), width: z.number(), height: z.number() });

/** MediaDto of @house/shared (schemas/media.ts). Private media has no variants. */
export const mediaSchema = z.object({
  id: z.string(),
  purpose: z.enum(MediaPurpose),
  mimeType: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  variants: z
    .object({
      thumb: mediaVariantSchema.optional(),
      medium: mediaVariantSchema.optional(),
      large: mediaVariantSchema.optional(),
    })
    .default({}),
});
export type Media = z.infer<typeof mediaSchema>;

// ---- my agency ---------------------------------------------------------------------------------

export const agencyDocumentSchema = z.object({
  id: z.string(),
  type: z.enum(AgencyDocumentType),
  mediaId: z.string(),
  mimeType: z.string().nullish(),
  /** Original file name (display only). */
  fileName: z.string().nullish(),
  createdAt: z.string(),
});
export type AgencyDocument = z.infer<typeof agencyDocumentSchema>;

export const agencyStatusHistorySchema = z.object({
  id: z.string(),
  fromStatus: z.enum(AgencyStatus).nullable(),
  toStatus: z.enum(AgencyStatus),
  reason: z.string().nullish(),
  createdAt: z.string(),
});
export type AgencyStatusHistory = z.infer<typeof agencyStatusHistorySchema>;

/** GET /agencies/mine — the caller's agency (owner, applicant or staff) incl. private fields. */
export const myAgencySchema = z.object({
  id: z.string(),
  name: z.string(),
  representativeName: z.string(),
  registrationNumber: z.string(),
  businessNumber: z.string().nullish(),
  phone: z.string(),
  mobile: z.string().nullish(),
  email: z.string().nullish(),
  roadAddress: z.string(),
  jibunAddress: z.string().nullish(),
  addressDetail: z.string().nullish(),
  zipCode: z.string().nullish(),
  lat: z.number(),
  lng: z.number(),
  intro: z.string().nullish(),
  businessHours: businessHoursSchema.nullish(),
  specialties: z.array(z.enum(AssetType)).default([]),
  logo: mediaSchema.nullish(),
  cover: mediaSchema.nullish(),
  status: z.enum(AgencyStatus),
  statusReason: z.string().nullish(),
  approvedAt: z.string().nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
  activeListingCount: z.number().default(0),
  viewCount: z.number().default(0),
  warningCount: z.number().default(0),
  /** Membership role of the caller in this agency. */
  myRole: z.enum(AgencyMemberRole).default(AgencyMemberRole.OWNER),
  documents: z.array(agencyDocumentSchema).default([]),
  statusHistory: z.array(agencyStatusHistorySchema).default([]),
});
export type MyAgency = z.infer<typeof myAgencySchema>;

// ---- members -----------------------------------------------------------------------------------

export const agencyMemberSchema = z.object({
  id: z.string(),
  userId: z.string().nullish(),
  role: z.enum(AgencyMemberRole),
  status: z.enum(AgencyMemberStatus),
  displayName: z.string(),
  title: z.string().nullish(),
  phone: z.string().nullish(),
  /** 소속공인중개사 (true) / 중개보조원 (false). */
  isLicensed: z.boolean(),
  licenseNumber: z.string().nullish(),
  joinedAt: z.string().nullish(),
  /** Only on INVITED members, and only for the owner. */
  inviteCode: z.string().nullish(),
  inviteExpiresAt: z.string().nullish(),
  activeListingCount: z.number().nullish(),
});
export type AgencyMember = z.infer<typeof agencyMemberSchema>;

/** GET /agencies/mine/members — accepts a bare array or an `{ items }` envelope. */
export const agencyMembersSchema = z
  .union([z.array(agencyMemberSchema), z.object({ items: z.array(agencyMemberSchema) })])
  .transform((v) => (Array.isArray(v) ? v : v.items));

/** Invite form model (strings as typed; '' = left blank). `toInvitePayload` builds the body. */
export const inviteMemberSchema = z.object({
  displayName: z.string().trim().min(1, '이름을 입력해 주세요.').max(50),
  title: z.string().trim().max(30).optional(),
  isLicensed: z.boolean(),
  licenseNumber: z.string().trim().max(40).optional(),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || phoneSchema.safeParse(v).success, '올바른 휴대폰 번호가 아닙니다.')
    .optional(),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

/**
 * Body of POST /agencies/mine/members as the API validates it (ASSUMED): blank optional fields are
 * omitted, never sent as ''. The mock validates with this schema so it fails the way the API would.
 */
export const inviteMemberPayloadSchema = z.object({
  displayName: z.string().trim().min(1).max(50),
  title: z.string().trim().min(1).max(30).optional(),
  isLicensed: z.boolean(),
  licenseNumber: z.string().trim().min(1).max(40).optional(),
  phone: phoneSchema.optional(),
});
export type InviteMemberPayload = z.input<typeof inviteMemberPayloadSchema>;

// ---- dashboard ---------------------------------------------------------------------------------

const dashboardListingSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** "34평 · 고/25층" */
  summary: z.string().nullish(),
  dealType: z.enum(DealType),
  price: z.number().nullish(),
  deposit: z.number().nullish(),
  monthlyRent: z.number().nullish(),
  /** Ad period end (ISO). */
  expiresAt: z.string().nullish(),
  /** Last 실매물 확인 (ISO date). */
  verifiedAt: z.string().nullish(),
  /** Date by which the listing must be re-verified to keep the badge. */
  verificationDueAt: z.string().nullish(),
});
export type DashboardListing = z.infer<typeof dashboardListingSchema>;

/**
 * Feed rows of the dashboard = the first rows of the a-inbox lists, in the same shapes
 * (`GET /agency/deal-requests`, `GET /agency/inquiries`), so the home and the inbox describe a
 * request with the same words (`a-inbox/lib/request-text`). No dashboard-only `title`/`summary`.
 */
export type DashboardRequest = AgencyDealRequest;
export type DashboardInquiry = Inquiry;

/** GET /agencies/mine/dashboard — one aggregate for the console home + sidebar badges. */
export const agencyDashboardSchema = z.object({
  listings: z.object({
    active: z.number(),
    reserved: z.number(),
    draft: z.number(),
    /** 거래완료 in the last 30 days. */
    closed30d: z.number(),
    /** Co-brokered listings this agency joined. */
    coBrokered: z.number().default(0),
  }),
  views: z.object({
    /** Listing views in the last 7 days and the change vs the previous 7 (ratio, 0.12 = +12%). */
    total7d: z.number(),
    changeRatio: z.number().nullable(),
    /** Oldest → newest, one entry per day. */
    daily: z.array(z.object({ date: z.string(), views: z.number() })),
    profileViews7d: z.number().default(0),
    favorites7d: z.number().default(0),
  }),
  dealRequests: z.object({
    newCount: z.number(),
    /** Split of `newCount` by type (the feed below is truncated, so it cannot be counted). */
    newSellCount: z.number().nullish(),
    newWantedCount: z.number().nullish(),
    /** Latest requests (a few only). */
    items: z.array(agencyDealRequestSchema),
  }),
  inquiries: z.object({
    unreadCount: z.number(),
    items: z.array(inquirySchema),
  }),
  expiringListings: z.array(dashboardListingSchema),
  verificationDue: z.array(dashboardListingSchema),
});
export type AgencyDashboard = z.infer<typeof agencyDashboardSchema>;

// ---- geocode -----------------------------------------------------------------------------------

export const geocodeItemSchema = z.object({
  roadAddress: z.string(),
  jibunAddress: z.string().nullish(),
  zipCode: z.string().nullish(),
  /** Building / place name when known. */
  buildingName: z.string().nullish(),
  lat: z.number(),
  lng: z.number(),
});
export type GeocodeItem = z.infer<typeof geocodeItemSchema>;
export const geocodeResultSchema = z.object({ items: z.array(geocodeItemSchema) });

// ---- application form --------------------------------------------------------------------------

/**
 * Form model of the registration application (strings as typed). `toRegisterPayload()` turns it
 * into the body validated by `agencyRegisterSchema` of @house/shared.
 */
export const applyFormSchema = z.object({
  name: z.string().trim().min(1, '상호를 입력해 주세요.').max(100, '100자 이내로 입력해 주세요.'),
  representativeName: z
    .string()
    .trim()
    .min(1, '대표 공인중개사 성명을 입력해 주세요.')
    .max(50, '50자 이내로 입력해 주세요.'),
  registrationNumber: z
    .string()
    .trim()
    .min(1, '중개사무소 등록번호를 입력해 주세요.')
    .refine(isPlausibleRegistrationNumber, '등록증에 적힌 등록번호를 그대로 입력해 주세요.')
    .transform(normalizeRegistrationNumber),
  businessNumber: z
    .string()
    .trim()
    .min(1, '사업자등록번호를 입력해 주세요.')
    .refine(isValidBusinessNumber, '사업자등록번호 10자리를 다시 확인해 주세요.'),
  phone: z
    .string()
    .trim()
    .min(1, '대표 전화번호를 입력해 주세요.')
    .refine((v) => contactPhoneSchema.safeParse(v).success, '올바른 전화번호가 아닙니다.'),
  mobile: z
    .string()
    .trim()
    .refine((v) => v === '' || phoneSchema.safeParse(v).success, '올바른 휴대폰 번호가 아닙니다.'),
  roadAddress: z
    .string()
    .trim()
    .min(1, '주소를 검색해서 선택해 주세요.')
    .max(200, '200자 이내로 입력해 주세요.'),
  jibunAddress: z.string().trim().max(200),
  addressDetail: z.string().trim().max(100, '100자 이내로 입력해 주세요.'),
  lat: z
    .number({ error: '지도에서 사무소 위치를 지정해 주세요.' })
    .min(SERVICE_AREA.swLat, SERVICE_AREA_MESSAGE)
    .max(SERVICE_AREA.neLat, SERVICE_AREA_MESSAGE),
  lng: z
    .number({ error: '지도에서 사무소 위치를 지정해 주세요.' })
    .min(SERVICE_AREA.swLng, SERVICE_AREA_MESSAGE)
    .max(SERVICE_AREA.neLng, SERVICE_AREA_MESSAGE),
  intro: z.string().trim().max(3000, '3,000자 이내로 입력해 주세요.'),
  specialties: z.array(z.enum(AssetType)).max(10),
  /** Declaration that the data and documents are true (not a personal-data consent). */
  agreeTruth: z.boolean().refine((v) => v, '입력 내용과 제출 서류가 사실과 같은지 확인해 주세요.'),
  /** [필수] 개인정보 수집·이용 동의 — kept separate from every other agreement. */
  agreePrivacy: z.boolean().refine((v) => v, '개인정보 수집·이용에 동의해 주세요.'),
});
export type ApplyFormInput = z.input<typeof applyFormSchema>;
export type ApplyFormValues = z.output<typeof applyFormSchema>;

// ---- profile form ------------------------------------------------------------------------------

export const profileFormSchema = z.object({
  intro: z.string().trim().max(3000, '3,000자 이내로 입력해 주세요.'),
  specialties: z.array(z.enum(AssetType)).max(10),
  phone: z
    .string()
    .trim()
    .min(1, '대표 전화번호를 입력해 주세요.')
    .refine((v) => contactPhoneSchema.safeParse(v).success, '올바른 전화번호가 아닙니다.'),
  mobile: z
    .string()
    .trim()
    .refine((v) => v === '' || phoneSchema.safeParse(v).success, '올바른 휴대폰 번호가 아닙니다.'),
});
export type ProfileFormValues = z.infer<typeof profileFormSchema>;
