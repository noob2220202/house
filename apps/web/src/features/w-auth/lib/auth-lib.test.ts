import { TermsType } from '@house/shared';
import { describe, expect, it } from 'vitest';
import type { TermsDocument } from '../api';
import { identityListSchema, termsListSchema } from '../api';
import {
  agreeAllState,
  buildConsentPayload,
  countTerms,
  missingRequired,
  setAll,
  sortTerms,
} from './consents';
import { maskEmail, maskName } from './mask';
import { normalizeOAuthErrorCode, oauthErrorInfo } from './oauth-errors';
import {
  INTEREST_REGIONS,
  MAX_INTEREST_REGIONS,
  filterRegionGroups,
  sanitizeRegionKeys,
  toggleRegion,
} from './regions';
import { nicknameSchema } from './signup-schema';
import { WITHDRAW_REASON_MAX, buildWithdrawReason, withdrawFormSchema } from './withdraw';

const doc = (type: TermsType, isRequired: boolean, version = '1.0'): TermsDocument => ({
  id: `doc-${type}`,
  type,
  version,
  title: type,
  isRequired,
  effectiveAt: '2026-10-01T00:00:00+09:00',
});
const DOCS = [
  doc(TermsType.MARKETING, false),
  doc(TermsType.LOCATION, true),
  doc(TermsType.SERVICE, true),
  doc(TermsType.PRIVACY, true, '1.1'),
];

describe('consents', () => {
  it('orders documents 이용약관 → 개인정보 → 위치기반 → 마케팅', () => {
    expect(sortTerms(DOCS).map((d) => d.type)).toEqual([
      'SERVICE',
      'PRIVACY',
      'LOCATION',
      'MARKETING',
    ]);
    expect(countTerms(DOCS)).toEqual({ required: 3, optional: 1 });
  });
  it('전체 동의 covers optional documents too', () => {
    const all = setAll(DOCS, true);
    expect(agreeAllState(DOCS, all)).toBe('all');
    expect(agreeAllState(DOCS, { ...all, MARKETING: false })).toBe('some');
    expect(agreeAllState(DOCS, setAll(DOCS, false))).toBe('none');
    expect(agreeAllState([], {})).toBe('none');
  });
  it('finds missing required consents', () => {
    expect(missingRequired(DOCS, { SERVICE: true }).map((d) => d.type)).toEqual([
      'LOCATION',
      'PRIVACY',
    ]);
    expect(missingRequired(DOCS, { SERVICE: true, PRIVACY: true, LOCATION: true })).toEqual([]);
  });
  it('builds a versioned payload with one record per document', () => {
    expect(buildConsentPayload(DOCS, { SERVICE: true, PRIVACY: true, LOCATION: true })).toEqual({
      consents: [
        { termsDocumentId: 'doc-MARKETING', agreed: false },
        { termsDocumentId: 'doc-LOCATION', agreed: true },
        { termsDocumentId: 'doc-SERVICE', agreed: true },
        { termsDocumentId: 'doc-PRIVACY', agreed: true },
      ],
    });
  });
});

describe('response schemas', () => {
  it('accept a bare list or an { items } envelope', () => {
    expect(termsListSchema.parse(DOCS)).toHaveLength(4);
    expect(termsListSchema.parse({ items: DOCS })).toHaveLength(4);
    expect(
      identityListSchema.parse({ items: [{ provider: 'KAKAO', email: null, createdAt: null }] }),
    ).toEqual([{ provider: 'KAKAO', email: null, createdAt: null }]);
  });
  it('reject providers other than 카카오 / 네이버 / Google', () => {
    expect(identityListSchema.safeParse([{ provider: 'APPLE' }]).success).toBe(false);
  });
});

describe('interest regions', () => {
  it('has unique keys and positions inside the map', () => {
    const keys = INTEREST_REGIONS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const r of INTEREST_REGIONS) {
      expect(r.x).toBeGreaterThan(0);
      expect(r.x).toBeLessThan(100);
      expect(r.y).toBeGreaterThanOrEqual(35);
      expect(r.y).toBeLessThanOrEqual(76);
    }
  });
  it('toggles and refuses a sixth region', () => {
    let keys: string[] = [];
    for (const k of ['sindae', 'seonwol', 'yeonhyang', 'jorye', 'wangji']) {
      keys = toggleRegion(keys, k).keys;
    }
    expect(keys).toHaveLength(MAX_INTEREST_REGIONS);
    expect(toggleRegion(keys, 'maegok')).toEqual({ keys, limitReached: true });
    expect(toggleRegion(keys, 'sindae')).toEqual({
      keys: ['seonwol', 'yeonhyang', 'jorye', 'wangji'],
      limitReached: false,
    });
    expect(toggleRegion([], 'unknown')).toEqual({ keys: [], limitReached: false });
  });
  it('sanitizes stored keys', () => {
    expect(sanitizeRegionKeys(['sindae', 'sindae', 'nope', 'jorye'])).toEqual(['sindae', 'jorye']);
    expect(sanitizeRegionKeys(null)).toEqual([]);
    expect(sanitizeRegionKeys(INTEREST_REGIONS.map((r) => r.key))).toHaveLength(5);
  });
  it('searches by name and keyword, ignoring spaces', () => {
    expect(filterRegionGroups('')).toHaveLength(4);
    expect(filterRegionGroups('왕지').flatMap((g) => g.regions.map((r) => r.key))).toEqual([
      'wangji',
    ]);
    expect(filterRegionGroups('순천대').flatMap((g) => g.regions.map((r) => r.key))).toEqual([
      'seokhyeon',
    ]);
    expect(filterRegionGroups(' 신 대 ').flatMap((g) => g.regions.map((r) => r.key))).toEqual([
      'sindae',
    ]);
    expect(filterRegionGroups('서울')).toEqual([]);
  });
});

