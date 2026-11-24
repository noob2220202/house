import { ListingStatus } from '@house/shared';
import { describe, expect, it } from 'vitest';
import {
  allowedTransitions,
  canTransition,
  commonTransitions,
  isVerificationDue,
  statusDoneText,
  verificationState,
} from './status';

const primary = { isPrimary: true };

describe('status transitions', () => {
  it('follows DRAFT → ACTIVE ↔ RESERVED → CLOSED with broker-side hide / re-open', () => {
    expect(allowedTransitions(ListingStatus.ACTIVE, primary)).toEqual([
      ListingStatus.RESERVED,
      ListingStatus.CLOSED,
      ListingStatus.HIDDEN,
    ]);
    expect(allowedTransitions(ListingStatus.RESERVED, primary)).toEqual([
      ListingStatus.ACTIVE,
      ListingStatus.CLOSED,
    ]);
    expect(allowedTransitions(ListingStatus.HIDDEN, primary)).toEqual([ListingStatus.ACTIVE]);
  });

  it('drafts go live through publish only and CLOSED is final', () => {
    expect(allowedTransitions(ListingStatus.DRAFT, primary)).toEqual([]);
    expect(allowedTransitions(ListingStatus.CLOSED, primary)).toEqual([]);
    expect(canTransition(ListingStatus.CLOSED, ListingStatus.ACTIVE, primary)).toBe(false);
  });

  it('a listing hidden by the operator cannot be re-opened by the broker', () => {
    expect(
      allowedTransitions(ListingStatus.HIDDEN, { isPrimary: true, hiddenByOperator: true }),
    ).toEqual([]);
  });

  it('co-brokering offices never change the status', () => {
    for (const status of Object.values(ListingStatus)) {
      expect(allowedTransitions(status, { isPrimary: false }), status).toEqual([]);
    }
  });

  it('bulk bar offers only the targets every selected row can reach', () => {
    const active = { status: ListingStatus.ACTIVE, isPrimary: true };
    const reserved = { status: ListingStatus.RESERVED, isPrimary: true };
    expect(commonTransitions([])).toEqual([]);
    expect(commonTransitions([active, active])).toEqual([
      ListingStatus.RESERVED,
      ListingStatus.CLOSED,
      ListingStatus.HIDDEN,
    ]);
    expect(commonTransitions([active, reserved])).toEqual([ListingStatus.CLOSED]);
    expect(commonTransitions([active, { ...active, isPrimary: false }])).toEqual([]);
    expect(
      commonTransitions([
        { status: ListingStatus.HIDDEN, isPrimary: true },
        { status: ListingStatus.HIDDEN, isPrimary: true, hiddenReason: '허위매물 신고 접수' },
      ]),
    ).toEqual([]);
  });
});

describe('statusDoneText', () => {
  it('reads naturally for one listing and for a bulk change', () => {
    expect(statusDoneText(ListingStatus.RESERVED, 1)).toBe('계약중으로 바꿨어요.');
    expect(statusDoneText(ListingStatus.CLOSED, 3)).toBe('3건을 거래완료 처리했어요.');
    expect(statusDoneText(ListingStatus.HIDDEN, 1)).toBe('매물을 숨겼어요.');
    expect(statusDoneText(ListingStatus.HIDDEN, 2)).toBe('2건을 숨겼어요.');
    expect(statusDoneText(ListingStatus.ACTIVE, 1)).toBe('다시 광고하기 시작했어요.');
  });
});

describe('verificationState (실매물 확인 기한, Asia/Seoul days)', () => {
  // 2026-11-24 09:00 KST
  const now = Date.parse('2026-11-24T09:00:00+09:00');

  it('“확인 전” when never verified', () => {
    expect(verificationState({ verifiedAt: null }, now)).toEqual({
      kind: 'none',
      daysLeft: null,
      label: '확인 전',
    });
  });

  it('counts down to the due date sent by the API', () => {
    const item = { verifiedAt: '2026-11-23', verificationDueAt: '2026-12-23' };
    expect(verificationState(item, now)).toEqual({ kind: 'ok', daysLeft: 29, label: 'D-29' });
  });

  it('“soon” within a week, including the due day itself', () => {
    expect(
      verificationState({ verifiedAt: '2026-10-30', verificationDueAt: '2026-11-29' }, now),
    ).toEqual({ kind: 'soon', daysLeft: 5, label: 'D-5' });
    expect(
      verificationState({ verifiedAt: '2026-10-25', verificationDueAt: '2026-11-24' }, now),
    ).toEqual({ kind: 'soon', daysLeft: 0, label: '오늘 만료' });
  });

  it('overdue after the due date', () => {
    expect(
      verificationState({ verifiedAt: '2026-10-15', verificationDueAt: '2026-11-14' }, now),
    ).toEqual({ kind: 'overdue', daysLeft: -10, label: '10일 지남' });
  });

  it('falls back to verifiedAt + 30 days when the API sends no due date', () => {
    expect(verificationState({ verifiedAt: '2026-11-04' }, now)).toMatchObject({
      kind: 'ok',
      daysLeft: 10,
    });
    expect(verificationState({ verifiedAt: '2026-10-20T15:30:00+09:00' }, now)).toMatchObject({
      kind: 'overdue',
    });
  });

  it('uses the Korean calendar day regardless of the time of day', () => {
    const item = { verifiedAt: '2026-10-26', verificationDueAt: '2026-11-25' };
    // 00:30 and 23:30 KST on the 24th are both one day before the due date.
    expect(verificationState(item, Date.parse('2026-11-24T00:30:00+09:00')).daysLeft).toBe(1);
    expect(verificationState(item, Date.parse('2026-11-24T23:30:00+09:00')).daysLeft).toBe(1);
    expect(verificationState(item, Date.parse('2026-11-25T00:10:00+09:00')).daysLeft).toBe(0);
  });

  it('ignores unparsable dates', () => {
    expect(verificationState({ verifiedAt: 'soon' }, now).kind).toBe('none');
  });
});

describe('isVerificationDue', () => {
  const now = Date.parse('2026-11-24T09:00:00+09:00');
  const overdue = { verifiedAt: '2026-10-15', verificationDueAt: '2026-11-14' };
  const fresh = { verifiedAt: '2026-11-23', verificationDueAt: '2026-12-23' };

  it('flags public listings that are unverified, expiring or overdue', () => {
    expect(isVerificationDue({ status: ListingStatus.ACTIVE, ...overdue }, now)).toBe(true);
    expect(isVerificationDue({ status: ListingStatus.RESERVED, verifiedAt: null }, now)).toBe(true);
    expect(isVerificationDue({ status: ListingStatus.ACTIVE, ...fresh }, now)).toBe(false);
  });

  it('never nags about listings that are not public', () => {
    for (const status of [ListingStatus.DRAFT, ListingStatus.CLOSED, ListingStatus.HIDDEN]) {
      expect(isVerificationDue({ status, ...overdue }, now), status).toBe(false);
    }
  });
});
