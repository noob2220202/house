import {
  AgencyDocumentType,
  AgencyStatus,
  agencyRegisterSchema,
  agencyResubmitSchema,
  type AgencyDocumentInput,
  type AgencyResubmitInput,
} from '@house/shared';
import type { StatusTone } from '@house/ui';
import type { AgencyRegisterRequest } from '../api/queries';
import type { AgencyDocument, ApplyFormInput, ApplyFormValues, MyAgency } from '../api/schemas';
import { businessNumberDigits, formatBusinessNumber } from './registration';

/** Document slots of the application, in display order. */
export interface DocumentSlot {
  type: AgencyDocumentType;
  label: string;
  hint: string;
  /** Blocks the submit when missing. */
  required: boolean;
  /** Not blocking, but review is held without it (shown as "권장" with a warning). */
  recommended?: boolean;
  /** The owner may submit a renewed copy after approval (e.g. the yearly 공제증서). */
  renewable?: boolean;
}

/**
 * The 손해배상책임 보증서류 (공제증서 · 보증보험증권) travels as `OTHER` until the backend adds a
 * dedicated `DEDUCTION_CERT` AgencyDocumentType (see the integration doc) — the admin console
 * already labels OTHER as "공제증서 등 기타".
 */
export const DEDUCTION_CERT_TYPE = AgencyDocumentType.OTHER;

export const DOCUMENT_SLOTS: readonly DocumentSlot[] = [
  {
    type: AgencyDocumentType.REGISTRATION_CERT,
    label: '중개사무소 등록증',
    hint: '시·군·구청에서 발급한 등록증 전체가 보이게 올려 주세요.',
    required: true,
  },
  {
    type: AgencyDocumentType.BUSINESS_REG_CERT,
    label: '사업자등록증',
    hint: '상호·대표자·사업자등록번호가 신청 내용과 같아야 해요.',
    required: true,
  },
  {
    type: DEDUCTION_CERT_TYPE,
    label: '손해배상책임 보증서류',
    hint: '공제증서 또는 보증보험증권 사본이에요. 없으면 심사가 보류될 수 있어요.',
    required: false,
    recommended: true,
    renewable: true,
  },
  {
    type: AgencyDocumentType.BROKER_LICENSE,
    label: '공인중개사 자격증',
    hint: '대표 공인중개사 자격증 (선택)',
    required: false,
  },
];

export const REQUIRED_DOCUMENT_TYPES: readonly AgencyDocumentType[] = DOCUMENT_SLOTS.filter(
  (s) => s.required,
).map((s) => s.type);

export const RECOMMENDED_DOCUMENT_TYPES: readonly AgencyDocumentType[] = DOCUMENT_SLOTS.filter(
  (s) => s.recommended,
).map((s) => s.type);

/** Upload constraints for private documents (ALLOWED_DOCUMENT_MIME of @house/shared). */
export const DOCUMENT_ACCEPT = 'application/pdf,image/jpeg,image/png';
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/** Client-side pre-check of a picked file; returns a Korean error message or null when fine. */
export function validateUpload(
  file: { type: string; size: number },
  accept: string,
  maxBytes: number,
): string | null {
  const allowed = accept.split(',').map((s) => s.trim());
  if (!allowed.includes(file.type)) {
    return accept === DOCUMENT_ACCEPT
      ? 'PDF, JPG, PNG 파일만 올릴 수 있어요.'
      : 'JPG, PNG, WebP 이미지만 올릴 수 있어요.';
  }
  if (file.size > maxBytes) {
    return `파일이 너무 커요. ${Math.round(maxBytes / 1024 / 1024)}MB 이하로 올려 주세요.`;
  }
  if (file.size === 0) return '빈 파일은 올릴 수 없어요.';
  return null;
}

/** Latest document per type (re-uploads supersede older files). */
export function latestDocuments(
  documents: readonly AgencyDocument[],
): Partial<Record<AgencyDocumentType, AgencyDocument>> {
  const out: Partial<Record<AgencyDocumentType, AgencyDocument>> = {};
  for (const doc of documents) {
    const prev = out[doc.type];
    if (!prev || prev.createdAt < doc.createdAt) out[doc.type] = doc;
  }
  return out;
}

