import {
  agencyDecisionSchema,
  agencyJoinSchema,
  agencyRegisterSchema,
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
  roadAddress: '전라남도 순천시 중앙로 100',
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
    expect(j.isLicensed).toBe(false);
    expect(agencyJoinSchema.safeParse({ code: 'ABCDE-FGHJ0', displayName: 'x' }).success).toBe(
      false,
    );
    expect(
      agencyJoinSchema.safeParse({
        code: 'ABCDEFGHJK',
        displayName: 'x',
        isLicensed: false,
        licenseNumber: '123',
      }).success,
    ).toBe(false);
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
      roadAddress: '전라남도 순천시 중앙로 1',
      addressDetail: '2층',
      phone: '0617491234',
      registrationNumber: '46150-2020-00012',
      representativeName: '홍길동',
    });
    expect(d.address).toBe('전라남도 순천시 중앙로 1 2층');
    expect(d.roadAddress).toBe(d.address);
    expect(agencyDisclosureLines(d).map((l) => l.value)).toEqual([
      '순천공인중개사',
      '홍길동',
      '전라남도 순천시 중앙로 1 2층',
      '46150-2020-00012',
      '061-749-1234',
    ]);
  });
});
