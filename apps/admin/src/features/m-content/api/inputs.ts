import {
  AdminRole,
  AdminStatus,
  AssetType,
  FaqCategory,
  KR_CONTACT_PHONE_PATTERN,
  TermsType,
  idSchema,
  isSafeLinkUrl,
  localVideoInputSchema,
  normalizePhone,
  parseYoutubeVideoId,
  regionCodeSchema,
} from '@house/shared';
import { z } from 'zod';
import { isValidBusinessNumber } from '../lib/business';
import { HOME_SECTION_KEYS } from './schemas';

/**
 * Request bodies of the m-content screens. Limits mirror packages/shared/src/schemas/admin.ts
 * (noticeInputSchema, faqInputSchema, localVideoInputSchema, termsDocumentInputSchema,
 * siteSettingSchemas) with Korean messages for the forms; the mock handlers validate with the
 * same schemas. Inputs without a shared schema (complex, admin account) are ASSUMED shapes —
 * see docs/frontend-integration/m-content.md.
 */

const required = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label}을(를) 입력해 주세요.`)
    .max(max, `${label}은(는) ${max.toLocaleString('ko-KR')}자까지 입력할 수 있어요.`);
const body = (label: string, max: number) =>
  z
    .string()
    .refine((v) => v.trim().length > 0, `${label}을(를) 입력해 주세요.`)
    .max(max, `${label}은(는) ${max.toLocaleString('ko-KR')}자까지 입력할 수 있어요.`);

// ---------- content ----------

export const noticeFormSchema = z.object({
  title: required('제목', 200),
  content: body('내용', 50_000),
  isPinned: z.boolean(),
  isPublished: z.boolean(),
});
export type NoticeForm = z.infer<typeof noticeFormSchema>;
export const noticePatchSchema = noticeFormSchema.partial();

export const faqFormSchema = z.object({
  category: z.enum(FaqCategory, '분류를 골라 주세요.'),
  question: required('질문', 500),
  answer: body('답변', 20_000),
  isPublished: z.boolean(),
});
export type FaqForm = z.infer<typeof faqFormSchema>;
export const faqPatchSchema = faqFormSchema.partial();

export const videoFormSchema = z.object({
  title: required('제목', 200),
  youtubeUrl: z
    .string()
    .trim()
    .min(1, 'YouTube 주소를 입력해 주세요.')
    .max(500, '주소가 너무 길어요.')
    .refine((v) => parseYoutubeVideoId(v) !== null, 'YouTube 영상 주소가 아니에요.'),
  description: z.string().max(2000, '설명은 2,000자까지 입력할 수 있어요.').optional(),
  regionCode: z.string().optional(),
  complexId: z.string().optional(),
  isPublished: z.boolean(),
});
export type VideoForm = z.infer<typeof videoFormSchema>;

/**
 * POST /admin/videos = `localVideoInputSchema` (packages/shared). Its `regionCode` / `complexId` /
 * `description` are optional and validated (region code pattern, UUID), so empty form fields must be
 * LEFT OUT — an empty string is a 400 on the real backend.
 */
export const videoCreateBodySchema = localVideoInputSchema;
export interface VideoCreateBody {
  title: string;
  youtubeUrl: string;
  description?: string;
  regionCode?: string;
  complexId?: string;
  isPublished: boolean;
}
/**
 * PATCH /admin/videos/:id: changed fields only (plus `isPublished`, always). Unlinking a region / complex sends `null`, which
 * ASSUMES the backend's update schema makes those two nullable (see m-content.md); a cleared
 * description is sent as '' (valid for the shared schema).
 */
export const videoPatchSchema = z.object({
  title: localVideoInputSchema.shape.title.optional(),
  youtubeUrl: localVideoInputSchema.shape.youtubeUrl.optional(),
  description: localVideoInputSchema.shape.description,
  regionCode: regionCodeSchema.nullable().optional(),
  complexId: idSchema.nullable().optional(),
  isPublished: z.boolean().optional(),
});
export type VideoPatchBody = z.infer<typeof videoPatchSchema>;

export function videoCreateBody(v: VideoForm): VideoCreateBody {
  const description = v.description?.trim();
  return {
    title: v.title.trim(),
    youtubeUrl: v.youtubeUrl.trim(),
    ...(description ? { description } : {}),
    ...(v.regionCode ? { regionCode: v.regionCode } : {}),
    ...(v.complexId ? { complexId: v.complexId } : {}),
    isPublished: v.isPublished,
  };
}

export function videoPatchBody(
  v: VideoForm,
  before: {
    title: string;
    youtubeUrl: string;
    description: string | null;
    regionCode: string | null;
    complexId: string | null;
    isPublished: boolean;
  },
): VideoPatchBody {
  const out: VideoPatchBody = {};
  const title = v.title.trim();
  const youtubeUrl = v.youtubeUrl.trim();
  const description = v.description?.trim() ?? '';
  const regionCode = v.regionCode || null;
  const complexId = v.complexId || null;
  if (title !== before.title) out.title = title;
  if (youtubeUrl !== before.youtubeUrl) out.youtubeUrl = youtubeUrl;
  if (description !== (before.description ?? '')) out.description = description;
  if (regionCode !== before.regionCode) out.regionCode = regionCode;
  if (complexId !== before.complexId) out.complexId = complexId;
  // Always sent: a backend PATCH schema built with `.partial()` re-applies `isPublished`'s
  // `.default(true)` in Zod 4, which would silently re-publish a hidden video on a title edit.
  out.isPublished = v.isPublished;
  return out;
}

export const orderSchema = z.object({ ids: z.array(z.string()).min(1).max(500) });

export const homeLayoutInputSchema = z.object({
  sections: z
    .array(z.object({ key: z.enum(HOME_SECTION_KEYS), visible: z.boolean() }))
    .min(1)
    .max(HOME_SECTION_KEYS.length),
});

// ---------- terms ----------

export const termsFormSchema = z.object({
  type: z.enum(TermsType, '약관 종류를 골라 주세요.'),
  version: z
    .string()
    .trim()
    .min(1, '버전을 입력해 주세요.')
    .max(20, '버전은 20자까지 입력할 수 있어요.')
    .regex(/^\d+(\.\d+){0,2}$/, '버전은 1.0, 1.1, 2.0.1 같은 숫자 형식으로 입력해 주세요.'),
  title: required('제목', 200),
  content: body('본문', 200_000),
  isRequired: z.boolean(),
  /** `YYYY-MM-DD` in the form; sent as an ISO datetime at 00:00 KST. */
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '적용일을 골라 주세요.'),
});
export type TermsForm = z.infer<typeof termsFormSchema>;

export const termsInputSchema = termsFormSchema.omit({ effectiveDate: true }).extend({
  effectiveAt: z.iso.datetime({ offset: true }),
});
export const termsPatchSchema = termsInputSchema.omit({ type: true }).partial();

// ---------- site settings ----------

const phone = z
  .string()
  .trim()
  .min(1, '전화번호를 입력해 주세요.')
  .max(30)
  .refine(
    (v) => KR_CONTACT_PHONE_PATTERN.test(normalizePhone(v)),
    '전화번호 형식을 확인해 주세요. 예: 061-000-0000',
  );
const email = z.email('이메일 형식을 확인해 주세요.').max(254);

export const businessInfoFormSchema = z.object({
  companyName: required('상호', 100),
  ceoName: required('대표자명', 50),
  businessNumber: z
    .string()
    .trim()
    .min(1, '사업자등록번호를 입력해 주세요.')
    .max(20)
    .refine(isValidBusinessNumber, '사업자등록번호 10자리를 확인해 주세요. 예: 123-45-67890'),
  mailOrderNumber: z.string().trim().max(50, '50자까지 입력할 수 있어요.').optional(),
  address: required('주소', 200),
  privacyOfficer: required('개인정보보호책임자', 50),
  phone,
  email,
});
export type BusinessInfoForm = z.infer<typeof businessInfoFormSchema>;

export const contactFormSchema = z.object({
  phone,
  email,
  hours: z.string().trim().max(100, '100자까지 입력할 수 있어요.').optional(),
  kakaoChannelUrl: z
    .string()
    .trim()
    .refine((v) => v === '' || /^https:\/\//.test(v), 'https:// 로 시작하는 주소를 입력해 주세요.')
    .refine((v) => v === '' || isSafeLinkUrl(v), '주소 형식을 확인해 주세요.')
    .optional(),
});
export type ContactForm = z.infer<typeof contactFormSchema>;

export const seoFormSchema = z.object({
  title: required('사이트 제목', 100),
  description: required('사이트 설명', 300),
});
export type SeoForm = z.infer<typeof seoFormSchema>;

// ---------- complexes ----------

const optionalInt = (label: string, min: number, max: number) =>
  z
    .number(`${label}은(는) 숫자로 입력해 주세요.`)
    .int(`${label}은(는) 정수로 입력해 주세요.`)
    .min(min, `${label}은(는) ${min} 이상이어야 해요.`)
    .max(max, `${label}은(는) ${max.toLocaleString('ko-KR')} 이하여야 해요.`)
    .nullable();
const optionalNumber = (label: string, min: number, max: number) =>
  z
    .number(`${label}은(는) 숫자로 입력해 주세요.`)
    .min(min, `${label}은(는) ${min} 이상이어야 해요.`)
    .max(max, `${label}은(는) ${max.toLocaleString('ko-KR')} 이하여야 해요.`)
    .nullable();
const optionalText = (max: number) =>
  z.string().trim().max(max, `${max}자까지 입력할 수 있어요.`).nullable();

const complexBaseSchema = z.object({
  assetType: z.enum([AssetType.APT, AssetType.OFFICETEL]),
  name: required('단지명', 100),
  roadAddress: optionalText(200),
  jibunAddress: optionalText(200),
  emdCode: z.string().regex(/^\d{8}(\d{2})?$/, '읍면동을 골라 주세요.'),
  emdName: optionalText(50),
  jibun: optionalText(20),
  lat: z
    .number('위도를 입력해 주세요.')
    .min(34.6, '순천시 범위(34.6 ~ 35.3)의 위도를 입력해 주세요.')
    .max(35.3, '순천시 범위(34.6 ~ 35.3)의 위도를 입력해 주세요.'),
  lng: z
    .number('경도를 입력해 주세요.')
    .min(127.1, '순천시 범위(127.1 ~ 127.8)의 경도를 입력해 주세요.')
    .max(127.8, '순천시 범위(127.1 ~ 127.8)의 경도를 입력해 주세요.'),
  households: optionalInt('세대수', 1, 20_000),
  buildings: optionalInt('동수', 1, 300),
  floorsMin: optionalInt('최저층', 1, 100),
  floorsMax: optionalInt('최고층', 1, 100),
  approvalDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식을 확인해 주세요.')
    .nullable(),
  builtYear: optionalInt('준공 연도', 1960, 2040),
  parkingTotal: optionalInt('총 주차대수', 0, 50_000),
  parkingPerHousehold: optionalNumber('세대당 주차', 0, 10),
  floorAreaRatio: optionalNumber('용적률', 0, 2000),
  buildingCoverageRatio: optionalNumber('건폐율', 0, 100),
  heatingType: optionalText(50),
  builder: optionalText(100),
  externalCode: optionalText(40),
});
export const complexFormSchema = complexBaseSchema.refine(
  (v) => v.floorsMin === null || v.floorsMax === null || v.floorsMin <= v.floorsMax,
  { path: ['floorsMax'], message: '최고층은 최저층보다 낮을 수 없어요.' },
);
export type ComplexForm = z.infer<typeof complexFormSchema>;
/** PATCH body: any subset of the facts (cross-field rule re-checked by the backend). */
export const complexPatchSchema = complexBaseSchema.partial();

export const areaTypeFormSchema = z
  .object({
    exclusiveArea: z
      .number('전용면적을 입력해 주세요.')
      .positive('전용면적을 입력해 주세요.')
      .max(1000, '전용면적을 확인해 주세요.'),
    supplyArea: optionalNumber('공급면적', 1, 2000),
    typeName: z.string().trim().max(20, '20자까지 입력할 수 있어요.'),
    pyeongLabel: optionalText(20),
    households: optionalInt('세대수', 1, 20_000),
    rooms: optionalInt('방 수', 0, 10),
    baths: optionalInt('욕실 수', 0, 10),
  })
  .refine((v) => v.supplyArea === null || v.supplyArea >= v.exclusiveArea, {
    path: ['supplyArea'],
    message: '공급면적은 전용면적보다 작을 수 없어요.',
  });
export type AreaTypeForm = z.infer<typeof areaTypeFormSchema>;

export const complexPhotoInputSchema = z.object({
  mediaId: z.string().min(1),
  caption: z.string().trim().max(100).nullable().optional(),
});
export const complexPhotoPatchSchema = z.object({
  caption: z.string().trim().max(100, '설명은 100자까지 입력할 수 있어요.').nullable(),
});

export const tradeSyncInputSchema = z.object({
  /** YYYYMM */
  yearMonth: z.number().int().min(200601).max(210012),
});

// ---------- admin accounts ----------

const password = z
  .string()
  .min(12, '비밀번호는 12자 이상이어야 해요.')
  .max(200)
  .refine(
    (v) => /[A-Za-z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v),
    '영문, 숫자, 특수문자를 모두 포함해 주세요.',
  );

const ipAllowlist = z
  .array(
    z
      .string()
      .trim()
      .regex(
        /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\/(?:[0-9]|[12]\d|3[0-2]))?$/,
        'IP 또는 CIDR 형식으로 입력해 주세요. 예: 203.0.113.10, 203.0.113.0/24',
      ),
  )
  .max(20, 'IP는 20개까지 등록할 수 있어요.');

export const adminCreateSchema = z.object({
  email,
  name: required('이름', 50),
  role: z.enum(AdminRole),
  password,
});
export type AdminCreateForm = z.infer<typeof adminCreateSchema>;

export const adminPatchSchema = z.object({
  name: required('이름', 50).optional(),
  role: z.enum(AdminRole).optional(),
  status: z.enum(AdminStatus).optional(),
  ipAllowlist: ipAllowlist.optional(),
});
export const adminEditFormSchema = z.object({
  name: required('이름', 50),
  role: z.enum(AdminRole),
  status: z.enum(AdminStatus),
  /** One IP / CIDR per line. */
  ipAllowlistText: z.string(),
});
export type AdminEditForm = z.infer<typeof adminEditFormSchema>;
export { ipAllowlist as ipAllowlistSchema };

export const adminPasswordResetSchema = z.object({ password });
