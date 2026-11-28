import {
  AGENCY_SITE_STATUS_LABEL,
  AgencySiteStatus,
  SUBSCRIPTION_PRODUCT_LABEL,
  SubscriptionProduct,
} from './agency';
import {
  INQUIRY_AUTHOR_LABEL,
  INQUIRY_CHANNEL_LABEL,
  INQUIRY_CONTACT_CHANNELS,
  INQUIRY_SOURCE_LABEL,
  INQUIRY_STATUS_LABEL,
  InquiryAuthor,
  InquiryChannel,
  InquirySource,
  InquiryStatus,
} from './inquiry';
import {
  ACCOUNT_TERMS_TYPES,
  ACTION_CONSENT_TERMS,
  isAccountTermsType,
  NOTIFICATION_TYPE_LABEL,
  NotificationType,
  TERMS_TYPE_LABEL,
  TermsType,
} from './user';

describe('terms types (D8)', () => {
  it('splits every type into account terms or exactly one action’s purpose consent', () => {
    const purpose = Object.values(ACTION_CONSENT_TERMS).flat();
    expect(new Set(purpose).size).toBe(purpose.length);
    expect([...ACCOUNT_TERMS_TYPES, ...purpose].sort()).toEqual(Object.values(TermsType).sort());
    expect(purpose.some((t) => isAccountTermsType(t))).toBe(false);
    expect(isAccountTermsType(TermsType.SERVICE)).toBe(true);
  });

  it('asks the right consents per action', () => {
    expect(ACTION_CONSENT_TERMS.AGENCY_APPLICATION).toEqual(['PRIVACY_AGENCY_APPLICATION']);
    expect(ACTION_CONSENT_TERMS.AGENCY_JOIN).toEqual(['PRIVACY_AGENCY_JOIN']);
    expect(ACTION_CONSENT_TERMS.DEAL_REQUEST).toEqual([
      'DEAL_REQUEST_PRIVACY',
      'DEAL_REQUEST_PROVIDE',
    ]);
    expect(ACTION_CONSENT_TERMS.INQUIRY).toEqual(['INQUIRY_PRIVACY']);
  });

  it('labels every type in Korean', () => {
    for (const t of Object.values(TermsType)) expect(TERMS_TYPE_LABEL[t]).toMatch(/[가-힣]/);
  });
});

describe('enum labels', () => {
  const cases: [string, Record<string, string>, Record<string, string>][] = [
    ['AgencySiteStatus', AgencySiteStatus, AGENCY_SITE_STATUS_LABEL],
    ['SubscriptionProduct', SubscriptionProduct, SUBSCRIPTION_PRODUCT_LABEL],
    ['InquiryChannel', InquiryChannel, INQUIRY_CHANNEL_LABEL],
    ['InquiryStatus', InquiryStatus, INQUIRY_STATUS_LABEL],
    ['InquirySource', InquirySource, INQUIRY_SOURCE_LABEL],
    ['InquiryAuthor', InquiryAuthor, INQUIRY_AUTHOR_LABEL],
    ['NotificationType', NotificationType, NOTIFICATION_TYPE_LABEL],
  ];

  it.each(cases)('%s: every value has a Korean label and nothing else', (_name, e, label) => {
    expect(Object.keys(label).sort()).toEqual(Object.values(e).sort());
    for (const v of Object.values(e)) expect(label[v]).toMatch(/[가-힣]/);
  });

  it('uses the final copy of the spec', () => {
    expect(AGENCY_SITE_STATUS_LABEL).toEqual({
      REQUESTED: '신청 중',
      ACTIVE: '운영 중',
      REJECTED: '반려',
      SUSPENDED: '정지',
    });
    expect(INQUIRY_STATUS_LABEL).toEqual({
      NEW: '새 문의',
      IN_PROGRESS: '응대 중',
      DONE: '응대 완료',
    });
    expect(INQUIRY_SOURCE_LABEL).toEqual({ MAIN: '순천부동산지도', SITE: '사무소 홈페이지' });
    expect(TERMS_TYPE_LABEL.INQUIRY_PRIVACY).toBe('문의 개인정보 수집·이용 및 제공 동의');
  });

  it('contact events are every channel but MESSAGE', () => {
    expect([...INQUIRY_CONTACT_CHANNELS].sort()).toEqual(
      Object.values(InquiryChannel)
        .filter((c) => c !== InquiryChannel.MESSAGE)
        .sort(),
    );
  });
});
