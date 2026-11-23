// Owned by the agencies module team. Request schemas (api validation + frontend forms).
import { z } from 'zod';
import { AgencyDocumentType, AgencyStatus } from '../enums/agency';
import { AssetType } from '../enums/listing';
import {
  bboxSchema,
  contactPhoneSchema,
  csvArray,
  idSchema,
  latSchema,
  lngSchema,
  paginationQuerySchema,
  phoneSchema,
  queryBoolean,
  regionCodeSchema,
  zoomSchema,
} from '../schemas/common';
import { TIME_OF_DAY_PATTERN, minutesOfDay } from './hours';
import {
  AGENCY_INVITE_CODE_ALPHABET,
  AGENCY_INVITE_CODE_LENGTH,
  REGISTRATION_NUMBER_PATTERN,
  isValidBusinessNumber,
  normalizeInviteCode,
  normalizeRegistrationNumber,
} from './rules';

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();

export const registrationNumberSchema = z
  .string()
  .max(60)
  .transform(normalizeRegistrationNumber)
  .pipe(
    z.string().regex(REGISTRATION_NUMBER_PATTERN, '중개사무소 등록번호 형식이 올바르지 않습니다.'),
  );

export const businessNumberSchema = z
  .string()
  .max(20)
  .transform((s) => s.replace(/\D/g, ''))
  .pipe(z.string().refine(isValidBusinessNumber, '사업자등록번호가 올바르지 않습니다.'));

const dayHoursSchema = z
  .object({
    open: z.string().regex(TIME_OF_DAY_PATTERN, '시간은 HH:MM 형식입니다.'),
    close: z.string().regex(TIME_OF_DAY_PATTERN, '시간은 HH:MM 형식입니다.'),
  })
  .refine((d) => minutesOfDay(d.open) < minutesOfDay(d.close), {
    message: '종료 시간은 시작 시간보다 늦어야 합니다.',
    path: ['close'],
  });

const dayEntry = dayHoursSchema.nullable().optional();

/** { mon: { open: "09:00", close: "18:00" }, sun: null, note: "점심 12~13시" } — missing/null day = 휴무. */
export const businessHoursSchema = z
  .object({
    mon: dayEntry,
    tue: dayEntry,
    wed: dayEntry,
    thu: dayEntry,
    fri: dayEntry,
    sat: dayEntry,
    sun: dayEntry,
    note: optionalText(200),
  })
  .strict();
export type BusinessHoursInput = z.infer<typeof businessHoursSchema>;

export const agencyDocumentInputSchema = z.object({
  type: z.enum(AgencyDocumentType),
  /** A PRIVATE media row (purpose AGENCY_DOCUMENT) the applicant uploaded. */
  mediaId: idSchema,
});
export type AgencyDocumentInput = z.infer<typeof agencyDocumentInputSchema>;

const specialtiesSchema = z
  .array(z.enum(AssetType))
  .max(6)
  .transform((a) => [...new Set(a)]);

/** Editable profile fields (shared by registration, resubmission and self-service update). */
const profileFields = {
  phone: contactPhoneSchema,
  mobile: phoneSchema.nullable().optional(),
  email: z.email('올바른 이메일 주소가 아닙니다.').max(254).nullable().optional(),
  roadAddress: trimmed(200),
  jibunAddress: z.string().trim().max(200).nullable().optional(),
  addressDetail: z.string().trim().max(100).nullable().optional(),
  zipCode: z
    .string()
    .regex(/^\d{5}$/, '우편번호 5자리를 입력해 주세요.')
    .nullable()
    .optional(),
  /** 법정동코드 (8 or 10 digits) of the office; 시군구 is derived from it. */
  emdCode: regionCodeSchema
    .refine((c) => c.length >= 8, '읍면동 코드가 필요합니다.')
    .nullable()
    .optional(),
  lat: latSchema,
  lng: lngSchema,
  intro: z.string().trim().max(3000).nullable().optional(),
  businessHours: businessHoursSchema.nullable().optional(),
  specialties: specialtiesSchema.optional(),
};

const documentsSchema = z
  .array(agencyDocumentInputSchema)
  .min(1)
  .max(10)
  .refine((docs) => new Set(docs.map((d) => d.mediaId)).size === docs.length, {
    message: '같은 파일을 중복으로 첨부할 수 없습니다.',
  });

/** POST /agencies — 중개사무소 등록 신청 (logged-in user → PENDING). */
export const agencyRegisterSchema = z.object({
  name: trimmed(100),
  /** 대표 개업공인중개사 성명 */
  representativeName: trimmed(50),
  registrationNumber: registrationNumberSchema,
  businessNumber: businessNumberSchema,
  ...profileFields,
  documents: documentsSchema.refine(
    (docs) => docs.some((d) => d.type === AgencyDocumentType.REGISTRATION_CERT),
    { message: '중개사무소 등록증을 첨부해 주세요.' },
  ),
});
export type AgencyRegisterInput = z.infer<typeof agencyRegisterSchema>;

