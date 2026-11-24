import {
  agencyDecisionSchema,
  agencyJoinSchema,
  agencyLocationUpdateSchema,
  agencyMemberUpdateSchema,
  agencyRegisterSchema,
  agencySearchQuerySchema,
  agencyUpdateSchema,
  businessHoursSchema,
  registrationNumberSchema,
} from './schemas';
import {
  canAdminTransitionAgency,
  formatBusinessNumber,
  formatInviteCode,
  isValidBusinessNumber,
  normalizeInviteCode,
  normalizeRegistrationNumber,
  registrationNumberKey,
} from './rules';
import { isOpenAt } from './hours';
import { agencyDisclosureLines, toAgencyDisclosure } from './disclosure';

const MEDIA_ID = '0190f3c2-7a4b-7cde-8f00-123456789abc';
const validRegistration = {
  name: '순천중앙공인중개사사무소',
  representativeName: '홍길동',
  registrationNumber: '제46150-2020-00012호',
  businessNumber: '220-81-62517',
  phone: '061-749-1234',
  roadAddress: '전남광주통합특별시 순천시 중앙로 100',
  lat: 34.95,
  lng: 127.48,
  documents: [{ type: 'REGISTRATION_CERT', mediaId: MEDIA_ID }],
};

describe('agency rules', () => {
  it('validates 사업자등록번호 check digits', () => {
    expect(isValidBusinessNumber('2208162517')).toBe(true);
    expect(isValidBusinessNumber('2208162518')).toBe(false);
    expect(isValidBusinessNumber('12345')).toBe(false);
    expect(formatBusinessNumber('2208162517')).toBe('220-81-62517');
  });

  it('normalizes 등록번호 printed with 제…호 and unicode dashes', () => {
    expect(normalizeRegistrationNumber(' 제 46150–2020–00012 호 ')).toBe('46150-2020-00012');
    expect(registrationNumberSchema.parse('가1234-5678')).toBe('가1234-5678');
    expect(registrationNumberSchema.safeParse('46150/2020').success).toBe(false);
    expect(registrationNumberSchema.safeParse('-123').success).toBe(false);
  });

  it('canonicalizes 등록번호 spellings so uniqueness cannot be bypassed', () => {
    expect(normalizeRegistrationNumber('46150202000012')).toBe('46150-2020-00012');
    expect(normalizeRegistrationNumber('46150-202000012')).toBe('46150-2020-00012');
    expect(normalizeRegistrationNumber('46150--2020-00012')).toBe('46150-2020-00012');
    expect(normalizeRegistrationNumber('ab-1234')).toBe('AB-1234');
    expect(registrationNumberSchema.parse('제 46150 2020 00012 호')).toBe('46150-2020-00012');
    const key = registrationNumberKey('46150-2020-00012');
    expect(key).toBe('46150202000012');
    expect(registrationNumberKey('제46150202000012호')).toBe(key);
    expect(registrationNumberKey('가1234-5678')).toBe(registrationNumberKey('가12345678'));
    expect(registrationNumberKey('ab1234-5678')).toBe('AB12345678');
    expect(registrationNumberKey('46150-2020-00013')).not.toBe(key);
  });

  it('admin 소재지 change needs a reason and at least one field; lat/lng together', () => {
    expect(agencyLocationUpdateSchema.safeParse({ roadAddress: '순천시 중앙로 1' }).success).toBe(
      false,
    );
    expect(agencyLocationUpdateSchema.safeParse({ reason: '이전신고' }).success).toBe(false);
    expect(agencyLocationUpdateSchema.safeParse({ lat: 34.9, reason: '이전신고' }).success).toBe(
      false,
    );
    expect(
      agencyLocationUpdateSchema.parse({ roadAddress: ' 순천시 중앙로 1 ', reason: '이전신고' }),
    ).toEqual({ roadAddress: '순천시 중앙로 1', reason: '이전신고' });
  });

  it('allows only the documented admin transitions', () => {
    expect(canAdminTransitionAgency('PENDING', 'APPROVED')).toBe(true);
    expect(canAdminTransitionAgency('PENDING', 'REJECTED')).toBe(true);
    expect(canAdminTransitionAgency('APPROVED', 'SUSPENDED')).toBe(true);
    expect(canAdminTransitionAgency('SUSPENDED', 'APPROVED')).toBe(true);
    expect(canAdminTransitionAgency('PENDING', 'SUSPENDED')).toBe(false);
    expect(canAdminTransitionAgency('REJECTED', 'APPROVED')).toBe(false);
    expect(canAdminTransitionAgency('APPROVED', 'REJECTED')).toBe(false);
  });

  it('normalizes and formats invite codes', () => {
    expect(normalizeInviteCode('abcde-fghjk')).toBe('ABCDEFGHJK');
    expect(formatInviteCode('ABCDEFGHJK')).toBe('ABCDE-FGHJK');
  });
});

