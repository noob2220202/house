import { AgencyDocumentType, AgencyStatus } from '@house/shared';
import { describe, expect, it } from 'vitest';
import { applyFormSchema, type AgencyDocument, type MyAgency } from '../api/schemas';
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_MAX_BYTES,
  IMAGE_ACCEPT,
  PRIVACY_CONSENT_VERSION,
  applyFormFromAgency,
  documentsChangedSinceRejection,
  latestDocuments,
  missingDocuments,
  missingRecommended,
  registerPayloadFromAgency,
  profileCompleteness,
  statusView,
  toRegisterPayload,
  validateUpload,
} from './application';

const doc = (
  type: AgencyDocumentType,
  createdAt: string,
  id = `${type}-${createdAt}`,
): AgencyDocument => ({
  id,
  type,
  mediaId: `m-${id}`,
  createdAt,
});

const agency: MyAgency = {
  id: 'a1',
  name: '신대중앙 공인중개사사무소',
  representativeName: '김서진',
  registrationNumber: '46150-2017-00112',
  businessNumber: '0000000000',
  phone: '0610000000',
  mobile: null,
  roadAddress: '전라남도 순천시 해룡면 신대1로 18',
  jibunAddress: null,
  addressDetail: '105호',
  lat: 34.9362,
  lng: 127.5551,
  intro: null,
  businessHours: null,
  specialties: ['APT'],
  logo: null,
  cover: null,
  status: 'APPROVED',
  createdAt: '2025-03-10T05:05:00Z',
  updatedAt: '2025-03-10T05:05:00Z',
  activeListingCount: 0,
  viewCount: 0,
  warningCount: 0,
  myRole: 'OWNER',
  documents: [],
  statusHistory: [],
};

describe('documents', () => {
  it('keeps the latest document per type', () => {
    const latest = latestDocuments([
      doc('REGISTRATION_CERT', '2026-11-01T00:00:00Z', 'old'),
      doc('REGISTRATION_CERT', '2026-11-20T00:00:00Z', 'new'),
      doc('OTHER', '2026-11-02T00:00:00Z'),
    ]);
    expect(latest.REGISTRATION_CERT?.id).toBe('new');
    expect(latest.BUSINESS_REG_CERT).toBeUndefined();
    expect(Object.keys(latest)).toHaveLength(2);
  });
  it('lists missing required documents', () => {
    expect(missingDocuments([])).toEqual([
      AgencyDocumentType.REGISTRATION_CERT,
      AgencyDocumentType.BUSINESS_REG_CERT,
    ]);
    expect(missingDocuments(['REGISTRATION_CERT', 'OTHER'])).toEqual(['BUSINESS_REG_CERT']);
    expect(missingDocuments(['BUSINESS_REG_CERT', 'REGISTRATION_CERT'])).toEqual([]);
  });
  it('pre-checks uploads by type and size', () => {
    expect(
      validateUpload({ type: 'application/pdf', size: 1000 }, DOCUMENT_ACCEPT, DOCUMENT_MAX_BYTES),
    ).toBeNull();
    expect(
      validateUpload({ type: 'image/webp', size: 1000 }, DOCUMENT_ACCEPT, DOCUMENT_MAX_BYTES),
    ).toMatch(/PDF/);
    expect(
      validateUpload({ type: 'application/pdf', size: 1000 }, IMAGE_ACCEPT, DOCUMENT_MAX_BYTES),
    ).toMatch(/이미지/);
    expect(
      validateUpload(
        { type: 'image/png', size: DOCUMENT_MAX_BYTES + 1 },
        DOCUMENT_ACCEPT,
        DOCUMENT_MAX_BYTES,
      ),
    ).toMatch(/10MB/);
    expect(
      validateUpload({ type: 'image/png', size: 0 }, DOCUMENT_ACCEPT, DOCUMENT_MAX_BYTES),
    ).toMatch(/빈 파일/);
  });
});

describe('statusView', () => {
  it('maps every status to a step and tone', () => {
    expect(statusView(AgencyStatus.PENDING)).toMatchObject({
      step: 1,
      tone: 'review',
      label: '심사 중',
    });
    expect(statusView(AgencyStatus.PENDING, 1)).toMatchObject({ step: 0, label: '서류 보완 필요' });
    expect(statusView(AgencyStatus.APPROVED)).toMatchObject({ step: 3, tone: 'live' });
    expect(statusView(AgencyStatus.REJECTED)).toMatchObject({ step: 1, tone: 'rejected' });
    expect(statusView(AgencyStatus.SUSPENDED)).toMatchObject({ tone: 'ended' });
  });
});