describe('masking', () => {
  it('masks names', () => {
    expect(maskName('김서진')).toBe('김*진');
    expect(maskName('김진')).toBe('김*');
    expect(maskName('남궁서진')).toBe('남**진');
    expect(maskName('')).toBe('');
    expect(maskName(null)).toBe('');
  });
  it('masks e-mail local parts', () => {
    expect(maskEmail('kimseojin@kakao.com')).toBe('ki***@kakao.com');
    expect(maskEmail('a@naver.com')).toBe('a***@naver.com');
    expect(maskEmail('ab@naver.com')).toBe('a***@naver.com');
    expect(maskEmail('not-an-email')).toBe('');
    expect(maskEmail(undefined)).toBe('');
  });
});

describe('oauth errors', () => {
  it('normalizes codes safely', () => {
    expect(normalizeOAuthErrorCode('access_denied')).toBe('ACCESS_DENIED');
    expect(normalizeOAuthErrorCode('<script>alert(1)</script>')).toBe('_SCRIPT_ALERT_1___SCRIPT_');
    expect(normalizeOAuthErrorCode('')).toBe('UNKNOWN');
    expect(normalizeOAuthErrorCode('x'.repeat(200))).toHaveLength(48);
  });
  it('explains known failures in Korean', () => {
    expect(oauthErrorInfo('access_denied')).toMatchObject({
      title: '로그인을 취소했어요',
      tone: 'notice',
      canRetry: true,
    });
    expect(oauthErrorInfo('AUTH_OAUTH_STATE_INVALID').title).toBe('로그인 요청이 만료됐어요');
    expect(oauthErrorInfo('AUTH_OAUTH_PROVIDER_ERROR').canRetry).toBe(true);
    expect(oauthErrorInfo('AUTH_ACCOUNT_SUSPENDED')).toMatchObject({
      canRetry: false,
      support: true,
    });
    expect(oauthErrorInfo('NO_SESSION').title).toBe('로그인이 완료되지 않았어요');
  });
  it('falls back for unknown codes and keeps the code for support', () => {
    const info = oauthErrorInfo('totally_new');
    expect(info.code).toBe('TOTALLY_NEW');
    expect(info.title).toBe('로그인하지 못했어요');
    expect(info.canRetry).toBe(true);
    expect(info.linking).toBe(false);
  });
  it('never echoes free text or digits from a crafted link', () => {
    expect(oauthErrorInfo('<img src=x> 고객센터 010-1234-5678').code).toBe('UNKNOWN');
    expect(oauthErrorInfo('call_01012345678').code).toBe('UNKNOWN');
    expect(oauthErrorInfo('A'.repeat(41)).code).toBe('UNKNOWN');
  });
  it('words a failed account link as a link, not a login', () => {
    expect(oauthErrorInfo('access_denied', { linking: true })).toMatchObject({
      title: '계정 연결을 취소했어요',
      linking: true,
      canRetry: true,
    });
    expect(oauthErrorInfo('server_error', { linking: true }).title).toBe(
      '계정을 연결하지 못했어요',
    );
    expect(oauthErrorInfo('AUTH_IDENTITY_ALREADY_LINKED')).toMatchObject({
      title: '이미 다른 회원에 연결된 계정이에요',
      linking: true,
    });
    expect(oauthErrorInfo('AUTH_ACCOUNT_SUSPENDED', { linking: true }).canRetry).toBe(false);
  });
});

describe('signup nickname', () => {
  it('accepts readable nicknames', () => {
    expect(nicknameSchema.parse('  순천살이 ')).toBe('순천살이');
    expect(nicknameSchema.safeParse('신대중앙 실장').success).toBe(true);
    expect(nicknameSchema.safeParse('home_2026').success).toBe(true);
  });
  it('rejects too short, too long and special characters', () => {
    expect(nicknameSchema.safeParse('김').success).toBe(false);
    expect(nicknameSchema.safeParse('가'.repeat(21)).success).toBe(false);
    expect(nicknameSchema.safeParse('순천<b>').success).toBe(false);
    expect(nicknameSchema.safeParse('순천  살이').success).toBe(false);
  });
});

describe('withdrawal', () => {
  it('combines the chosen reason and the detail', () => {
    expect(buildWithdrawReason('found-home', ' 신대지구에 구했어요 ')).toBe(
      '이미 집을 구했어요 — 신대지구에 구했어요',
    );
    expect(buildWithdrawReason('privacy', '')).toBe('개인정보가 걱정돼요');
    expect(buildWithdrawReason(undefined, '그냥요')).toBe('그냥요');
    expect(buildWithdrawReason(undefined, '  ')).toBeUndefined();
    expect(buildWithdrawReason('other', '가'.repeat(600))).toHaveLength(WITHDRAW_REASON_MAX);
  });
  it('requires the explicit confirmation', () => {
    expect(withdrawFormSchema.safeParse({ confirmed: false }).success).toBe(false);
    expect(withdrawFormSchema.safeParse({ confirmed: true }).success).toBe(true);
    expect(withdrawFormSchema.safeParse({ confirmed: true, reason: 'nope' }).success).toBe(false);
    expect(
      withdrawFormSchema.safeParse({ confirmed: true, detail: '가'.repeat(301) }).success,
    ).toBe(false);
  });
});
