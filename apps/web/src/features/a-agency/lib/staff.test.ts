import { agencyInviteCreateSchema, agencyMemberUpdateSchema } from '@house/shared';
import { describe, expect, it } from 'vitest';
import type { AgencyInvite, AgencyMember } from '../api/schemas';
import {
  assistantLimit,
  expiryLabel,
  licensePayload,
  memberKindLabel,
  openInvites,
  staffSummary,
  toInvitePayload,
} from './staff';

const member = (over: Partial<AgencyMember>): AgencyMember => ({
  id: Math.random().toString(36),
  role: 'AGENT',
  status: 'ACTIVE',
  displayName: '직원',
  isLicensed: false,
  ...over,
});

const NOW = Date.parse('2026-11-24T00:00:00Z');
const invite = (expiresAt: string): AgencyInvite => ({
  id: 'a'.repeat(24),
  codeHint: 'QRST',
  label: null,
  createdAt: '2026-11-20T00:00:00Z',
  expiresAt,
});

describe('staff', () => {
  it('labels member kinds', () => {
    expect(memberKindLabel({ role: 'OWNER', isLicensed: true })).toBe('대표 공인중개사');
    expect(memberKindLabel({ role: 'AGENT', isLicensed: true })).toBe('소속공인중개사');
    expect(memberKindLabel({ role: 'AGENT', isLicensed: false })).toBe('중개보조원');
  });

  it('summarizes active members, open invites and the assistant limit (5 × licensed)', () => {
    const summary = staffSummary(
      [
        member({ role: 'OWNER', isLicensed: true }),
        member({ isLicensed: true }),
        member({ isLicensed: false }),
        member({ status: 'REMOVED', isLicensed: false }),
      ],
      [invite('2026-11-25T00:00:00Z'), invite('2026-11-23T00:00:00Z')],
      NOW,
    );
    expect(summary).toEqual({
      total: 3,
      licensed: 2,
      assistants: 1,
      invited: 1,
      assistantLimit: 10,
    });
    expect(assistantLimit(0)).toBe(0);
    expect(openInvites([invite('2026-11-23T00:00:00Z')], NOW)).toEqual([]);
  });
});

describe('toInvitePayload (agencyInviteCreateSchema)', () => {
  it('omits a blank memo and keeps the validity', () => {
    const payload = toInvitePayload({ label: '  ', expiresInHours: 72 });
    expect(payload).toEqual({ expiresInHours: 72 });
    expect(agencyInviteCreateSchema.safeParse(payload).success).toBe(true);
  });

  it('sends the trimmed memo', () => {
    const payload = toInvitePayload({ label: ' 김실장 ', expiresInHours: 168 });
    expect(payload).toEqual({ label: '김실장', expiresInHours: 168 });
    expect(agencyInviteCreateSchema.parse(payload)).toEqual(payload);
  });

  it('labels the validity options', () => {
    expect(expiryLabel(24)).toBe('1일');
    expect(expiryLabel(336)).toBe('14일');
    expect(expiryLabel(12)).toBe('12시간');
  });
});

describe('licensePayload (agencyMemberUpdateSchema)', () => {
  it('소속공인중개사 carries the license number in the same request', () => {
    const payload = licensePayload(true, ' 2019-전남-00847 ');
    expect(payload).toEqual({ isLicensed: true, licenseNumber: '2019-전남-00847' });
    expect(agencyMemberUpdateSchema.safeParse(payload).success).toBe(true);
    // Without a number the API refuses it.
    expect(agencyMemberUpdateSchema.safeParse(licensePayload(true, '')).success).toBe(false);
  });

  it('중개보조원 clears the number', () => {
    const payload = licensePayload(false);
    expect(payload).toEqual({ isLicensed: false, licenseNumber: null });
    expect(agencyMemberUpdateSchema.safeParse(payload).success).toBe(true);
  });
});
