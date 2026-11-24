import {
  ACCOUNT_TERMS_TYPES,
  ACTION_CONSENT_TERMS,
  isAccountTermsType,
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
  });

  it('labels every type in Korean', () => {
    for (const t of Object.values(TermsType)) expect(TERMS_TYPE_LABEL[t]).toMatch(/[가-힣]/);
  });
});
