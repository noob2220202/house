import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { ADMIN_PASSWORD_MIN, groupSecret, otpauthAccount, passwordIssue, sanitizeOtp } from './otp';
import {
  authErrorMessage,
  isSessionLost,
  loginReasonMessage,
  mustRestartLogin,
  sessionExpiredUrl,
} from './session';

const apiError = (status: number, code: string, message = '서버 메시지') =>
  new ApiError(status, { code, message });

describe('otp helpers', () => {
  it('keeps only digits and caps the length', () => {
    expect(sanitizeOtp('123 456')).toBe('123456');
    expect(sanitizeOtp('12-34-56-78')).toBe('123456');
    expect(sanitizeOtp('abc')).toBe('');
    expect(sanitizeOtp('１２３456')).toBe('456'); // full-width digits are not accepted
    expect(sanitizeOtp('12345678', 8)).toBe('12345678');
  });

  it('groups the base32 secret for manual entry', () => {
    expect(groupSecret('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP');
    expect(groupSecret('jbsw y3dp ehpk3')).toBe('JBSW Y3DP EHPK 3');
    expect(groupSecret('')).toBe('');
  });

  it('reads the account label of an otpauth URI', () => {
    expect(
      otpauthAccount(
        'otpauth://totp/BRAND%20%EA%B4%80%EB%A6%AC%EC%9E%90:new%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=BRAND',
      ),
    ).toBe('new@example.com');
    expect(otpauthAccount('otpauth://totp/solo%40example.com?secret=X')).toBe('solo@example.com');
    expect(otpauthAccount('https://example.com/totp/a:b')).toBeNull();
    expect(otpauthAccount('not a uri')).toBeNull();
  });

  it('checks the admin password policy', () => {
    expect(passwordIssue('short1')).toBe(`${ADMIN_PASSWORD_MIN}자 이상 입력해 주세요.`);
    expect(passwordIssue('onlyletters')).toBe('영문과 숫자를 모두 포함해 주세요.');
    expect(passwordIssue('12345678901')).toBe('영문과 숫자를 모두 포함해 주세요.');
    expect(passwordIssue('suncheon2026')).toBeNull();
  });
});

describe('session handling', () => {
  it('treats a 401 as a lost session unless it answers a form', () => {
    expect(isSessionLost(apiError(401, 'UNAUTHENTICATED'))).toBe(true);
    expect(isSessionLost(apiError(401, 'AUTH_SESSION_EXPIRED'))).toBe(true);
    expect(isSessionLost(apiError(401, 'AUTH_INVALID_CREDENTIALS'))).toBe(false);
    expect(isSessionLost(apiError(401, 'AUTH_TOTP_INVALID'))).toBe(false);
    expect(isSessionLost(apiError(403, 'FORBIDDEN'))).toBe(false);
    expect(isSessionLost(apiError(0, 'NETWORK_ERROR'))).toBe(false);
    expect(isSessionLost(new Error('boom'))).toBe(false);
    expect(mustRestartLogin(apiError(401, 'UNAUTHENTICATED'))).toBe(true);
  });

  it('sends a console session that lost its TOTP verification back to login, but not the login flow', () => {
    // The API guard answers AUTH_TOTP_REQUIRED on every /admin/* route for an unverified session.
    expect(isSessionLost(apiError(401, 'AUTH_TOTP_REQUIRED'))).toBe(true);
    // …which is the expected state while the login flow is on its TOTP step.
    expect(mustRestartLogin(apiError(401, 'AUTH_TOTP_REQUIRED'))).toBe(false);
    expect(mustRestartLogin(apiError(401, 'AUTH_TOTP_INVALID'))).toBe(false);
  });

  it('builds the login URL to come back to the same screen', () => {
    expect(sessionExpiredUrl('/banners?slot=MAIN_HERO')).toBe(
      '/login?returnTo=%2Fbanners%3Fslot%3DMAIN_HERO&reason=expired',
    );
    expect(sessionExpiredUrl('/')).toBe('/login?reason=expired');
    // never an off-site or login-loop target
    expect(sessionExpiredUrl('//evil.example.com')).toBe('/login?reason=expired');
    expect(sessionExpiredUrl('/login?returnTo=%2F')).toBe('/login?reason=expired');
  });

  it('explains why the admin is on the login page', () => {
    expect(loginReasonMessage('expired')).toContain('세션이 만료');
    expect(loginReasonMessage('other')).toBeNull();
    expect(loginReasonMessage(undefined)).toBeNull();
  });

  it('maps auth error codes to form messages', () => {
    expect(authErrorMessage(apiError(401, 'AUTH_INVALID_CREDENTIALS'))).toBe(
      '이메일 또는 비밀번호가 올바르지 않습니다.',
    );
    expect(authErrorMessage(apiError(423, 'AUTH_ACCOUNT_LOCKED'))).toContain('계정이 잠겼습니다');
    expect(authErrorMessage(apiError(403, 'AUTH_ACCOUNT_SUSPENDED'))).toContain('사용이 중지된');
    expect(authErrorMessage(apiError(403, 'AUTH_IP_NOT_ALLOWED'))).toContain(
      '허용되지 않은 접속 위치',
    );
    expect(authErrorMessage(apiError(400, 'AUTH_TOTP_INVALID'))).toContain('최신 코드');
    expect(authErrorMessage(apiError(401, 'UNAUTHENTICATED'))).toContain('처음부터 다시');
    expect(authErrorMessage(apiError(500, 'UNKNOWN_ERROR', '서버 메시지'))).toBe('서버 메시지');
    expect(authErrorMessage(new TypeError('failed to fetch'))).toContain('일시적인 오류');
  });
});
