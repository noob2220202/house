import { AgencyMemberRole, AgencyMemberStatus } from '@house/shared';
import type { AgencyMember, InviteMemberInput, InviteMemberPayload } from '../api/schemas';

/** 대표 / 소속공인중개사 / 중개보조원. */
export function memberKindLabel(member: Pick<AgencyMember, 'role' | 'isLicensed'>): string {
  if (member.role === AgencyMemberRole.OWNER) return '대표 공인중개사';
  return member.isLicensed ? '소속공인중개사' : '중개보조원';
}

/**
 * 중개보조원 고용 한도: 개업·소속 공인중개사 수의 5배 (공인중개사법 제15조 제3항).
 * `licensedCount` includes the owner.
 */
export const ASSISTANTS_PER_LICENSED = 5;
export function assistantLimit(licensedCount: number): number {
  return Math.max(0, licensedCount) * ASSISTANTS_PER_LICENSED;
}

export interface StaffSummary {
  /** Active members incl. the owner. */
  total: number;
  /** Owner + 소속공인중개사. */
  licensed: number;
  assistants: number;
  invited: number;
  assistantLimit: number;
}

export function staffSummary(members: readonly AgencyMember[]): StaffSummary {
  const active = members.filter((m) => m.status === AgencyMemberStatus.ACTIVE);
  const licensed = active.filter((m) => m.role === AgencyMemberRole.OWNER || m.isLicensed).length;
  return {
    total: active.length,
    licensed,
    assistants: active.length - licensed,
    invited: members.filter((m) => m.status === AgencyMemberStatus.INVITED).length,
    assistantLimit: assistantLimit(licensed),
  };
}

/**
 * Invite form values → POST body: blank optional fields are omitted (never ''), and a licence
 * number typed before switching to 중개보조원 is dropped.
 */
export function toInvitePayload(values: InviteMemberInput): InviteMemberPayload {
  const blankToUndefined = (v: string | undefined) => {
    const t = v?.trim();
    return t ? t : undefined;
  };
  const payload: InviteMemberPayload = {
    displayName: values.displayName.trim(),
    isLicensed: values.isLicensed,
  };
  const title = blankToUndefined(values.title);
  if (title) payload.title = title;
  const phone = blankToUndefined(values.phone);
  if (phone) payload.phone = phone;
  const licenseNumber = values.isLicensed ? blankToUndefined(values.licenseNumber) : undefined;
  if (licenseNumber) payload.licenseNumber = licenseNumber;
  return payload;
}
