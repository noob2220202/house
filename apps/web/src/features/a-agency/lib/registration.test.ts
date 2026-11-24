import { describe, expect, it } from 'vitest';
import {
  formatBusinessNumber,
  formatInviteCode,
  isCompleteInviteCode,
  isPlausibleRegistrationNumber,
  isValidBusinessNumber,
  normalizeInviteCode,
  normalizeRegistrationNumber,
} from './registration';

describe('registration number', () => {
  it('hyphenates a 14-digit modern number and cleans spacing/dashes', () => {
    expect(normalizeRegistrationNumber('46150202000012')).toBe('46150-2020-00012');
    expect(normalizeRegistrationNumber(' 46150 – 2020 – 00012 ')).toBe('46150-2020-00012');
    expect(normalizeRegistrationNumber('가-1234--5678')).toBe('가-1234-5678');
  });
  it('accepts modern and legacy formats, rejects junk', () => {
    expect(isPlausibleRegistrationNumber('46150-2020-00012')).toBe(true);
    expect(isPlausibleRegistrationNumber('전남-순천-2015-0012')).toBe(true);
    expect(isPlausibleRegistrationNumber('1234')).toBe(false);
    expect(isPlausibleRegistrationNumber('등록번호없음')).toBe(false);
    expect(isPlausibleRegistrationNumber('46150/2020/00012')).toBe(false);
  });
});

describe('business number', () => {
  it('formats progressively', () => {
    expect(formatBusinessNumber('12')).toBe('12');
    expect(formatBusinessNumber('1234')).toBe('123-4');
    expect(formatBusinessNumber('1234567890')).toBe('123-45-67890');
    expect(formatBusinessNumber('123-45-678901234')).toBe('123-45-67890');
  });
  it('validates the check digit', () => {
    // Valid by the 국세청 algorithm (weights 1 3 7 1 3 7 1 3 5).
    expect(isValidBusinessNumber('000-00-00000')).toBe(true);
    expect(isValidBusinessNumber('123-45-67891')).toBe(true);
    expect(isValidBusinessNumber('123-45-67890')).toBe(false);
    expect(isValidBusinessNumber('12345')).toBe(false);
    expect(isValidBusinessNumber('')).toBe(false);
  });
});

describe('invite code', () => {
  it('normalizes and formats', () => {
    // Shared format: 10 characters shown as 5-5.
    expect(normalizeInviteCode(' k7mq4-rxd2p ')).toBe('K7MQ4RXD2P');
    expect(formatInviteCode('k7mq4rxd2p')).toBe('K7MQ4-RXD2P');
    expect(formatInviteCode('k7m')).toBe('K7M');
    expect(formatInviteCode('K7MQ4-RXD2P-EXTRA')).toBe('K7MQ4-RXD2P');
  });
  it('knows when a code is complete (length and the issued alphabet)', () => {
    expect(isCompleteInviteCode('K7MQ4-RXD2P')).toBe(true);
    expect(isCompleteInviteCode('K7MQ4-RX')).toBe(false);
    // 0 / O / 1 / I are never issued.
    expect(isCompleteInviteCode('K7MQ4-RXD0P')).toBe(false);
  });
});