const nonEmpty = (o: Record<string, unknown>) => Object.values(o).some((v) => v !== undefined);
const latLngTogether = (o: { lat?: number; lng?: number }) =>
  (o.lat === undefined) === (o.lng === undefined);

/** POST /agencies/mine/resubmit — a REJECTED application corrected and sent back (→ PENDING). */
export const agencyResubmitSchema = z
  .object({
    name: trimmed(100).optional(),
    representativeName: trimmed(50).optional(),
    registrationNumber: registrationNumberSchema.optional(),
    businessNumber: businessNumberSchema.optional(),
    ...profileFields,
    phone: profileFields.phone.optional(),
    roadAddress: profileFields.roadAddress.optional(),
    lat: latSchema.optional(),
    lng: lngSchema.optional(),
    /** Extra documents to attach (existing ones are kept). */
    documents: documentsSchema.optional(),
    /** Note to the reviewer. */
    message: optionalText(1000),
  })
  .refine(latLngTogether, { message: '위도와 경도를 함께 입력해 주세요.', path: ['lng'] });
export type AgencyResubmitInput = z.infer<typeof agencyResubmitSchema>;

/**
 * PATCH /agencies/mine — self-service profile. 명칭·대표자·등록번호·사업자번호 come from the
 * registration certificate and change only through admin review.
 */
export const agencyUpdateSchema = z
  .object({
    ...profileFields,
    phone: profileFields.phone.optional(),
    roadAddress: profileFields.roadAddress.optional(),
    lat: latSchema.optional(),
    lng: lngSchema.optional(),
    /** PUBLIC media (purpose AGENCY_LOGO) uploaded by the owner; null removes the logo. */
    logoMediaId: idSchema.nullable().optional(),
  })
  .refine(nonEmpty, { message: '변경할 항목을 입력해 주세요.' })
  .refine(latLngTogether, { message: '위도와 경도를 함께 입력해 주세요.', path: ['lng'] });
export type AgencyUpdateInput = z.infer<typeof agencyUpdateSchema>;

export const AgencySearchSort = {
  RELEVANCE: 'RELEVANCE',
  LISTINGS: 'LISTINGS',
  NEWEST: 'NEWEST',
  NAME: 'NAME',
} as const;
export type AgencySearchSort = (typeof AgencySearchSort)[keyof typeof AgencySearchSort];

const searchTextSchema = z.string().trim().min(1).max(50);

/** GET /agencies — 중개사무소 찾기 (name / 대표 / address). */
export const agencySearchQuerySchema = paginationQuerySchema.extend({
  q: searchTextSchema.optional(),
  emdCode: regionCodeSchema.optional(),
  bbox: bboxSchema.optional(),
  specialties: csvArray(z.enum(AssetType)),
  sort: z.enum(AgencySearchSort).default(AgencySearchSort.RELEVANCE),
});
export type AgencySearchQuery = z.infer<typeof agencySearchQuerySchema>;

/** GET /agencies/map — clusters (low/mid zoom) or office markers (high zoom). */
export const agencyMapQuerySchema = z.object({
  bbox: bboxSchema,
  zoom: zoomSchema,
  q: searchTextSchema.optional(),
  specialties: csvArray(z.enum(AssetType)),
});
export type AgencyMapQuery = z.infer<typeof agencyMapQuerySchema>;

export const agencyMemberParamSchema = z.object({ memberId: idSchema });
export const agencyDocumentParamSchema = z.object({ docId: idSchema });
export const agencyAdminDocumentParamSchema = z.object({ id: idSchema, docId: idSchema });

export const agencyInviteIdSchema = z
  .string()
  .regex(/^[a-f0-9]{24}$/, '초대 ID가 올바르지 않습니다.');
export const agencyInviteParamSchema = z.object({ inviteId: agencyInviteIdSchema });

/** POST /agencies/mine/invites — owner issues a single-use join code for a staff member. */
export const agencyInviteCreateSchema = z.preprocess(
  (v) => v ?? {},
  z.object({
    /** Owner's memo (e.g. "김실장"). */
    label: optionalText(50),
    expiresInHours: z
      .int()
      .min(1)
      .max(24 * 14)
      .default(72),
  }),
);
export type AgencyInviteCreateInput = z.infer<typeof agencyInviteCreateSchema>;

