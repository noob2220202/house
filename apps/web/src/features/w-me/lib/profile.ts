import { ROLE_LABEL, UserRole, formatPhone, phoneSchema } from '@house/shared';
import { z } from 'zod';
import { formatDateTime } from '@/lib/format';
import type { Profile } from '../schemas';

/** "일반회원" / "중개사 회원" style caption for the profile card. */
export function roleCaption(role: UserRole): string {
  return role === UserRole.USER ? ROLE_LABEL.USER : '중개사 회원';
}

/**
 * Caption under the marketing-consent switch, always with the time of the last change:
 * "2026.11.23 14:02 수신 동의" / "2026.11.23 14:02 수신 거부" / "수신 동의 안 함".
 */
export function marketingConsentCaption(optIn: boolean, changedAt?: string | null): string {
  const when = changedAt ? formatDateTime(changedAt) : '';
  if (optIn) return when ? `${when} 수신 동의` : '수신 동의';
  return when ? `${when} 수신 거부` : '수신 동의 안 함';
}

/**
 * Profile form. `phone` is a plain contact field (format-checked only — there is no SMS
 * verification anywhere); an empty value clears it.
 */
export const profileFormSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(1, '닉네임을 입력해 주세요.')
    .max(30, '닉네임은 30자까지 입력할 수 있어요.'),
  phone: z
    .string()
    .trim()
    .max(30, '올바른 휴대폰 번호가 아닙니다.')
    .refine((v) => v === '' || phoneSchema.safeParse(v).success, '올바른 휴대폰 번호가 아닙니다.'),
  marketingOptIn: z.boolean(),
});
export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export function profileFormDefaults(profile: Profile): ProfileFormValues {
  return {
    nickname: profile.nickname,
    phone: profile.phone ? formatPhone(profile.phone) : '',
    marketingOptIn: profile.marketingOptIn,
  };
}

export interface ProfilePatch {
  nickname?: string;
  phone?: string | null;
  marketingOptIn?: boolean;
}

/** Only the fields that changed, in the shape of `updateProfileSchema` (PATCH /me/profile). */
export function toProfilePatch(values: ProfileFormValues, profile: Profile): ProfilePatch {
  const patch: ProfilePatch = {};
  const nickname = values.nickname.trim();
  if (nickname !== profile.nickname) patch.nickname = nickname;
  const parsed = values.phone.trim() === '' ? null : phoneSchema.safeParse(values.phone);
  const phone = parsed === null ? null : parsed.success ? parsed.data : values.phone.trim();
  if (phone !== (profile.phone ?? null)) patch.phone = phone;
  if (values.marketingOptIn !== profile.marketingOptIn)
    patch.marketingOptIn = values.marketingOptIn;
  return patch;
}