/** Required document types that have not been uploaded yet. */
export function missingDocuments(uploaded: readonly AgencyDocumentType[]): AgencyDocumentType[] {
  return REQUIRED_DOCUMENT_TYPES.filter((t) => !uploaded.includes(t));
}

/** Recommended (non-blocking) document types that have not been uploaded yet. */
export function missingRecommended(uploaded: readonly AgencyDocumentType[]): AgencyDocumentType[] {
  return RECOMMENDED_DOCUMENT_TYPES.filter((t) => !uploaded.includes(t));
}

/** When the application was last rejected (latest REJECTED history entry), or null. */
export function rejectedAt(agency: Pick<MyAgency, 'statusHistory'>): string | null {
  return (
    agency.statusHistory
      .filter((h) => h.toStatus === AgencyStatus.REJECTED)
      .map((h) => h.createdAt)
      .sort()
      .at(-1) ?? null
  );
}

/**
 * A REJECTED application whose documents were replaced after the rejection: the change is not
 * reviewed until the owner resubmits, so the status screen keeps asking for it.
 */
export function documentsChangedSinceRejection(
  agency: Pick<MyAgency, 'status' | 'statusHistory' | 'documents'>,
): boolean {
  if (agency.status !== AgencyStatus.REJECTED) return false;
  const since = rejectedAt(agency);
  if (!since) return false;
  return agency.documents.some((d) => d.createdAt > since);
}

export interface StatusView {
  /** Short label for pills. */
  label: string;
  tone: StatusTone;
  /** Index into APPLICATION_STEPS of the current step. */
  step: number;
  title: string;
  description: string;
}

/** Progress steps of an application: 신청 접수 → 서류 심사 → 승인. */
export const APPLICATION_STEPS = [
  { label: '신청 접수', description: '신청서와 서류 제출' },
  { label: '서류 심사', description: '영업일 기준 1~2일' },
  { label: '승인 완료', description: '매물 등록 시작' },
] as const;

export function statusView(status: AgencyStatus, missingDocs = 0): StatusView {
  switch (status) {
    case AgencyStatus.PENDING:
      return missingDocs > 0
        ? {
            label: '서류 보완 필요',
            tone: 'review',
            step: 0,
            title: '서류를 마저 올려 주세요',
            description: `필수 서류 ${missingDocs}건이 아직 없어요. 서류가 모두 올라오면 심사를 시작해요.`,
          }
        : {
            label: '심사 중',
            tone: 'review',
            step: 1,
            title: '신청이 접수되어 심사하고 있어요',
            description:
              '등록번호를 국가공간정보 중개업 조회와 대조하고 서류를 확인해요. 영업일 기준 1~2일 걸려요.',
          };
    case AgencyStatus.APPROVED:
      return {
        label: '승인 완료',
        tone: 'live',
        step: 3,
        title: '중개사 회원으로 승인되었어요',
        description: '이제 매물을 등록하고 내놓기·구하기 요청에 제안을 보낼 수 있어요.',
      };
    case AgencyStatus.REJECTED:
      return {
        label: '반려',
        tone: 'rejected',
        step: 1,
        title: '신청이 반려되었어요',
        description: '아래 사유를 확인하고 내용을 고쳐서 다시 신청해 주세요.',
      };
    case AgencyStatus.SUSPENDED:
      return {
        label: '이용 정지',
        tone: 'ended',
        step: 3,
        title: '사무소 이용이 정지되었어요',
        description:
          '정지 기간에는 매물이 노출되지 않아요. 사유를 확인하고 고객센터로 문의해 주세요.',
      };
  }
}

/** Empty form values for a new application. */
export const EMPTY_APPLY_FORM: Partial<ApplyFormInput> = {
  name: '',
  representativeName: '',
  registrationNumber: '',
  businessNumber: '',
  phone: '',
  mobile: '',
  roadAddress: '',
  jibunAddress: '',
  addressDetail: '',
  intro: '',
  specialties: [],
  agreeTruth: false,
  agreePrivacy: false,
};

