import { describe, expect, it } from 'vitest';
import {
  adminCreateSchema,
  areaTypeFormSchema,
  businessInfoFormSchema,
  complexFormSchema,
  contactFormSchema,
  ipAllowlistSchema,
  noticeFormSchema,
  termsFormSchema,
  videoCreateBody,
  videoCreateBodySchema,
  videoFormSchema,
  videoPatchBody,
  videoPatchSchema,
} from './inputs';

const messages = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) => Object.fromEntries((result.error?.issues ?? []).map((i) => [i.path.join('.'), i.message]));

describe('content forms', () => {
  it('requires a notice title and body', () => {
    const result = noticeFormSchema.safeParse({
      title: '  ',
      content: '\n',
      isPinned: false,
      isPublished: false,
    });
    expect(messages(result)).toEqual({
      title: '제목을(를) 입력해 주세요.',
      content: '내용을(를) 입력해 주세요.',
    });
  });

  it('accepts only YouTube video addresses', () => {
    const base = { title: '영상', isPublished: true };
    expect(
      videoFormSchema.safeParse({ ...base, youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' }).success,
    ).toBe(true);
    expect(
      videoFormSchema.safeParse({ ...base, youtubeUrl: 'https://example.com/watch?v=1' }).success,
    ).toBe(false);
  });

  it('checks the terms version format and effective date', () => {
    const base = { type: 'SERVICE', title: '이용약관', content: '제1조', isRequired: true };
    expect(
      termsFormSchema.safeParse({ ...base, version: '1.1', effectiveDate: '2026-12-15' }).success,
    ).toBe(true);
    const invalid = messages(
      termsFormSchema.safeParse({ ...base, version: 'v2', effectiveDate: '' }),
    );
    expect(invalid.version).toContain('숫자 형식');
    expect(invalid.effectiveDate).toBe('적용일을 골라 주세요.');
  });
});

describe('video request bodies (localVideoInputSchema)', () => {
  const form = {
    title: '영상',
    youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
    description: '  ',
    regionCode: '',
    complexId: '',
    isPublished: true,
  };
  const saved = {
    title: '영상',
    youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
    description: '설명',
    regionCode: '1215033028',
    complexId: '00010184-0000-4000-8000-000101840001',
    isPublished: true,
  };

  it('leaves empty optional fields out of a create body (empty strings are a 400)', () => {
    const body = videoCreateBody(form);
    expect(body).toEqual({ title: '영상', youtubeUrl: form.youtubeUrl, isPublished: true });
    expect(videoCreateBodySchema.safeParse(body).success).toBe(true);
    expect(videoCreateBodySchema.safeParse({ ...body, regionCode: '' }).success).toBe(false);
  });

  it('sends only what changed on update, null to unlink', () => {
    expect(
      videoPatchBody(
        { ...form, description: '설명', regionCode: '1215033028', complexId: saved.complexId },
        saved,
      ),
    ).toEqual({ isPublished: true });
    const body = videoPatchBody({ ...form, title: '새 제목' }, saved);
    expect(body).toEqual({
      title: '새 제목',
      description: '',
      regionCode: null,
      complexId: null,
      isPublished: true,
    });
    expect(videoPatchSchema.safeParse(body).success).toBe(true);
  });
});

describe('site settings forms', () => {
  const business = {
    companyName: '주식회사 예시',
    ceoName: '홍길동',
    businessNumber: '000-00-00000',
    mailOrderNumber: '',
    address: '전라남도 순천시 예시로 1',
    privacyOfficer: '김담당',
    phone: '061-000-0000',
    email: 'help@example.com',
  };

  it('accepts a complete 사업자 정보', () => {
    expect(businessInfoFormSchema.safeParse(business).success).toBe(true);
  });

  it('explains what is wrong field by field', () => {
    const result = businessInfoFormSchema.safeParse({
      ...business,
      companyName: '',
      businessNumber: '123-45-67890',
      phone: '12345',
      email: 'help@',
    });
    expect(Object.keys(messages(result)).sort()).toEqual([
      'businessNumber',
      'companyName',
      'email',
      'phone',
    ]);
  });

  it('allows only https KakaoTalk channel links', () => {
    const base = { phone: '061-000-0000', email: 'help@example.com', hours: '' };
    expect(contactFormSchema.safeParse({ ...base, kakaoChannelUrl: '' }).success).toBe(true);
    expect(
      contactFormSchema.safeParse({ ...base, kakaoChannelUrl: 'https://pf.kakao.com/_x' }).success,
    ).toBe(true);
    expect(
      contactFormSchema.safeParse({ ...base, kakaoChannelUrl: 'http://pf.kakao.com/_x' }).success,
    ).toBe(false);
    expect(
      contactFormSchema.safeParse({ ...base, kakaoChannelUrl: 'javascript:alert(1)' }).success,
    ).toBe(false);
  });
});

describe('complex forms', () => {
  const complex = {
    assetType: 'APT',
    name: '신대 레이크파크 1단지',
    roadAddress: null,
    jibunAddress: null,
    emdCode: '1215033028',
    emdName: null,
    jibun: null,
    lat: 34.9215,
    lng: 127.58,
    households: 1412,
    buildings: null,
    floorsMin: 18,
    floorsMax: 25,
    approvalDate: null,
    builtYear: 2019,
    parkingTotal: null,
    parkingPerHousehold: null,
    floorAreaRatio: null,
    buildingCoverageRatio: null,
    heatingType: null,
    builder: null,
    externalCode: null,
  };

  it('accepts a minimal complex', () => {
    expect(complexFormSchema.safeParse(complex).success).toBe(true);
  });

  it('keeps coordinates inside Suncheon and floors in order', () => {
    const result = complexFormSchema.safeParse({
      ...complex,
      lat: 37.5,
      floorsMin: 30,
      emdCode: '',
    });
    expect(Object.keys(messages(result)).sort()).toEqual(['emdCode', 'floorsMax', 'lat']);
  });

  it('rejects text typed into number fields', () => {
    const result = complexFormSchema.safeParse({ ...complex, households: Number('천세대') });
    expect(messages(result).households).toBe('세대수은(는) 숫자로 입력해 주세요.');
  });

  it('requires the supply area to be at least the exclusive area', () => {
    const area = {
      exclusiveArea: 84.98,
      supplyArea: 80,
      typeName: '84A',
      pyeongLabel: null,
      households: null,
      rooms: 3,
      baths: 2,
    };
    expect(messages(areaTypeFormSchema.safeParse(area))).toEqual({
      supplyArea: '공급면적은 전용면적보다 작을 수 없어요.',
    });
    expect(areaTypeFormSchema.safeParse({ ...area, supplyArea: 112.4 }).success).toBe(true);
    expect(areaTypeFormSchema.safeParse({ ...area, supplyArea: null }).success).toBe(true);
  });
});

describe('admin account forms', () => {
  it('enforces the password policy', () => {
    const base = { email: 'new@example.com', name: '새 관리자', role: 'OPERATOR' };
    expect(adminCreateSchema.safeParse({ ...base, password: 'Abcdefgh1234!' }).success).toBe(true);
    expect(
      messages(adminCreateSchema.safeParse({ ...base, password: 'short1!' })).password,
    ).toMatch(/12자/);
    expect(
      messages(adminCreateSchema.safeParse({ ...base, password: 'abcdefghijklmnop' })).password,
    ).toMatch(/특수문자/);
  });

  it('validates IPs and CIDR ranges', () => {
    expect(ipAllowlistSchema.safeParse(['203.0.113.10', '203.0.113.0/24']).success).toBe(true);
    expect(ipAllowlistSchema.safeParse(['203.0.113']).success).toBe(false);
    expect(ipAllowlistSchema.safeParse(['203.0.113.0/40']).success).toBe(false);
    expect(ipAllowlistSchema.safeParse(['999.0.113.1']).success).toBe(false);
    expect(ipAllowlistSchema.safeParse(['203.0.113.256']).success).toBe(false);
    expect(
      ipAllowlistSchema.safeParse(Array.from({ length: 21 }, (_, i) => `10.0.0.${i}`)).success,
    ).toBe(false);
  });
});