const memberProfileFields = {
  displayName: trimmed(50),
  title: z.string().trim().max(30).nullable().optional(),
  phone: phoneSchema.nullable().optional(),
  /** 소속공인중개사 (true) or 중개보조원 (false). */
  isLicensed: z.boolean().default(false),
  licenseNumber: z.string().trim().max(40).nullable().optional(),
};

const licenseNeedsFlag = (m: { isLicensed?: boolean; licenseNumber?: string | null }) =>
  !m.licenseNumber || m.isLicensed !== false;

/** POST /agencies/join — a user redeems an invite code and joins as AGENT. */
export const agencyJoinSchema = z
  .object({
    code: z
      .string()
      .max(20)
      .transform(normalizeInviteCode)
      .pipe(
        z
          .string()
          .length(AGENCY_INVITE_CODE_LENGTH, '초대 코드가 올바르지 않습니다.')
          .refine(
            (c) => [...c].every((ch) => AGENCY_INVITE_CODE_ALPHABET.includes(ch)),
            '초대 코드가 올바르지 않습니다.',
          ),
      ),
    ...memberProfileFields,
  })
  .refine(licenseNeedsFlag, {
    message: '자격증 번호는 소속공인중개사만 입력합니다.',
    path: ['licenseNumber'],
  });
export type AgencyJoinInput = z.infer<typeof agencyJoinSchema>;

/** PATCH /agencies/mine/members/:memberId */
export const agencyMemberUpdateSchema = z
  .object({
    displayName: memberProfileFields.displayName.optional(),
    title: memberProfileFields.title,
    phone: memberProfileFields.phone,
    isLicensed: z.boolean().optional(),
    licenseNumber: memberProfileFields.licenseNumber,
  })
  .refine(nonEmpty, { message: '변경할 항목을 입력해 주세요.' })
  .refine(licenseNeedsFlag, {
    message: '자격증 번호는 소속공인중개사만 입력합니다.',
    path: ['licenseNumber'],
  });
export type AgencyMemberUpdateInput = z.infer<typeof agencyMemberUpdateSchema>;

export const agencyMemberListQuerySchema = paginationQuerySchema.extend({
  includeRemoved: queryBoolean.transform((v) => v ?? false),
});

// ---------- admin ----------

export const AdminAgencySort = {
  OLDEST: 'OLDEST',
  NEWEST: 'NEWEST',
  NAME: 'NAME',
} as const;
export type AdminAgencySort = (typeof AdminAgencySort)[keyof typeof AdminAgencySort];

/** GET /admin/agencies — review queue (status=PENDING, oldest first) and agency directory. */
export const adminAgencyListQuerySchema = paginationQuerySchema.extend({
  status: csvArray(z.enum(AgencyStatus)),
  q: searchTextSchema.optional(),
  sort: z.enum(AdminAgencySort).default(AdminAgencySort.OLDEST),
});
export type AdminAgencyListQuery = z.infer<typeof adminAgencyListQuerySchema>;

/** POST /admin/agencies/:id/decision — 승인 / 반려 / 정지 (APPROVED also reinstates a suspension). */
export const agencyDecisionSchema = z
  .object({
    status: z.enum([AgencyStatus.APPROVED, AgencyStatus.REJECTED, AgencyStatus.SUSPENDED]),
    reason: optionalText(1000),
  })
  .refine((d) => d.status === AgencyStatus.APPROVED || (d.reason && d.reason.length > 0), {
    message: '반려·정지 사유를 입력해 주세요.',
    path: ['reason'],
  });
export type AgencyDecisionInput = z.infer<typeof agencyDecisionSchema>;

export const agencyRegistryCheckQuerySchema = z.object({
  refresh: queryBoolean.transform((v) => v ?? false),
});

/**
 * PATCH /admin/agencies/:id/location — 소재지 변경 of an approved office, applied by an admin after
 * checking the 이전신고 (updated 등록증). Owners cannot change these fields once approved.
 */
export const agencyLocationUpdateSchema = z
  .object({
    roadAddress: profileFields.roadAddress.optional(),
    jibunAddress: profileFields.jibunAddress,
    addressDetail: profileFields.addressDetail,
    zipCode: profileFields.zipCode,
    emdCode: profileFields.emdCode,
    lat: latSchema.optional(),
    lng: lngSchema.optional(),
    /** Why / on what evidence (e.g. "이전신고 확인, 등록증 재발급본 첨부"). Audited. */
    reason: trimmed(1000),
  })
  .refine(({ reason: _reason, ...fields }) => nonEmpty(fields), {
    message: '변경할 항목을 입력해 주세요.',
  })
  .refine(latLngTogether, { message: '위도와 경도를 함께 입력해 주세요.', path: ['lng'] });
export type AgencyLocationUpdateInput = z.infer<typeof agencyLocationUpdateSchema>;