/** Prefill the form from an existing (rejected) application for resubmission. */
export function applyFormFromAgency(agency: MyAgency): Partial<ApplyFormInput> {
  return {
    name: agency.name,
    representativeName: agency.representativeName,
    registrationNumber: agency.registrationNumber,
    businessNumber: agency.businessNumber ? formatBusinessNumber(agency.businessNumber) : '',
    phone: agency.phone,
    mobile: agency.mobile ?? '',
    roadAddress: agency.roadAddress,
    jibunAddress: agency.jibunAddress ?? '',
    addressDetail: agency.addressDetail ?? '',
    lat: agency.lat,
    lng: agency.lng,
    intro: agency.intro ?? '',
    specialties: agency.specialties,
    agreeTruth: false,
    agreePrivacy: false,
  };
}

/** The application body without the consents `registerAgency` takes separately (D8). */
const registerBodySchema = agencyRegisterSchema.omit({ consents: true });

/** Shared fields of the register / resubmit bodies, from the form values. */
function applicationFields(values: ApplyFormValues) {
  const optional = (v: string) => (v.trim() === '' ? undefined : v.trim());
  return {
    name: values.name,
    representativeName: values.representativeName,
    registrationNumber: values.registrationNumber,
    businessNumber: optional(businessNumberDigits(values.businessNumber)),
    phone: values.phone,
    mobile: optional(values.mobile),
    roadAddress: values.roadAddress,
    jibunAddress: optional(values.jibunAddress),
    addressDetail: optional(values.addressDetail),
    lat: values.lat,
    lng: values.lng,
    intro: optional(values.intro),
    specialties: values.specialties,
  };
}

const documentRefs = (documents: readonly AgencyDocumentInput[]): AgencyDocumentInput[] =>
  documents.map((d) => ({ type: d.type, mediaId: d.mediaId }));

/**
 * Form values + the uploaded documents → request body of POST /agencies (validated by the shared
 * schema; throws ZodError). The documents go with the application — the server requires the
 * 중개사무소 등록증 up front. `registerAgency` adds the privacy consent.
 */
export function toRegisterPayload(
  values: ApplyFormValues,
  documents: readonly AgencyDocumentInput[],
): AgencyRegisterRequest {
  return registerBodySchema.parse({
    ...applicationFields(values),
    documents: documentRefs(documents),
  });
}

/**
 * Corrected form values (+ newly uploaded documents, kept next to the attached ones) → request
 * body of POST /agencies/mine/resubmit (shared `agencyResubmitSchema`; throws ZodError).
 */
export function toResubmitPayload(
  values: ApplyFormValues,
  documents: readonly AgencyDocumentInput[],
): AgencyResubmitInput {
  return agencyResubmitSchema.parse({
    ...applicationFields(values),
    documents: documents.length > 0 ? documentRefs(documents) : undefined,
  });
}

/**
 * The stored application → resubmit body (the "다시 신청" action of the status screen, after the
 * owner only replaced documents — those are attached already). The owner re-confirms in a dialog
 * before it is sent.
 */
export function resubmitPayloadFromAgency(agency: MyAgency): AgencyResubmitInput {
  const optional = (v: string | null | undefined) => (v && v.trim() !== '' ? v.trim() : undefined);
  return agencyResubmitSchema.parse({
    name: agency.name,
    representativeName: agency.representativeName,
    registrationNumber: agency.registrationNumber,
    businessNumber: optional(agency.businessNumber),
    phone: agency.phone,
    mobile: optional(agency.mobile),
    roadAddress: agency.roadAddress,
    jibunAddress: optional(agency.jibunAddress),
    addressDetail: optional(agency.addressDetail),
    lat: agency.lat,
    lng: agency.lng,
    intro: optional(agency.intro),
    specialties: agency.specialties,
  });
}

/** Profile completeness for the dashboard nudge: filled items / total, plus what is missing. */
export function profileCompleteness(agency: MyAgency): {
  done: number;
  total: number;
  missing: string[];
} {
  const checks: [string, boolean][] = [
    ['로고', !!agency.logo],
    ['커버 사진', !!agency.cover],
    ['소개글', (agency.intro ?? '').trim().length >= 20],
    ['영업시간', !!agency.businessHours && Object.values(agency.businessHours).some(Boolean)],
    ['전문 분야', agency.specialties.length > 0],
  ];
  return {
    done: checks.filter(([, ok]) => ok).length,
    total: checks.length,
    missing: checks.filter(([, ok]) => !ok).map(([label]) => label),
  };
}
