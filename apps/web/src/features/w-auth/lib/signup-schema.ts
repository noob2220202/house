import { z } from 'zod';

/**
 * Nickname rule of the signup form — the same rule as the backend's `nicknameSchema`
 * (@house/shared: 2–20 characters of 한글, 영문, 숫자, `_ . -`, no spaces), worded for the UI.
 */
export const nicknameSchema = z
  .string()
  .trim()
  .min(2, '닉네임은 2자 이상 입력해 주세요.')
  .max(20, '닉네임은 20자까지 쓸 수 있어요.')
  .regex(/^[0-9A-Za-z가-힣_.-]+$/, '한글, 영문, 숫자와 _ . - 만 쓸 수 있어요. 띄어쓰기는 안 돼요.');

export const signupFormSchema = z.object({ nickname: nicknameSchema });
export type SignupFormValues = z.infer<typeof signupFormSchema>;

/**
 * Prefill for the nickname field from the provider profile: spaces are dropped, and the value is
 * kept only when it then passes the rule (a provider nickname with emoji would greet the member
 * with an error).
 */
export function prefillNickname(value: string | null | undefined): string {
  const trimmed = (value ?? '').replace(/\s+/g, '');
  return nicknameSchema.safeParse(trimmed).success ? trimmed : '';
}
