import {
  AgencyMemberRole,
  AgencyMemberStatus,
  type AgencyInviteCreateInput,
  type AgencyMemberUpdateInput,
} from '@house/shared';
import type { AgencyInvite, AgencyMember, InviteFormValues } from '../api/schemas';

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
  /** Open invitations (not expired). */
  invited: number;
  assistantLimit: number;
}

/** Invitations that can still be redeemed at `now`. */
export const openInvites = (invites: readonly AgencyInvite[], now = Date.now()): AgencyInvite[] =>
  invites.filter((i) => Date.parse(i.expiresAt) > now);

export function staffSummary(
  members: readonly AgencyMember[],
  invites: readonly AgencyInvite[] = [],
  now = Date.now(),
): StaffSummary {
  const active = members.filter((m) => m.status === AgencyMemberStatus.ACTIVE);
  const licensed = active.filter((m) => m.role === AgencyMemberRole.OWNER || m.isLicensed).length;
  return {
    total: active.length,
    licensed,
    assistants: active.length - licensed,
    invited: openInvites(invites, now).length,
    assistantLimit: assistantLimit(licensed),
  };
}

/** Invite form → POST /agencies/mine/invites body (`agencyInviteCreateSchema`; blank memo omitted). */
export function toInvitePayload(values: InviteFormValues): AgencyInviteCreateInput {
  const label = values.label.trim();
  return label
    ? { label, expiresInHours: values.expiresInHours }
    : { expiresInHours: values.expiresInHours };
}

/**
 * PATCH /agencies/mine/members/:memberId body (`agencyMemberUpdateSchema`): 소속공인중개사 needs the
 * 자격증 번호 in the same request; 중개보조원 clears it.
 */
export function licensePayload(
  isLicensed: boolean,
  licenseNumber?: string,
): AgencyMemberUpdateInput {
  return isLicensed
    ? { isLicensed: true, licenseNumber: licenseNumber?.trim() }
    : { isLicensed: false, licenseNumber: null };
}

/** "72" → "3일", "24" → "1일", "12" → "12시간" (invite validity options). */
export function expiryLabel(hours: number): string {
  return hours % 24 === 0 ? `${hours / 24}일` : `${hours}시간`;
}
