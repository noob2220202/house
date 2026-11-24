import { describe, expect, it } from 'vitest';
import type { AgencyMember } from '../api/schemas';
import { inviteMemberPayloadSchema } from '../api/schemas';
import { assistantLimit, memberKindLabel, staffSummary, toInvitePayload } from './staff';

const member = (over: Partial<AgencyMember>): AgencyMember => ({
  id: Math.random().toString(36),
  role: 'AGENT',
  status: 'ACTIVE',
  displayName: '직원',
  isLicensed: false,
  ...over,
});

describe('staff', () => {
  it('labels member kinds', () => {
    expect(memberKindLabel({ role: 'OWNER', isLicensed: true })).toBe('대표 공인중개사');
    expect(memberKindLabel({ role: 'AGENT', isLicensed: true })).toBe('소속공인중개사');
    expect(memberKindLabel({ role: 'AGENT', isLicensed: false })).toBe('중개보조원');
  });
  it('summarizes active members and the assistant limit (5 × licensed)', () => {
    const summary = staffSummary([
      member({ role: 'OWNER', isLicensed: true }),
      member({ isLicensed: true }),
      member({ isLicensed: false }),
      member({ status: 'INVITED', isLicensed: true }),
      member({ status: 'REMOVED', isLicensed: false }),
    ]);
    expect(summary).toEqual({
      total: 3,
      licensed: 2,
      assistants: 1,
      invited: 1,
      assistantLimit: 10,
    });
    expect(assistantLimit(0)).toBe(0);
  });
});

describe('toInvitePayload', () => {
  it('omits blank optional fields instead of sending empty strings', () => {
    const payload = toInvitePayload({
      displayName: ' 테스트직원 ',
      title: '',
      isLicensed: true,
      licenseNumber: '  ',
      phone: '',
    });
    expect(payload).toEqual({ displayName: '테스트직원', isLicensed: true });
    expect(inviteMemberPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it('drops a licence number typed before switching to 중개보조원', () => {
    const payload = toInvitePayload({
      displayName: '보조원',
      title: '실장',
      isLicensed: false,
      licenseNumber: '전남-2019-00001',
      phone: '010-1234-5678',
    });
    expect(payload).toEqual({
      displayName: '보조원',
      title: '실장',
      isLicensed: false,
      phone: '010-1234-5678',
    });
    expect(inviteMemberPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it('the API schema rejects the empty strings the form used to send', () => {
    expect(
      inviteMemberPayloadSchema.safeParse({ displayName: 'a', isLicensed: false, phone: '' })
        .success,
    ).toBe(false);
  });
});