describe('application form', () => {
  const valid = {
    name: ' 조례한빛 공인중개사사무소 ',
    representativeName: '김하늘',
    registrationNumber: '46150202600095',
    businessNumber: '000-00-00000',
    phone: '061-000-0000',
    mobile: '',
    roadAddress: '전라남도 순천시 조례동 호수공원길 31',
    jibunAddress: '',
    addressDetail: '1층 102호',
    lat: 34.9573,
    lng: 127.5248,
    intro: '',
    specialties: ['APT' as const],
    agreeTruth: true,
    agreePrivacy: true,
  };

  it('normalizes values and builds the register payload of the shared schema', () => {
    const parsed = applyFormSchema.parse(valid);
    expect(parsed.registrationNumber).toBe('46150-2026-00095');
    const payload = toRegisterPayload(parsed);
    expect(payload).toMatchObject({
      name: '조례한빛 공인중개사사무소',
      registrationNumber: '46150-2026-00095',
      businessNumber: '0000000000',
      phone: '0610000000',
      addressDetail: '1층 102호',
      lat: 34.9573,
      specialties: ['APT'],
    });
    expect(payload.mobile).toBeUndefined();
    expect(payload.intro).toBeUndefined();
    expect(payload.jibunAddress).toBeUndefined();
    expect(payload).not.toHaveProperty('agreeTruth');
    expect(payload).not.toHaveProperty('agreePrivacy');
    expect(payload.consents).toEqual([
      { type: 'PRIVACY_AGENCY_APPLICATION', version: PRIVACY_CONSENT_VERSION },
    ]);
  });

  it('reports field errors in Korean', () => {
    const result = applyFormSchema.safeParse({
      ...valid,
      name: '',
      businessNumber: '123-45-67890',
      phone: '1234',
      mobile: '061-000-0000',
      lat: undefined,
      agreeTruth: false,
      agreePrivacy: false,
    });
    expect(result.success).toBe(false);
    const paths = result.success ? [] : result.error.issues.map((i) => i.path.join('.'));
    expect(paths).toEqual(
      expect.arrayContaining([
        'name',
        'businessNumber',
        'phone',
        'mobile',
        'lat',
        'agreeTruth',
        'agreePrivacy',
      ]),
    );
    const latIssue = result.success
      ? undefined
      : result.error.issues.find((i) => i.path[0] === 'lat');
    expect(latIssue?.message).toBe('지도에서 사무소 위치를 지정해 주세요.');
  });

  it('prefills the form from a rejected application', () => {
    const form = applyFormFromAgency({ ...agency, status: 'REJECTED' });
    expect(form).toMatchObject({
      name: agency.name,
      businessNumber: '000-00-00000',
      mobile: '',
      addressDetail: '105호',
      agreeTruth: false,
      agreePrivacy: false,
    });
  });
});

describe('profileCompleteness', () => {
  it('counts filled profile items', () => {
    expect(profileCompleteness(agency)).toMatchObject({ done: 1, total: 5 });
    const full = profileCompleteness({
      ...agency,
      intro: '신대지구 입주 때부터 레이크파크 단지만 중개하고 있어요.',
      businessHours: { mon: { open: '09:00', close: '18:00' } },
      logo: {
        id: 'l',
        purpose: 'AGENCY_LOGO',
        mimeType: 'image/png',
        width: null,
        height: null,
        variants: {},
      },
      cover: {
        id: 'c',
        purpose: 'AGENCY_LOGO',
        mimeType: 'image/png',
        width: null,
        height: null,
        variants: {},
      },
    });
    expect(full).toEqual({ done: 5, total: 5, missing: [] });
  });
});

describe('rejected applications', () => {
  const rejected: MyAgency = {
    ...agency,
    status: 'REJECTED',
    statusHistory: [
      {
        id: 'h1',
        fromStatus: null,
        toStatus: 'PENDING',
        reason: null,
        createdAt: '2026-11-20T00:00:00Z',
      },
      {
        id: 'h2',
        fromStatus: 'PENDING',
        toStatus: 'REJECTED',
        reason: '사업자등록증이 흐려요',
        createdAt: '2026-11-21T00:00:00Z',
      },
    ],
    documents: [doc('BUSINESS_REG_CERT', '2026-11-20T00:00:00Z')],
  };

  it('notices documents replaced after the rejection', () => {
    expect(documentsChangedSinceRejection(rejected)).toBe(false);
    expect(
      documentsChangedSinceRejection({
        ...rejected,
        documents: [...rejected.documents, doc('BUSINESS_REG_CERT', '2026-11-22T00:00:00Z')],
      }),
    ).toBe(true);
    expect(
      documentsChangedSinceRejection({
        ...rejected,
        status: 'PENDING',
        documents: [doc('BUSINESS_REG_CERT', '2026-11-22T00:00:00Z')],
      }),
    ).toBe(false);
  });

  it('builds a resubmit body from the stored application', () => {
    const body = registerPayloadFromAgency(rejected);
    expect(body).toMatchObject({
      name: agency.name,
      registrationNumber: agency.registrationNumber,
      businessNumber: '0000000000',
      addressDetail: '105호',
      specialties: ['APT'],
      consents: [{ type: 'PRIVACY_AGENCY_APPLICATION', version: PRIVACY_CONSENT_VERSION }],
    });
    expect(body.mobile).toBeUndefined();
    expect(body.intro).toBeUndefined();
  });
});

describe('recommended documents', () => {
  it('flags a missing 손해배상책임 보증서류 without blocking', () => {
    expect(missingRecommended(['REGISTRATION_CERT'])).toEqual(['OTHER']);
    expect(missingRecommended(['OTHER'])).toEqual([]);
    expect(missingDocuments(['REGISTRATION_CERT', 'BUSINESS_REG_CERT'])).toEqual([]);
  });
});

describe('service area', () => {
  it('rejects an office pin outside 순천시', () => {
    const result = applyFormSchema.safeParse({
      name: 'a',
      representativeName: 'b',
      registrationNumber: '46150-2026-00095',
      businessNumber: '000-00-00000',
      phone: '061-000-0000',
      mobile: '',
      roadAddress: '서울',
      jibunAddress: '',
      addressDetail: '',
      lat: 37.56,
      lng: 126.97,
      intro: '',
      specialties: [],
      agreeTruth: true,
      agreePrivacy: true,
    });
    expect(result.success).toBe(false);
    const issue = result.success ? undefined : result.error.issues.find((i) => i.path[0] === 'lat');
    expect(issue?.message).toBe('순천시 안에 있는 사무소 위치만 등록할 수 있어요.');
  });
});