describe('agency schemas', () => {
  it('parses a registration and normalizes numbers', () => {
    const r = agencyRegisterSchema.parse(validRegistration);
    expect(r.registrationNumber).toBe('46150-2020-00012');
    expect(r.businessNumber).toBe('2208162517');
    expect(r.phone).toBe('0617491234');
  });

  it('takes the 개인정보 동의 as consents [{ type, version }] (D8; presence is checked by the API)', () => {
    expect(agencyRegisterSchema.parse(validRegistration).consents).toEqual([]);
    const consents = [{ type: 'PRIVACY_AGENCY_APPLICATION', version: '1.0' }];
    expect(agencyRegisterSchema.parse({ ...validRegistration, consents }).consents).toEqual(
      consents,
    );
    for (const bad of [
      [{ type: 'PRIVACY_AGENCY_JOIN', version: '1.0' }],
      [{ type: 'PRIVACY_AGENCY_APPLICATION', version: '' }],
      [{ type: 'PRIVACY_AGENCY_APPLICATION', version: "1' OR 1=1" }],
      [...consents, ...consents],
    ]) {
      expect(agencyRegisterSchema.safeParse({ ...validRegistration, consents: bad }).success).toBe(
        false,
      );
    }
    expect(
      agencyJoinSchema.parse({
        code: 'ABCDEFGHJK',
        displayName: '김실장',
        consents: [{ type: 'PRIVACY_AGENCY_JOIN', version: '2026-11-01' }],
      }).consents,
    ).toEqual([{ type: 'PRIVACY_AGENCY_JOIN', version: '2026-11-01' }]);
    expect(
      agencyJoinSchema.safeParse({
        code: 'ABCDEFGHJK',
        displayName: '김실장',
        consents: [{ type: 'PRIVACY_AGENCY_APPLICATION', version: '1.0' }],
      }).success,
    ).toBe(false);
  });

  it('requires a 등록증 and rejects duplicate files', () => {
    const noCert = agencyRegisterSchema.safeParse({
      ...validRegistration,
      documents: [{ type: 'BUSINESS_REG_CERT', mediaId: MEDIA_ID }],
    });
    expect(noCert.success).toBe(false);
    const dup = agencyRegisterSchema.safeParse({
      ...validRegistration,
      documents: [
        { type: 'REGISTRATION_CERT', mediaId: MEDIA_ID },
        { type: 'OTHER', mediaId: MEDIA_ID },
      ],
    });
    expect(dup.success).toBe(false);
  });

  it('rejects a bad 사업자등록번호', () => {
    expect(
      agencyRegisterSchema.safeParse({ ...validRegistration, businessNumber: '1234567890' })
        .success,
    ).toBe(false);
  });

  it('validates business hours', () => {
    expect(
      businessHoursSchema.parse({ mon: { open: '09:00', close: '18:00' }, sun: null }),
    ).toEqual({ mon: { open: '09:00', close: '18:00' }, sun: null });
    expect(businessHoursSchema.safeParse({ mon: { open: '18:00', close: '09:00' } }).success).toBe(
      false,
    );
    expect(businessHoursSchema.safeParse({ mon: { open: '9시', close: '18:00' } }).success).toBe(
      false,
    );
    expect(businessHoursSchema.safeParse({ holiday: null }).success).toBe(false);
  });

  it('update takes logo and cover media ids (null removes them)', () => {
    const id = '0192f2a0-0000-7000-8000-000000000001';
    expect(agencyUpdateSchema.parse({ coverMediaId: id })).toMatchObject({ coverMediaId: id });
    expect(agencyUpdateSchema.parse({ coverMediaId: null, logoMediaId: null })).toMatchObject({
      coverMediaId: null,
      logoMediaId: null,
    });
    expect(agencyUpdateSchema.safeParse({ coverMediaId: 'cover.png' }).success).toBe(false);
  });

  it('office search takes openNow / handlesPresale flags', () => {
    expect(agencySearchQuerySchema.parse({ openNow: 'true', handlesPresale: '1' })).toMatchObject({
      openNow: true,
      handlesPresale: true,
    });
    const plain = agencySearchQuerySchema.parse({});
    expect(plain.openNow).toBeUndefined();
    expect(plain.handlesPresale).toBeUndefined();
    expect(agencySearchQuerySchema.safeParse({ openNow: 'yes' }).success).toBe(false);
  });

  it('update needs at least one field and lat/lng together', () => {
    expect(agencyUpdateSchema.safeParse({}).success).toBe(false);
    expect(agencyUpdateSchema.safeParse({ lat: 34.9 }).success).toBe(false);
    expect(agencyUpdateSchema.parse({ intro: '안녕하세요' })).toEqual({ intro: '안녕하세요' });
  });

  it('decision needs a reason unless approving', () => {
    expect(agencyDecisionSchema.safeParse({ status: 'APPROVED' }).success).toBe(true);
    expect(agencyDecisionSchema.safeParse({ status: 'REJECTED' }).success).toBe(false);
    expect(agencyDecisionSchema.safeParse({ status: 'PENDING', reason: 'x' }).success).toBe(false);
  });

  it('join normalizes the code and checks the alphabet', () => {
    const j = agencyJoinSchema.parse({ code: 'abcde-fghjk', displayName: '김실장' });
    expect(j.code).toBe('ABCDEFGHJK');
    expect(agencyJoinSchema.safeParse({ code: 'ABCDE-FGHJ0', displayName: 'x' }).success).toBe(
      false,
    );
  });

  it('join cannot self-declare 소속공인중개사 (the flag and license number are stripped)', () => {
    const j = agencyJoinSchema.parse({
      code: 'ABCDEFGHJK',
      displayName: '보조원',
      isLicensed: true,
      licenseNumber: '2020-1234',
    });
    expect(j).not.toHaveProperty('isLicensed');
    expect(j).not.toHaveProperty('licenseNumber');
  });

  it('member update: 소속공인중개사 needs a well-formed license number; 보조원 has none', () => {
    expect(agencyMemberUpdateSchema.safeParse({ isLicensed: true }).success).toBe(false);
    expect(
      agencyMemberUpdateSchema.safeParse({ isLicensed: true, licenseNumber: null }).success,
    ).toBe(false);
    expect(
      agencyMemberUpdateSchema.safeParse({ isLicensed: true, licenseNumber: '!!' }).success,
    ).toBe(false);
    expect(
      agencyMemberUpdateSchema.safeParse({ isLicensed: true, licenseNumber: 'abc-def' }).success,
    ).toBe(false);
    expect(
      agencyMemberUpdateSchema.parse({ isLicensed: true, licenseNumber: '제2019-전남-00123호' }),
    ).toEqual({ isLicensed: true, licenseNumber: '2019-전남-00123' });
    expect(
      agencyMemberUpdateSchema.safeParse({ isLicensed: false, licenseNumber: '2020-1' }).success,
    ).toBe(false);
    expect(agencyMemberUpdateSchema.parse({ isLicensed: false })).toEqual({ isLicensed: false });
  });
});

