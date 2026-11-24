import { agencyRegisterSchema, agencyResubmitSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import type { MyAgency } from '@/features/a-agency/api/schemas';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import { mediaStore } from '../../media/_store';
import { APPLICANT_AGENCY_ID } from './_fixtures';
import {
  agencyContext,
  agencyNotFound,
  mockId,
  readJson,
  saveAgency,
  validationError,
} from './_store';

/**
 * Shared body of POST /agencies (register → PENDING) and POST /agencies/mine/resubmit
 * (REJECTED → PENDING with corrected data). Body = agencyRegisterSchema (documents with the 등록증
 * + `consents`) / agencyResubmitSchema (every field optional, extra documents) of @house/shared.
 * The mock does not check consent versions (the real server answers AUTH_CONSENT_REQUIRED /
 * AUTH_CONSENT_OUTDATED); it only requires the entry to be there.
 */
export async function registerAgency(req: NextRequest, mode: 'register' | 'resubmit') {
  const ctx = agencyContext(req, { mutation: true });
  if (!('state' in ctx)) return ctx;
  await mockDelay(req, 500);

  const body = await readJson(req);
  const parsed =
    mode === 'register'
      ? agencyRegisterSchema.safeParse(body)
      : agencyResubmitSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.issues);
  const input = parsed.data;
  if (mode === 'register' && !('consents' in input && input.consents.length > 0)) {
    return mockError(400, 'AUTH_CONSENT_REQUIRED', '필수 동의 항목에 동의해 주세요.');
  }
  const media = mediaStore();
  const unknownDoc = (input.documents ?? []).findIndex(
    (d) => media.get(d.mediaId)?.purpose !== 'AGENCY_DOCUMENT',
  );
  if (unknownDoc !== -1) {
    return mockError(400, 'VALIDATION_FAILED', '업로드한 서류를 찾을 수 없습니다.', [
      { path: `documents.${unknownDoc}.mediaId`, message: '업로드한 서류를 찾을 수 없습니다.' },
    ]);
  }

  const current = ctx.agency;
  if (mode === 'register' && current) {
    return mockError(409, 'AGENCY_ALREADY_REGISTERED', '이미 신청한 중개사무소가 있습니다.');
  }
  if (mode === 'resubmit') {
    if (!current) return agencyNotFound();
    if (current.status !== 'REJECTED') {
      return mockError(
        409,
        'AGENCY_INVALID_STATUS_TRANSITION',
        '현재 상태에서는 변경할 수 없습니다.',
      );
    }
  }
  // Unique registration number (the approved fixture office holds 46150-2017-00112).
  if (
    ctx.role === 'USER' &&
    input.registrationNumber?.replace(/\s/g, '') === ctx.state.office.registrationNumber
  ) {
    return mockError(
      409,
      'AGENCY_REGISTRATION_DUPLICATE',
      '이미 등록된 중개사무소 등록번호입니다.',
      [{ path: 'registrationNumber', message: '이미 등록된 중개사무소 등록번호입니다.' }],
    );
  }

  const now = new Date().toISOString();
  const base: MyAgency = current ?? {
    id: APPLICANT_AGENCY_ID,
    name: '',
    representativeName: '',
    registrationNumber: '',
    phone: '',
    roadAddress: '',
    lat: 0,
    lng: 0,
    specialties: [],
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
    activeListingCount: 0,
    viewCount: 0,
    warningCount: 0,
    myRole: 'OWNER',
    documents: [],
    statusHistory: [],
  };
  // Resubmit: a field left out keeps the stored value (agencyResubmitSchema is all-optional).
  const keep = <T>(value: T | undefined, stored: T) => (value === undefined ? stored : value);
  const documents = (input.documents ?? []).map((d) => ({
    id: mockId('doc'),
    type: d.type,
    mediaId: d.mediaId,
    mimeType: media.get(d.mediaId)?.mimeType,
    fileName: null,
    createdAt: now,
  }));
  const next: MyAgency = {
    ...base,
    name: keep(input.name, base.name),
    representativeName: keep(input.representativeName, base.representativeName),
    registrationNumber: keep(input.registrationNumber, base.registrationNumber),
    businessNumber: keep(input.businessNumber, base.businessNumber ?? null) ?? null,
    phone: keep(input.phone, base.phone),
    mobile: keep(input.mobile, base.mobile ?? null) ?? null,
    roadAddress: keep(input.roadAddress, base.roadAddress),
    jibunAddress: keep(input.jibunAddress, base.jibunAddress ?? null) ?? null,
    addressDetail: keep(input.addressDetail, base.addressDetail ?? null) ?? null,
    lat: keep(input.lat, base.lat),
    lng: keep(input.lng, base.lng),
    intro: keep(input.intro, base.intro ?? null) ?? null,
    specialties: keep(input.specialties, base.specialties) ?? [],
    documents: [...base.documents, ...documents],
    status: 'PENDING',
    statusReason: null,
    statusHistory: [
      {
        id: mockId('hist'),
        fromStatus: current ? current.status : null,
        toStatus: 'PENDING',
        reason: null,
        createdAt: now,
      },
      ...base.statusHistory,
    ],
  };
  return mockJson(saveAgency(ctx, next), { status: mode === 'register' ? 201 : 200 });
}
