import { agencyRegisterSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import type { MyAgency } from '@/features/a-agency/api/schemas';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
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
 * (REJECTED → PENDING with corrected data). Body = agencyRegisterSchema (@house/shared).
 */
export async function registerAgency(req: NextRequest, mode: 'register' | 'resubmit') {
  const ctx = agencyContext(req, { mutation: true });
  if (!('state' in ctx)) return ctx;
  await mockDelay(req, 500);

  const parsed = agencyRegisterSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error.issues);
  const input = parsed.data;

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
    input.registrationNumber.replace(/\s/g, '') === ctx.state.office.registrationNumber
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
  const next: MyAgency = {
    ...base,
    name: input.name,
    representativeName: input.representativeName,
    registrationNumber: input.registrationNumber,
    businessNumber: input.businessNumber ?? null,
    phone: input.phone,
    mobile: input.mobile ?? null,
    roadAddress: input.roadAddress,
    jibunAddress: input.jibunAddress ?? null,
    addressDetail: input.addressDetail ?? null,
    lat: input.lat,
    lng: input.lng,
    intro: input.intro ?? null,
    specialties: input.specialties,
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