describe('business hours', () => {
  const hours = { mon: { open: '09:00', close: '18:00' }, sun: null };
  it('evaluates in KST', () => {
    // 2026-11-23 is a Monday. 00:30Z = 09:30 KST.
    expect(isOpenAt(hours, new Date('2026-11-23T00:30:00Z'))).toBe(true);
    // 09:30Z = 18:30 KST.
    expect(isOpenAt(hours, new Date('2026-11-23T09:30:00Z'))).toBe(false);
    // Sunday.
    expect(isOpenAt(hours, new Date('2026-11-22T03:00:00Z'))).toBe(false);
    expect(isOpenAt(null, new Date())).toBeNull();
  });
});

describe('disclosure', () => {
  it('builds the 명시사항 block', () => {
    const d = toAgencyDisclosure({
      id: 'a1',
      name: '순천공인중개사',
      roadAddress: '전남광주통합특별시 순천시 중앙로 1',
      addressDetail: '2층',
      phone: '0617491234',
      registrationNumber: '46150-2020-00012',
      representativeName: '홍길동',
    });
    expect(d.address).toBe('전남광주통합특별시 순천시 중앙로 1 2층');
    expect(d.roadAddress).toBe(d.address);
    expect(agencyDisclosureLines(d).map((l) => l.value)).toEqual([
      '순천공인중개사',
      '홍길동',
      '전남광주통합특별시 순천시 중앙로 1 2층',
      '46150-2020-00012',
      '061-749-1234',
    ]);
  });
});
